const { test } = require('node:test');
const assert = require('node:assert/strict');
const { worker, port, tick } = require('./helpers.cjs');
const configured = () => ({ apiKey: 'test-only-key', apiUrl: 'https://api.example.com/v1', dataConsentEndpoint: 'https://api.example.com/v1/chat/completions', model: 'test' });
async function finish(p) { for (let i = 0; i < 100 && !p.closed; i++) await tick(); assert.equal(p.closed, true); }
test('Migrate key to trusted session memory and expose only public UI settings', async () => {
  const w = worker(configured());
  const publicData = await w.message({ type: 'get-ui-settings' }, w.content);
  assert.equal(publicData.apiKey, undefined); assert.equal(publicData.apiUrl, undefined);
  assert.equal(w.chrome.storage.local.data.apiKey, undefined);
  assert.equal(w.chrome.storage.session.data.apiKey, 'test-only-key');
  assert.equal(w.chrome.storage.local.accessLevel, 'TRUSTED_CONTEXTS');
  const denied = await w.message({ type: 'get-settings' }, w.content); assert.match(denied.error, /only available/);
});
test('Consent is required before capture or network transmission', async () => {
  let fetches = 0; let captures = 0;
  const w = worker({ ...configured(), dataConsentEndpoint: '' }, async () => { fetches++; });
  w.chrome.tabs.captureVisibleTab = async () => { captures++; return ''; };
  const p = port(w.content); w.chrome.runtime.onConnect.emit(p);
  p.onMessage.emit({ action: 'chat-screenshot', messages: [{ role: 'user', content: 'test' }] });
  await finish(p); assert.equal(fetches, 0); assert.equal(captures, 0); assert.equal(p.received[0].type, 'error');
});
test('Streaming completes once, credentials use configured endpoint, redirects disabled', async () => {
  let request;
  const w = worker(configured(), async (url, options) => { request = { url, ...options }; return new Response('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: [DONE]\n'); });
  const p = port(w.content); w.chrome.runtime.onConnect.emit(p);
  p.onMessage.emit({ action: 'chat', messages: [{ role: 'user', content: 'test' }] });
  p.onMessage.emit({ action: 'chat', messages: [{ role: 'user', content: 'duplicate' }] });
  await finish(p); assert.deepEqual(p.received.map(m => m.type), ['chunk', 'done']);
  assert.equal(request.redirect, 'error'); assert.equal(request.credentials, 'omit'); assert.equal(request.url, configured().dataConsentEndpoint);
});
test('Disconnect cancels a fetch before response headers', async () => {
  let signal;
  const w = worker(configured(), async (_, options) => { signal = options.signal; return new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })); });
  const p = port(w.content); w.chrome.runtime.onConnect.emit(p); p.onMessage.emit({ action: 'chat', messages: [{ role: 'user', content: 'test' }] });
  for (let i = 0; i < 30 && !signal; i++) await tick();
  assert.ok(signal); p.disconnect(); await tick(); assert.equal(signal.aborted, true); assert.equal(p.received.length, 0);
});
test('Provider errors do not leak response bodies', async () => {
  const w = worker(configured(), async () => new Response('private key / prompt echo', { status: 401 }));
  const p = port(w.content); w.chrome.runtime.onConnect.emit(p); p.onMessage.emit({ action: 'chat', messages: [{ role: 'user', content: 'test' }] });
  await finish(p); assert.match(p.received[0].error, /401/); assert.doesNotMatch(p.received[0].error, /private key|prompt echo/);
});
test('Local Ollama works without an API key', async () => {
  const w = worker({ apiUrl: 'http://localhost:11434', dataConsentEndpoint: 'http://localhost:11434/v1/chat/completions' }, async () => new Response('data:{"choices":[{"delta":{"content":"local"}}]}\n'));
  const p = port(w.content); w.chrome.runtime.onConnect.emit(p); p.onMessage.emit({ action: 'chat', messages: [{ role: 'user', content: 'test' }] }); await finish(p); assert.equal(p.received[0].content, 'local');
});
test('Screenshot refuses a different active source tab', async () => {
  let captures = 0; const w = worker(configured()); w.chrome.tabs.captureVisibleTab = async () => { captures++; return ''; };
  const p = port({ ...w.content, tab: { id: 8, windowId: 1 } }); w.chrome.runtime.onConnect.emit(p); p.onMessage.emit({ action: 'chat-screenshot', messages: [{ role: 'user', content: 'test' }] });
  await finish(p); assert.equal(captures, 0); assert.match(p.received[0].error, /no longer active/);
});
test('Concurrent history writes preserve records and bound storage', async () => {
  const w = worker();
  await Promise.all(Array.from({ length: 55 }, (_, i) => w.message({ type: 'save-inline-history', recordId: String(i), question: `question ${i}`, answer: 'answer' }, w.content)));
  assert.equal(w.chrome.storage.local.data.inlineHistory.length, 50);
  assert.equal(new Set(w.chrome.storage.local.data.inlineHistory.map(r => r.id)).size, 50);
  assert.equal(w.chrome.storage.local.data.inlineHistory[0].url, undefined);
});
test('Context query is claimed once and only in the originating window', async () => {
  const w = worker({ pendingQuery: { id: 'query', prompt: 'test', timestamp: Date.now(), windowId: 1 } });
  assert.equal(await w.message({ type: 'claim-pending-query', windowId: 2 }), null);
  const results = await Promise.all([1, 2].map(() => w.message({ type: 'claim-pending-query', windowId: 1 })));
  assert.equal(results.filter(Boolean).length, 1);
});
