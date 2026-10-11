/* Shadow Scholar: privileged storage, user-triggered extraction, and bounded streaming. */
importScripts('i18n.js', 'prompts.js', 'settings.js', 'stream.js');
const Settings = globalThis.ShadowScholarSettings;
const Prompts = globalThis.ShadowScholarPrompts;
const storageReady = (async () => {
  await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  const { apiKey } = await chrome.storage.local.get('apiKey');
  if (apiKey) {
    await chrome.storage.session.set({ apiKey });
    await chrome.storage.local.remove('apiKey');
  }
})();
let mutationQueue = Promise.resolve();
let scriptQueue = Promise.resolve();
const localeCache = new Map();

function mutateStorage(operation) {
  const next = mutationQueue.catch(() => {}).then(() => storageReady).then(operation);
  mutationQueue = next;
  return next;
}
function trustedPage(sender) {
  return sender.id === chrome.runtime.id && !sender.tab &&
    sender.url?.startsWith(chrome.runtime.getURL(''));
}
async function settings() {
  await storageReady;
  return Settings.normalizeSettings({ ...await chrome.storage.local.get(Settings.SETTINGS_KEYS), ...await chrome.storage.session.get('apiKey') });
}
async function publicSettings() {
  await storageReady;
  const { mode = 'answer', language = '' } = await chrome.storage.local.get(['mode', 'language']);
  const lang = language || globalThis.ShadowScholarI18n.detectLanguage();
  if (!localeCache.has(lang)) {
    const dir = lang === 'zh' ? 'zh_CN' : 'en';
    localeCache.set(lang, fetch(chrome.runtime.getURL(`_locales/${dir}/messages.json`)).then(r => r.json()));
  }
  return { mode, language: lang, messages: await localeCache.get(lang) };
}
async function syncPageHelper(enabled) {
  const id = Settings.ANTI_DETECT_SCRIPT_ID;
  const scripts = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
  if (!enabled) {
    if (scripts.length) await chrome.scripting.unregisterContentScripts({ ids: [id] });
    return;
  }
  const script = { id, matches: ['http://*/*', 'https://*/*'], js: ['anti-detect.js'], runAt: 'document_start', world: 'MAIN' };
  if (scripts.length) await chrome.scripting.updateContentScripts([script]);
  else await chrome.scripting.registerContentScripts([script]);
}
function queuePageHelper(enabled) {
  scriptQueue = scriptQueue.catch(() => {}).then(() => syncPageHelper(enabled));
  return scriptQueue;
}
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
chrome.action.onClicked.addListener(tab => {
  // An action click grants activeTab as well as opening the panel.
  if (tab.id) chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
});
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'ninja-answer', title: chrome.i18n.getMessage('contextMenuAnswer'), contexts: ['selection'], documentUrlPatterns: ['http://*/*', 'https://*/*'] });
  });
  mutateStorage(async () => {
    const current = await chrome.storage.local.get(Settings.SETTINGS_KEYS);
    await chrome.storage.local.set(Settings.getMissingDefaultUpdates(current));
    // Old diagnostic entries could contain selections or provider error bodies.
    await chrome.storage.local.remove('debugLogs');
    const saved = await chrome.storage.local.get(['inlineHistory', 'pendingInlineRecords']);
    for (const key of ['inlineHistory', 'pendingInlineRecords']) {
      if (Array.isArray(saved[key])) {
        const records = saved[key].filter(record => record && typeof record === 'object').map(({ url, title, ...record }) => record);
        while (JSON.stringify(records).length > 1500000) records.shift();
        await chrome.storage.local.set({ [key]: records.slice(key === 'inlineHistory' ? -50 : -100) });
      }
    }
    await queuePageHelper(current.antiDetect === true);
  }).catch(console.error);
});
chrome.runtime.onStartup.addListener(() => {
  settings().then(s => queuePageHelper(s.antiDetect)).catch(console.error);
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.antiDetect) queuePageHelper(changes.antiDetect.newValue === true).catch(console.error);
  if (changes.mode || changes.language) {
    publicSettings().then(async value => {
      const tabs = await chrome.tabs.query({});
      await Promise.allSettled(tabs.filter(tab => tab.id).map(tab => chrome.tabs.sendMessage(tab.id, { type: 'ui-settings-changed', settings: value })));
    }).catch(() => {});
  }
});

