const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setTimeout: wait } = require('node:timers/promises');
const { createWebhookDispatcher } = require('../.test-dist/integration.js');
const config = { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 20, timeoutMs: 10 };
function dispatcher(t, patch = {}) {
  const d = createWebhookDispatcher({ ...config, ...patch });
  // Test runner must stay alive while deliberately unrefed production retries wait.
  const keepAlive = setInterval(() => {}, 1000);
  t.after(() => { d.close(); clearInterval(keepAlive); });
  return d;
}
test('transient webhook failures retry with the same payload and delivery ID', async t => {
  const seen = [];
  const fetch = t.mock.method(global, 'fetch', async (_, init) => {
    seen.push(init);
    return new Response('', { status: [503, 429, 200][seen.length - 1] });
  });
  const result = await dispatcher(t).send('http://webhook.test/hook', '{"test":true}');
  assert.deepEqual(result, { ok: true, attempts: 3, status: 200 });
  assert.equal(fetch.mock.callCount(), 3);
  assert.equal(new Set(seen.map(x => x.headers['X-Agentation-Delivery-Id'])).size, 1);
  assert.equal(new Set(seen.map(x => x.body)).size, 1);
});
test('ordinary client failures stop immediately and release the response body', async t => {
  const cancel = t.mock.fn(async () => {});
  const fetch = t.mock.method(global, 'fetch', async () => ({ status: 400, ok: false, body: { cancel }, headers: new Headers() }));
  const result = await dispatcher(t).send('http://webhook.test/hook', '{}');
  assert.equal(result.attempts, 1);
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(cancel.mock.callCount(), 1);
});
test('network failure clears each timeout and stops at the retry limit', async t => {
  const timers = [];
  const realSetTimeout = global.setTimeout;
  t.mock.method(global, 'setTimeout', (...args) => { const timer = realSetTimeout(...args); timers.push(timer); return timer; });
  const clear = t.mock.method(global, 'clearTimeout');
  t.mock.method(global, 'fetch', async () => { throw new TypeError('fetch failed'); });
  const result = await dispatcher(t).send('http://webhook.test/hook', '{}');
  assert.equal(result.attempts, 4);
  assert.equal(result.ok, false);
  for (const timer of timers) assert.ok(clear.mock.calls.some(c => c.arguments[0] === timer));
});
test('request timeouts abort the request and remain retryable', async t => {
  let aborts = 0;
  t.mock.method(global, 'fetch', (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => { aborts++; reject(new DOMException('Aborted', 'AbortError')); }, { once: true })));
  const result = await dispatcher(t, { maxRetries: 1 }).send('http://webhook.test/hook', '{}');
  assert.equal(result.attempts, 2);
  assert.equal(aborts, 2);
});
test('server shutdown aborts an active request and prevents new deliveries', async t => {
  let signal;
  const fetch = t.mock.method(global, 'fetch', (_, init) => { signal = init.signal; return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })); });
  const d = dispatcher(t, { timeoutMs: 1000 });
  const job = d.send('http://webhook.test/hook', '{}');
  d.close();
  assert.equal((await job).cancelled, true);
  assert.equal(signal.aborted, true);
  assert.equal((await d.send('http://webhook.test/hook', '{}')).attempts, 0);
  assert.equal(fetch.mock.callCount(), 1);
});
test('server shutdown cancels a pending backoff', async t => {
  const fetch = t.mock.method(global, 'fetch', async () => new Response('', { status: 503 }));
  const d = dispatcher(t, { baseDelayMs: 1000, maxDelayMs: 1000 });
  const job = d.send('http://webhook.test/hook', '{}');
  await wait(5); d.close();
  assert.equal((await job).cancelled, true);
  assert.equal(fetch.mock.callCount(), 1);
});
test('Retry-After beyond the wait limit is not retried early', async t => {
  const fetch = t.mock.method(global, 'fetch', async () => new Response('', { status: 429, headers: { 'Retry-After': '60' } }));
  const result = await dispatcher(t).send('http://webhook.test/hook', '{}');
  assert.equal(result.attempts, 1);
  assert.equal(fetch.mock.callCount(), 1);
});
test('zero retries disables retries and malformed URLs never reach fetch', async t => {
  const fetch = t.mock.method(global, 'fetch', async () => new Response('', { status: 503 }));
  const d = dispatcher(t, { maxRetries: 0 });
  assert.equal((await d.send('http://webhook.test/hook', '{}')).attempts, 1);
  assert.equal((await d.send('file:///tmp/not-a-webhook', '{}')).attempts, 0);
  assert.equal((await d.send('bad url', '{}')).attempts, 0);
  assert.equal(fetch.mock.callCount(), 1);
});
