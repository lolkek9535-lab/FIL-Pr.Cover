const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { getStore, clearAll, eventBus } = require('../.test-dist/integration.js');

function memory(t, values = {}) {
  const vars = { AGENTATION_STORE: 'memory', AGENTATION_MAX_EVENTS: '3', AGENTATION_EVENT_TTL_MS: '1000', AGENTATION_CLEANUP_INTERVAL_MS: '1000', ...values };
  const previous = Object.fromEntries(Object.keys(vars).map(k => [k, process.env[k]]));
  Object.assign(process.env, vars);
  clearAll();
  t.after(() => { clearAll(); for (const [k, v] of Object.entries(previous)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
  return getStore();
}

test('memory retention bounds replay without losing current sessions or sequence order', t => {
  const store = memory(t);
  const session = store.createSession('http://retention.localhost');
  const first = store.getEventsSince(session.id, 0)[0].sequence;
  for (let i = 0; i < 10; i++) store.updateSessionStatus(session.id, 'active');
  const events = store.getEventsSince(session.id, 0);
  assert.equal(events.length, 3);
  assert.ok(events[0].sequence > first);
  assert.deepEqual(events.map(e => e.sequence), [first + 8, first + 9, first + 10]);
  assert.ok(store.getSession(session.id));
  assert.equal(store.getEventsSince(session.id, events[1].sequence).length, 1);
});

test('expired replay disappears on read without waiting for the cleanup interval', t => {
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  const store = memory(t);
  const session = store.createSession('http://retention.localhost');
  assert.equal(store.getEventsSince(session.id, 0).length, 1);
  now = Date.parse(store.getEventsSince(session.id, 0)[0].timestamp) + 1001;
  assert.equal(store.getEventsSince(session.id, 0).length, 0);
  assert.ok(store.getSession(session.id));
});

test('idle cleanup is unrefed and close clears its timer', t => {
  let tick;
  const timer = { unref: t.mock.fn() };
  t.mock.method(global, 'setInterval', fn => { tick = fn; return timer; });
  const cleared = t.mock.method(global, 'clearInterval', () => {});
  const store = memory(t);
  assert.equal(typeof tick, 'function');
  assert.equal(timer.unref.mock.callCount(), 1);
  store.close();
  assert.equal(cleared.mock.calls.at(-1).arguments[0], timer);
});

test('invalid retention settings fall back instead of purging events or spinning', t => {
  let interval;
  t.mock.method(global, 'setInterval', (_, ms) => { interval = ms; return { unref() {} }; });
  t.mock.method(global, 'clearInterval', () => {});
  const store = memory(t, { AGENTATION_MAX_EVENTS: '-1', AGENTATION_EVENT_TTL_MS: 'NaN', AGENTATION_CLEANUP_INTERVAL_MS: '999999999999' });
  const session = store.createSession('http://retention.localhost');
  for (let i = 0; i < 4; i++) store.updateSessionStatus(session.id, 'active');
  assert.equal(store.getEventsSince(session.id, 0).length, 5);
  assert.equal(interval, 300000);
});

test('retention counts events across sessions while filtering replay per session', t => {
  const store = memory(t);
  const a = store.createSession('http://retention.localhost/a');
  const b = store.createSession('http://retention.localhost/b');
  store.updateSessionStatus(a.id, 'closed');
  store.updateSessionStatus(b.id, 'closed');
  assert.equal(store.getEventsSince(a.id, 0).length, 1);
  assert.equal(store.getEventsSince(b.id, 0).length, 2);
  assert.equal(store.listSessions().length, 2);
});

test('an unused memory store does not keep a process alive', () => {
  const child = spawnSync(process.execPath, ['-e', `process.env.AGENTATION_STORE='memory';require(${JSON.stringify(require.resolve('../.test-dist/integration.js'))}).getStore()`], { timeout: 2000 });
  assert.equal(child.status, 0, child.error?.message || child.stderr.toString());
});
