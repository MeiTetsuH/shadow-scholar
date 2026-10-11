const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { read, dom, load } = require('./helpers.cjs');
const scope = vm.createContext({ URL, TextDecoder });
vm.runInContext(read('settings.js'), scope);
vm.runInContext(read('stream.js'), scope);
const S = scope.ShadowScholarSettings;
const parse = scope.ShadowScholarStream.readChatStream;
const data = text => `data:${JSON.stringify({ choices: [{ delta: { content: text } }] })}`;
function stream(text, step = 1) {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i += step) controller.enqueue(bytes.slice(i, i + step)); controller.close(); } });
}
for (const [input, expected] of [
  ['https://api.openai.com/v1/', 'https://api.openai.com/v1/chat/completions'],
  ['https://api.openai.com', 'https://api.openai.com/v1/chat/completions'],
  ['https://openrouter.ai/api/v1?route=a', 'https://openrouter.ai/api/v1/chat/completions?route=a'],
  ['https://example.com/custom/v2', 'https://example.com/custom/v2/chat/completions'],
  ['https://example.com/chat/completions?q=a', 'https://example.com/chat/completions?q=a'],
  ['http://localhost:11434/api/chat', 'http://localhost:11434/v1/chat/completions'],
  ['http://[::1]:11434/v1', 'http://[::1]:11434/v1/chat/completions']
]) test(`API URL: ${input}`, () => assert.equal(S.buildChatCompletionsUrl(input), expected));
test('Reject insecure, misleading loopback and credential URLs', () => {
  for (const url of ['http://example.com', 'http://localhost.example.com', 'ftp://localhost', 'https://user:password@example.com', 'https://example.com/#secret']) assert.throws(() => S.buildChatCompletionsUrl(url));
});
test('Keep existing prompts and migrate only the mismatched OpenAI default', () => {
  assert.equal(S.getMissingDefaultUpdates({ model: 'openai/gpt-5.4-mini', apiUrl: 'https://api.openai.com/v1' }).model, 'gpt-5.4-mini');
  assert.equal(S.getMissingDefaultUpdates({ model: 'openai/gpt-5.4-mini', apiUrl: 'https://openrouter.ai/api/v1' }).model, undefined);
  assert.equal(S.normalizeSettings({ systemPrompt: 'custom' }).systemPrompts.answer, 'custom');
});
test('Decode split UTF-8, optional spaces, CRLF, and unterminated final data', async () => {
  let result = '';
  await parse(stream(`${data('你好')}\r\n${data('!')}`), chunk => result += chunk);
  assert.equal(result, '你好!');
});
test('DONE cancels the reader and ignores trailing provider data', async () => {
  let result = ''; let cancelled = false;
  const body = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(`${data('ok')}\n\ndata: [DONE]\n${data('bad')}\n`)); }, cancel() { cancelled = true; } });
  await parse(body, chunk => result += chunk);
  assert.equal(result, 'ok'); assert.equal(cancelled, true); assert.equal(body.locked, false);
});
test('Reject malformed, empty and provider error streams', async () => {
  for (const text of ['data: {bad}\n', 'data: [DONE]\n', 'data: {"error":{"message":"secret"}}\n', '']) await assert.rejects(parse(stream(text), () => {}));
});
test('Cancellation aborts pending stream reads', async () => {
  const controller = new AbortController();
  const work = parse(new ReadableStream(), () => {}, controller.signal);
  controller.abort();
  await assert.rejects(work, { name: 'AbortError' });
});
test('Bound response size', async () => assert.rejects(parse(stream(`${data('x'.repeat(200001))}\n`, 250000), () => {}), /limit/));
test('Markdown strips active HTML and remote media while preserving safe formatting', () => {
  const instance = dom(); const w = instance.window;
  load(w, 'lib/marked.min.js', 'markdown.js');
  const html = w.ShadowScholarMarkdown.render('**bold** [safe](https://example.com) [bad](javascript:alert%281%29) <img src="https://tracker.example/x"> <svg onload="alert(1)"></svg> <a href="data:text/html,x" onclick="alert(1)">x</a>');
  const box = w.document.createElement('div'); box.innerHTML = html;
  assert.equal(box.querySelectorAll('img,svg,script,iframe,[onclick]').length, 0);
  assert.equal(box.querySelector('strong').textContent, 'bold');
  assert.equal([...box.querySelectorAll('a[href]')].length, 1);
  assert.equal(box.querySelector('a[href]').rel, 'noopener noreferrer'); instance.window.close();
});
test('Extraction excludes hidden/noise/form content and avoids duplicate questions', () => {
  const instance = dom('<main><nav>noise</nav><script>secret</script><div hidden>hidden</div><textarea>private draft</textarea><div class="question">A valid question <span class="question">nested detail</span></div></main>');
  load(instance.window, 'extractors.js'); const result = instance.window.ShadowScholarExtractors.extractPageContent();
  assert.equal(result.content.match(/nested detail/g).length, 1);
  assert.doesNotMatch(result.content, /noise|secret|hidden|private draft/); instance.window.close();
});
test('Large-page extraction is bounded without cloning nodes', () => {
  const instance = dom(`<main>${'visible '.repeat(20000)}</main>`);
  instance.window.Node.prototype.cloneNode = () => { throw new Error('unexpected clone'); };
  load(instance.window, 'extractors.js'); assert.ok(instance.window.ShadowScholarExtractors.extractMainContent().length <= 20000); instance.window.close();
});
test('Selection helper preserves editable paste/cut and built-in functions', () => {
  const instance = dom('<main><div id="plain">text</div><div contenteditable id="editor">draft</div></main>'); const w = instance.window;
  const originals = [w.eval, w.Function, w.EventTarget.prototype.addEventListener, w.performance.now];
  load(w, 'anti-detect.js');
  assert.deepEqual([w.eval, w.Function, w.EventTarget.prototype.addEventListener, w.performance.now], originals);
  for (const type of ['paste', 'cut', 'copy', 'selectstart', 'contextmenu']) {
    const e = new w.Event(type, { bubbles: true, cancelable: true });
    w.document.getElementById('editor').addEventListener(type, event => event.preventDefault());
    w.document.getElementById('editor').dispatchEvent(e); assert.equal(e.defaultPrevented, true, type);
  }
  const copy = new w.Event('copy', { bubbles: true, cancelable: true });
  w.document.getElementById('plain').addEventListener('copy', e => e.preventDefault());
  w.document.getElementById('plain').dispatchEvent(copy); assert.equal(copy.defaultPrevented, false); instance.window.close();
});
