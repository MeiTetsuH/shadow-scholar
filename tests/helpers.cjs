const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const read = file => fs.readFileSync(file, 'utf8');
function event() {
  const listeners = [];
  return { listeners, addListener(fn) { listeners.push(fn); }, emit(...args) { return listeners.map(fn => fn(...args)); } };
}
function storage(data = {}) {
  return {
    data, accessLevel: null,
    async setAccessLevel(options) { this.accessLevel = options.accessLevel; },
    async get(keys, callback) {
      const value = keys == null ? { ...data } : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter(k => k in data).map(k => [k, data[k]]));
      callback?.(structuredClone(value)); return structuredClone(value);
    },
    async set(value, callback) { Object.assign(data, structuredClone(value)); callback?.(); },
    async remove(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key]; }
  };
}
function chromeMock(data = {}) {
  const messages = require('../_locales/en/messages.json');
  return {
    runtime: { id: 'test-extension', getURL: path => 'chrome-extension://test-extension/' + path,
      onInstalled: event(), onStartup: event(), onMessage: event(), onConnect: event(), getPlatformInfo: async () => ({ os: 'mac' }) },
    i18n: { getMessage: key => messages[key]?.message || '' },
    storage: { local: storage(data), session: storage(), onChanged: event() },
    action: { onClicked: event() },
    sidePanel: { setPanelBehavior: async () => {}, open: async () => {} },
    contextMenus: { onClicked: event(), removeAll: cb => cb(), create: () => {} },
    scripting: { getRegisteredContentScripts: async () => [], registerContentScripts: async () => {}, updateContentScripts: async () => {}, unregisterContentScripts: async () => {} },
    windows: { getCurrent: async () => ({ id: 1 }) },
    tabs: { query: async () => [{ id: 7, windowId: 1, url: 'https://example.com/' }], sendMessage: async () => {} }
  };
}
function worker(data = {}, fetcher) {
  const chrome = chromeMock(data);
  let context;
  context = vm.createContext({ chrome, URL, TextDecoder, AbortController, ReadableStream, Response, crypto: globalThis.crypto, console, setTimeout, clearTimeout, setInterval, clearInterval, navigator: { language: 'en' },
    fetch: fetcher || (async url => new Response(read(url.split('test-extension/')[1]))),
    importScripts: (...files) => files.forEach(file => vm.runInContext(read(file), context)) });
  vm.runInContext(read('background.js'), context);
  const trusted = { id: chrome.runtime.id, url: chrome.runtime.getURL('sidepanel.html') };
  const content = { id: chrome.runtime.id, url: 'https://example.com/', tab: { id: 7, windowId: 1 } };
  function message(value, sender = trusted) { return new Promise(resolve => chrome.runtime.onMessage.listeners[0](value, sender, resolve)); }
  return { chrome, context, trusted, content, message };
}
function port(sender) {
  const result = { name: 'llm-stream', sender, onMessage: event(), onDisconnect: event(), received: [], closed: false,
    postMessage(message) { this.received.push(message); },
    disconnect() { if (!this.closed) { this.closed = true; this.onDisconnect.emit(); } }
  }; return result;
}
function dom(html = '<main></main>') {
  const instance = new JSDOM(html, { url: 'chrome-extension://test-extension/sidepanel.html', runScripts: 'outside-only', pretendToBeVisual: true });
  instance.window.chrome = chromeMock();
  return instance;
}
const load = (window, ...files) => files.forEach(file => window.eval(read(file)));
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
module.exports = { read, event, storage, chromeMock, worker, port, dom, load, tick };
