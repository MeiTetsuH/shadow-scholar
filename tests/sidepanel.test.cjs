const { test } = require('node:test');
const assert = require('node:assert/strict');
const { dom, load, read, event, tick } = require('./helpers.cjs');
async function panel() {
  const instance = dom(read('sidepanel.html')); const w = instance.window;
  w.console = { log() {}, error() {} };
  const ports = []; let copied;
  Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async text => { copied = text; } } });
  const messages = JSON.parse(read('_locales/en/messages.json'));
  w.chrome.runtime.sendMessage = async msg => {
    if (msg.type === 'get-ui-settings') return { language: 'en', mode: 'answer', messages };
    if (msg.type === 'get-settings') return { apiUrl: 'https://api.example.com/v1', apiKey: 'test-key', model: 'test-model' };
    if (msg.type === 'claim-pending-query') return null;
    return { success: true };
  };
  w.chrome.runtime.connect = () => {
    const p = { onMessage: event(), onDisconnect: event(), sent: [], closed: false,
      postMessage(msg) { this.sent.push(msg); }, disconnect() { if (!this.closed) { this.closed = true; this.onDisconnect.emit(); } } };
    ports.push(p); return p;
  };
  load(w, 'i18n.js', 'prompts.js', 'settings.js', 'lib/marked.min.js', 'markdown.js', 'sidepanel.js');
  await tick();
  return { instance, w, ports, copied: () => copied };
}
test('Panel initializes, copies with event listeners, and uses session-only keys', async () => {
  const p = await panel(); const doc = p.w.document;
  assert.equal(doc.getElementById('setting-model').value, 'test-model');
  doc.getElementById('input-text').value = 'A question'; doc.getElementById('btn-send').click();
  p.ports[0].onMessage.emit({ type: 'chunk', content: '**An answer**' }); p.ports[0].onMessage.emit({ type: 'done' });
  doc.querySelector('.message-ai .message-action-btn').click(); await tick();
  assert.equal(p.copied().trim(), 'An answer'); assert.equal(doc.querySelectorAll('[onclick]').length, 0);
  doc.getElementById('setting-data-consent').checked = true; doc.getElementById('btn-save-settings').click(); await tick();
  assert.equal(p.w.chrome.storage.session.data.apiKey, 'test-key'); assert.equal(p.w.chrome.storage.local.data.apiKey, undefined);
  assert.equal(p.w.chrome.storage.local.data.dataConsentEndpoint, 'https://api.example.com/v1/chat/completions');
  p.instance.window.close();
});
test('IME Enter does not send and unexpected disconnect is an error', async () => {
  const p = await panel(); const doc = p.w.document; const input = doc.getElementById('input-text'); input.value = '中文输入';
  input.dispatchEvent(new p.w.KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true })); assert.equal(p.ports.length, 0);
  doc.getElementById('btn-send').click(); p.ports[0].disconnect();
  assert.match(doc.querySelector('.message-ai').textContent, /disconnected|connection/i); assert.equal(doc.getElementById('btn-send').disabled, false); p.instance.window.close();
});
test('Clearing a stream ignores stale chunks from the old port', async () => {
  const p = await panel(); const doc = p.w.document;
  doc.getElementById('input-text').value = 'first'; doc.getElementById('btn-send').click(); const old = p.ports[0];
  old.onMessage.emit({ type: 'chunk', content: 'partial' }); doc.getElementById('btn-clear').click();
  doc.getElementById('input-text').value = 'second'; doc.getElementById('btn-send').click();
  old.onMessage.emit({ type: 'chunk', content: 'stale' }); p.ports[1].onMessage.emit({ type: 'chunk', content: 'fresh' }); p.ports[1].onMessage.emit({ type: 'done' });
  assert.doesNotMatch(doc.getElementById('messages').textContent, /stale|partial/); assert.match(doc.getElementById('messages').textContent, /fresh/); p.instance.window.close();
});
test('Streaming render coalesces bursts rather than rebuilding for every token', async () => {
  const p = await panel(); const doc = p.w.document;
  doc.getElementById('input-text').value = 'test'; doc.getElementById('btn-send').click();
  let renders = 0; const original = p.w.ShadowScholarMarkdown;
  p.w.ShadowScholarMarkdown = { render(text) { renders++; return original.render(text); } };
  for (let i = 0; i < 100; i++) p.ports[0].onMessage.emit({ type: 'chunk', content: 'word ' });
  await new Promise(resolve => setTimeout(resolve, 100)); assert.ok(renders <= 2, `rendered ${renders} times`);
  p.ports[0].onMessage.emit({ type: 'done' }); assert.equal(doc.querySelector('.message-ai .message-content').textContent.trim().split(' ').length, 100); p.instance.window.close();
});
