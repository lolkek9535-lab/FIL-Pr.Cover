const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');
const { handleTool, setHttpBaseUrl } = require('../.test-dist/integration.js');
const annotation = { id: 'review-note', sessionId: 'review-session', comment: 'Review this', element: 'button', elementPath: '#review', status: 'pending' };
const event = { type: 'annotation.created', sessionId: annotation.sessionId, sequence: 1, payload: annotation };
const encode = value => new TextEncoder().encode(`data: ${JSON.stringify(value)}\n\n`);

function fixture(t, pending) {
  let stream, signal, reads = 0;
  let onConnected;
  const connected = new Promise(resolve => { onConnected = resolve; });
  setHttpBaseUrl('http://watch-review.test');
  t.mock.method(global, 'fetch', async (url, options = {}) => {
    if (String(url).endsWith('/pending')) {
      const annotations = pending(++reads);
      return new Response(JSON.stringify({ count: annotations.length, annotations }));
    }
    signal = options.signal;
    return new Response(new ReadableStream({ start(controller) { stream = controller; onConnected(); } }), { headers: { 'Content-Type': 'text/event-stream' } });
  });
  return { connected, send: value => stream.enqueue(encode(value)), fail: () => stream.error(new Error('review disconnect')), get signal() { return signal; } };
}
const watch = (options = {}) => handleTool('agentation_watch_annotations', { sessionId: annotation.sessionId, timeoutSeconds: 1, batchWindowSeconds: 1, ...options });
const body = result => { assert.ok(!result.isError, result.content[0].text); return JSON.parse(result.content[0].text); };

test('watch gives an arriving annotation its full batch window instead of reporting a quiet timeout', async t => {
  const f = fixture(t, () => []);
  const result = watch(); await f.connected;
  await delay(500); f.send(event);
  const value = body(await result);
  assert.equal(value.timeout, false);
  assert.equal(value.annotations[0].id, annotation.id);
  assert.equal(f.signal.aborted, true);
});

test('watch recovers feedback arriving between the pending drain and the SSE connection', async t => {
  const f = fixture(t, read => read === 1 ? [] : [annotation]);
  const result = watch(); await f.connected;
  const value = body(await result);
  assert.equal(value.timeout, false);
  assert.deepEqual(value.annotations.map(a => a.id), [annotation.id]);
});

test('watch deduplicates feedback seen in both the post-connect drain and live events', async t => {
  const f = fixture(t, read => read === 1 ? [] : [annotation]);
  const result = watch({ timeoutSeconds: 3 }); await f.connected;
  f.send(event); f.send(event);
  const value = body(await result);
  assert.equal(value.timeout, false);
  assert.deepEqual(value.annotations.map(a => a.id), [annotation.id]);
});

test('watch aborts the stream and batch timer after a connection failure', async t => {
  const f = fixture(t, () => []);
  const result = watch(); await f.connected;
  f.send(event); await delay(10); f.fail();
  assert.equal((await result).isError, true);
  assert.equal(f.signal.aborted, true);
});

test('watch stays scoped and reports a genuine quiet timeout', async t => {
  const f = fixture(t, () => []);
  const result = watch(); await f.connected;
  f.send({ ...event, sessionId: 'unrelated-session', payload: { ...annotation, sessionId: 'unrelated-session' } });
  assert.equal(body(await result).timeout, true);
  assert.equal(f.signal.aborted, true);
});

test('watch reports a failed post-connect pending read and closes the stream', async t => {
  const f = fixture(t, read => { if (read > 1) throw new Error('review pending unavailable'); return []; });
  const result = await watch();
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /Pending check failed after connecting.*review pending unavailable/);
  assert.equal(f.signal.aborted, true);
});

test('cancelling an active tool request closes its watch immediately', async t => {
  const f = fixture(t, () => []);
  const controller = new AbortController();
  const result = handleTool('agentation_watch_annotations', { sessionId: annotation.sessionId, timeoutSeconds: 1 }, controller.signal);
  await f.connected;
  controller.abort();
  const value = await result;
  assert.equal(value.isError, true);
  assert.match(value.content[0].text, /cancelled/i);
  assert.equal(f.signal.aborted, true);
});

test('an already cancelled watch performs no HTTP requests', async t => {
  const fetched = t.mock.method(global, 'fetch', async () => { throw new Error('Unexpected request'); });
  const controller = new AbortController(); controller.abort();
  const result = await handleTool('agentation_watch_annotations', { timeoutSeconds: 1 }, controller.signal);
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /cancelled/i);
  assert.equal(fetched.mock.callCount(), 0);
});