async function activeWebTab(windowId) {
  const tabs = await chrome.tabs.query(Number.isInteger(windowId) ? { active: true, windowId } : { active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id || !/^https?:\/\//.test(tab.url || '')) throw new Error('Open a normal HTTP or HTTPS webpage first.');
  return tab;
}
async function extract(tabId, selection) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['extractors.js'] });
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: onlySelection => onlySelection ? { text: globalThis.ShadowScholarExtractors.getSelectedText() } : globalThis.ShadowScholarExtractors.extractPageContent(),
    args: [selection]
  });
  return result?.[0]?.result || null;
}
async function capture(tabId, windowId) {
  const before = await activeWebTab(windowId);
  if (tabId && tabId !== before.id) throw new Error('The source tab is no longer active. Try again.');
  const data = await chrome.tabs.captureVisibleTab(before.windowId, { format: 'jpeg', quality: 85 });
  const after = await activeWebTab(before.windowId);
  if (after.id !== before.id || after.url !== before.url) throw new Error('The active page changed during capture. Try again.');
  return data;
}
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!info.selectionText || !tab?.id) return;
  // Opening the panel must occur synchronously in the user-gesture handler.
  chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
  mutateStorage(async () => {
    const s = await settings();
    await chrome.storage.local.set({ pendingQuery: {
      id: crypto.randomUUID(), prompt: info.selectionText.slice(0, 50000),
      useScreenshot: s.mode === 'personality', tabId: tab.id, windowId: tab.windowId, timestamp: Date.now()
    } });
  }).catch(console.error);
});
function clip(value, limit = 50000) { return String(value || '').slice(0, limit); }
function recordFrom(message, sender) {
  return {
    id: clip(message.recordId || crypto.randomUUID(), 100), question: clip(message.question),
    answer: clip(message.answer), mode: Settings.PROMPT_MODES.includes(message.mode) ? message.mode : 'answer',
    auto: message.auto === true, timestamp: Date.now(), windowId: sender.tab?.windowId,
    // URLs and titles are unnecessary for the local answer-transfer feature.
  };
}
async function handleMessage(message, sender) {
  if (message.type === 'get-ui-settings') return publicSettings();
  if (message.type === 'save-inline-history' || message.type === 'save-inline-to-sidebar') {
    const record = recordFrom(message, sender);
    if (!record.question.trim() || !record.answer.trim()) return { success: false };
    return mutateStorage(async () => {
      const key = message.type === 'save-inline-history' ? 'inlineHistory' : 'pendingInlineRecords';
      const result = await chrome.storage.local.get(key);
      let records = Array.isArray(result[key]) ? result[key] : [];
      if (!records.some(item => item.id === record.id)) records.push(record);
      records = records.slice(key === 'inlineHistory' ? -50 : -100);
      while (JSON.stringify(records).length > 1500000) records.shift();
      await chrome.storage.local.set({ [key]: records });
      return { success: true };
    });
  }
  if (!trustedPage(sender)) throw new Error('This operation is only available inside the extension.');
  if (message.type === 'get-settings') return settings();
  if (message.type === 'get-page-content' || message.type === 'get-selected-text') {
    const s = await settings();
    requireConsent(s);
    const tab = await activeWebTab(message.windowId);
    return extract(tab.id, message.type === 'get-selected-text');
  }
  if (message.type === 'claim-pending-query') {
    return mutateStorage(async () => {
      const { pendingQuery } = await chrome.storage.local.get('pendingQuery');
      if (!pendingQuery || pendingQuery.windowId !== message.windowId) return null;
      await chrome.storage.local.remove('pendingQuery');
      return Date.now() - pendingQuery.timestamp < 30000 ? pendingQuery : null;
    });
  }
  if (message.type === 'ack-inline-record') {
    return mutateStorage(async () => {
      const { pendingInlineRecords = [] } = await chrome.storage.local.get('pendingInlineRecords');
      await chrome.storage.local.set({ pendingInlineRecords: pendingInlineRecords.filter(r => r.id !== message.recordId) });
      return { success: true };
    });
  }
  if (message.type === 'clear-local-history') {
    return mutateStorage(async () => {
      await chrome.storage.local.remove(['inlineHistory', 'pendingInlineRecords', 'pendingQuery', 'debugLogs']);
      return { success: true };
    });
  }
  if (message.type === 'clear-debug-logs') {
    await chrome.storage.local.remove('debugLogs');
    return { success: true };
  }
  if (message.type === 'get-debug-logs') return [];
  return undefined;
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !message || typeof message.type !== 'string') return false;
  handleMessage(message, sender).then(respond, error => respond({ error: error.message }));
  return true;
});
function requireConsent(s) {
  const endpoint = Settings.buildChatCompletionsUrl(s.apiUrl);
  if (s.dataConsentEndpoint !== endpoint) throw new Error('Open Settings and agree to send content to your configured AI provider before using AI features.');
  return endpoint;
}
function validateMessages(messages) {
  if (!Array.isArray(messages) || !messages.length || messages.length > 200) throw new Error('Start a new conversation before sending more messages.');
  let size = 0;
  return messages.map(message => {
    if (!['user', 'assistant'].includes(message?.role) || typeof message.content !== 'string') throw new Error('Invalid chat message.');
    size += message.content.length;
    if (size > 250000) throw new Error('This conversation is too long. Clear it and start again.');
    return { role: message.role, content: message.content };
  });
}
async function runChat(message, sender, controller, send) {
  let heartbeat;
  let timeout;
  let headersTimeout;
  try {
    const s = await settings();
    const endpoint = requireConsent(s);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(endpoint).hostname);
    if (!s.apiKey && !local) throw new Error('Configure an API key in Settings first.');
    const messages = validateMessages(message.messages);
    if (message.action === 'chat-screenshot') {
      const image = await capture(sender.tab?.id || message.tabId, sender.tab?.windowId ?? message.windowId);
      const last = messages.findLastIndex(item => item.role === 'user');
      if (last < 0) throw new Error('A screenshot request needs a user message.');
      messages[last] = { role: 'user', content: [
        { type: 'text', text: Prompts.buildPersonalityScreenshotPrompt(messages[last].content) },
        { type: 'image_url', image_url: { url: image } }
      ] };
    }
    controller.signal.throwIfAborted();
    const mode = message.action === 'chat-screenshot' ? 'personality' : s.mode;
    const prompt = Prompts.getSystemPromptForMode({ ...s, mode });
    if (prompt) messages.unshift({ role: 'system', content: prompt });
    // Keep alive only while this user-requested operation is active, with a hard bound.
    heartbeat = setInterval(() => { chrome.runtime.getPlatformInfo().catch(() => {}); }, 20000);
    timeout = setTimeout(() => controller.abort(new Error('The AI request timed out after 5 minutes.')), 300000);
    headersTimeout = setTimeout(() => controller.abort(new Error('The AI provider did not respond within 25 seconds.')), 25000);
    const headers = { 'Content-Type': 'application/json' };
    if (s.apiKey) headers.Authorization = `Bearer ${s.apiKey}`;
    // Do not follow redirects with user content or credentials to another destination.
    const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ model: s.model, messages, stream: true }), signal: controller.signal, redirect: 'error', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' });
    clearTimeout(headersTimeout);
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`AI request failed (HTTP ${response.status}). Check the endpoint, key, model, and provider limits.`);
    }
    await globalThis.ShadowScholarStream.readChatStream(response.body, content => send({ type: 'chunk', content }), controller.signal);
    send({ type: 'done' });
  } catch (error) {
    if (error.name !== 'AbortError') send({ type: 'error', error: error.message || 'The AI request failed.' });
  } finally {
    clearInterval(heartbeat);
    clearTimeout(timeout);
    clearTimeout(headersTimeout);
  }
}
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'llm-stream' || port.sender?.id !== chrome.runtime.id) return;
  let controller;
  let disconnected = false;
  let started = false;
  function send(message) {
    if (disconnected) return;
    try { port.postMessage(message); } catch { controller?.abort(); }
  }
  port.onMessage.addListener(message => {
    if (started || !['chat', 'chat-screenshot'].includes(message?.action)) return;
    started = true;
    controller = new AbortController();
    runChat(message, port.sender, controller, send).finally(() => {
      if (!disconnected) port.disconnect();
    });
  });
  port.onDisconnect.addListener(() => {
    disconnected = true;
    controller?.abort();
  });
});
