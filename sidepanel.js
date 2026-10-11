/**
 * 影学者 - Side Panel 逻辑
 * 对话管理、流式渲染、设置管理
 * 
 * 日志前缀: [影学者:SP]
 */

// ============================
// 日志系统
// ============================
const LOG_PREFIX = '[影学者:SP]';

function log(...args) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${LOG_PREFIX} ${timestamp}`, ...args);
  storeLog('INFO', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
}

function logError(...args) {
  const timestamp = new Date().toLocaleTimeString();
  console.error(`${LOG_PREFIX} ${timestamp}`, ...args);
  storeLog('ERROR', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
}

function storeLog() {
  // Diagnostics stay in DevTools; do not persist user content or credentials.
}

function maskUrlForLog(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}/...`;
  } catch (e) {
    return '[custom-api-url]';
  }
}

// ============================
// DOM 元素引用
// ============================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const Prompts = globalThis.ShadowScholarPrompts;
const Settings = globalThis.ShadowScholarSettings;
const I18n = globalThis.ShadowScholarI18n;
let MODE_META = {
  answer: { label: '🎯 Answer Mode', badgeClass: '' },
  idea: { label: '💡 Idea Mode', badgeClass: 'idea' },
  personality: { label: '📸 Screenshot Mode', badgeClass: 'personality' }
};
function refreshModeMeta() {
  MODE_META = {
    answer: { label: I18n.t('modeAnswer'), badgeClass: '' },
    idea: { label: I18n.t('modeIdea'), badgeClass: 'idea' },
    personality: { label: I18n.t('modeScreenshot'), badgeClass: 'personality' }
  };
}

const elements = {
  chatArea: $('#chat-area'),
  messages: $('#messages'),
  welcome: $('#welcome'),
  typingIndicator: $('#typing-indicator'),
  inputText: $('#input-text'),
  btnSend: $('#btn-send'),
  btnClear: $('#btn-clear'),
  btnSettings: $('#btn-settings'),
  btnCloseSettings: $('#btn-close-settings'),
  settingsOverlay: $('#settings-overlay'),
  settingsPanel: $('#settings-panel'),
  btnSaveSettings: $('#btn-save-settings'),
  btnAnalyzePage: $('#btn-analyze-page'),
  btnAnalyzeSelection: $('#btn-analyze-selection'),
  btnQuickPage: $('#btn-quick-page'),
  btnQuickSelection: $('#btn-quick-selection'),
  // 设置字段
  settingApiUrl: $('#setting-api-url'),
  settingApiKey: $('#setting-api-key'),
  settingModel: $('#setting-model'),
  settingSystemPrompt: $('#setting-system-prompt'),
  settingAntiDetect: $('#setting-anti-detect'),
  toggleKeyVisibility: $('#toggle-key-visibility'),
};

// ============================
// 状态管理
// ============================
let conversationMessages = []; // 对话历史 [{role, content}]
let isStreaming = false;
let currentPort = null;
let currentAiMessageEl = null;
let streamedContent = '';
let currentSettings = Settings.normalizeSettings({});
let currentWindowId;
let renderTimer = null;
let settingPromptMode = 'answer';
const importedInlineRecordIds = new Set();

// ============================
// 初始化
// ============================
document.addEventListener('DOMContentLoaded', async () => {
  log('Side Panel 开始初始化');
  await I18n.initI18n();
  refreshModeMeta();
  I18n.applyI18n();
  currentWindowId = (await chrome.windows.getCurrent()).id;
  await loadSettings();
  setupEventListeners();
  setupMarkdown();
  listenForContextMenuQueries();
  updateConnectionStatus();
  updateModeBadge();

  // 检查是否有待处理的查询（来自右键菜单）
  checkPendingQuery();

  // 点击状态指示器打开设置
  const statusEl = document.getElementById('topbar-status');
  if (statusEl) {
    statusEl.addEventListener('click', () => openSettings());
  }

  // 监听模式变化（用户在 popup 中切换模式时实时更新）
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.pendingQuery || changes.pendingInlineRecords) checkPendingQuery();
    if (changes.mode) {
      updateModeBadge(changes.mode.newValue);
      setTopbarMode(changes.mode.newValue);
      currentSettings.mode = changes.mode.newValue || 'answer';
      setSystemPromptEditorMode(currentSettings.mode, { preserveDraft: true });
    }

    if (changes.systemPrompts) {
      currentSettings.systemPrompts = Settings.normalizeSystemPrompts({
        ...currentSettings,
        systemPrompts: changes.systemPrompts.newValue
      });
      setSystemPromptEditorMode(settingPromptMode);
    }
  });

  log('Side Panel 初始化完成');
});

/**
 * 更新欢迎页面的模式徽章
 */
function updateModeBadge(mode) {
  const badge = document.getElementById('mode-badge');
  if (!badge) return;

  if (mode) {
    applyModeBadge(badge, mode);
  } else {
    chrome.storage.local.get('mode', (result) => {
      applyModeBadge(badge, result.mode || 'answer');
    });
  }
}

function applyModeBadge(badge, mode) {
  const meta = MODE_META[mode] || MODE_META.answer;
  badge.textContent = meta.label;
  badge.classList.remove('idea', 'personality');
  if (meta.badgeClass) badge.classList.add(meta.badgeClass);
}

/**
 * 更新顶部连接状态指示器
 */
async function updateConnectionStatus() {
  const statusEl = document.getElementById('topbar-status');
  if (!statusEl) return;
  try {
    const result = await chrome.runtime.sendMessage({ type: 'get-settings' });
    const endpoint = Settings.buildChatCompletionsUrl(result.apiUrl);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(endpoint).hostname);
    const configured = Boolean((result.apiKey || local) && result.dataConsentEndpoint === endpoint);
    statusEl.classList.toggle('connected', configured);
    statusEl.title = I18n.t(configured ? 'statusConnected' : 'statusNotConnected');
  } catch { statusEl.classList.remove('connected'); }
}

function setupMarkdown() {
  if (typeof marked !== 'undefined') {
    marked.setOptions({
      breaks: true,
      gfm: true
    });
    log('Markdown 渲染器已初始化');
  } else {
    logError('marked.js 未加载');
  }
}

// ============================
// 检查待处理查询（从 storage 消息队列）
// ============================
async function checkPendingQuery() {
  try {
    const result = await chrome.storage.local.get(['pendingQuery', 'pendingAction', 'pendingInlineRecords']);

    if (Array.isArray(result.pendingInlineRecords) && result.pendingInlineRecords.length > 0) {
      let importedCount = 0;
      result.pendingInlineRecords.forEach((record) => {
        if (record.windowId != null && record.windowId !== currentWindowId) return;
        if (importInlineAnswerRecord(record, { silent: true })) importedCount++;
        if (record?.id) acknowledgeInlineRecord(record.id);
      });
      if (importedCount > 0) {
        showToast(I18n.t('toastImportedRecords', importedCount), 'success');
      }
    }
    
    if (!isStreaming) {
      const query = await chrome.runtime.sendMessage({ type: 'claim-pending-query', windowId: currentWindowId });
      if (query?.prompt) sendMessage(query.prompt, { useScreenshot: query.useScreenshot, tabId: query.tabId });
    }

    // 检查待处理操作（如打开设置）
    if (result.pendingAction) {
      const { type, timestamp } = result.pendingAction;
      const age = Date.now() - timestamp;
      if (age < 10000) {
        await chrome.storage.local.remove('pendingAction');
        if (type === 'open-settings') {
          log('执行待处理操作: 打开设置');
          setTimeout(() => openSettings(), 400);
        }
      } else {
        await chrome.storage.local.remove('pendingAction');
      }
    }
  } catch (e) {
    logError('检查待处理查询失败:', e.message);
  }
}

// ============================
// 事件绑定
// ============================
function setupEventListeners() {
  // 发送消息
  elements.btnSend.addEventListener('click', handleSend);
  elements.inputText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      handleSend();
    }
  });

  // 自动调整输入框高度
  elements.inputText.addEventListener('input', () => {
    elements.inputText.style.height = 'auto';
    elements.inputText.style.height = Math.min(elements.inputText.scrollHeight, 120) + 'px';
  });

  // 清除对话
  elements.btnClear.addEventListener('click', clearConversation);

  // 设置面板
  elements.btnSettings.addEventListener('click', openSettings);
  elements.btnCloseSettings.addEventListener('click', closeSettings);
  elements.settingsOverlay.addEventListener('click', (e) => {
    if (e.target === elements.settingsOverlay) closeSettings();
  });
  elements.btnSaveSettings.addEventListener('click', saveSettings);
  elements.settingApiUrl.addEventListener('input', () => { document.getElementById('setting-data-consent').checked = false; });
  document.getElementById('btn-clear-history').addEventListener('click', async () => {
    const result = await chrome.runtime.sendMessage({ type: 'clear-local-history' });
    if (result?.success) { clearConversation(); showToast(I18n.t('toastHistoryCleared'), 'success'); }
  });

  // API Key 显示切换
  elements.toggleKeyVisibility.addEventListener('click', () => {
    const input = elements.settingApiKey;
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  // 快捷操作
  elements.btnAnalyzePage.addEventListener('click', () => analyzeContent('page'));
  elements.btnAnalyzeSelection.addEventListener('click', () => analyzeContent('selection'));
  elements.btnQuickPage.addEventListener('click', () => analyzeContent('page'));
  elements.btnQuickSelection.addEventListener('click', () => analyzeContent('selection'));

  // 顶栏模式切换
  const modeButtons = document.querySelectorAll('.topbar-mode-btn');
  if (modeButtons.length > 0) {
    modeButtons.forEach((btn) => {
      btn.addEventListener('click', () => switchMode(btn.dataset.mode || 'answer'));
    });
    // 初始化模式按钮状态
    chrome.storage.local.get('mode', (result) => {
      setTopbarMode(result.mode || 'answer');
    });
  }

  log('事件监听器已绑定');
}

/**
 * 切换模式
 */
function switchMode(mode) {
  chrome.storage.local.set({ mode }, () => {
    currentSettings.mode = mode;
    setTopbarMode(mode);
    updateModeBadge(mode);
    setSystemPromptEditorMode(mode, { preserveDraft: true });
    const label = (MODE_META[mode] || MODE_META.answer).label;
    showToast(I18n.t('toastModeSwitched', label), 'success');
    log('模式已切换:', mode);
  });
}

function setTopbarMode(mode) {
  document.querySelectorAll('.topbar-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
}

function getModeLabel(mode) {
  return (MODE_META[mode] || MODE_META.answer).label.replace(/^[^\s]+ /, '');
}

function rememberSystemPromptDraft() {
  if (!elements.settingSystemPrompt) return;

  currentSettings.systemPrompts = {
    ...Settings.normalizeSystemPrompts(currentSettings),
    [settingPromptMode]: elements.settingSystemPrompt.value
  };
  currentSettings.systemPrompt = currentSettings.systemPrompts.answer;
}

function setSystemPromptEditorMode(mode, { preserveDraft = false } = {}) {
  if (!elements.settingSystemPrompt) return;

  if (preserveDraft) {
    rememberSystemPromptDraft();
  }

  settingPromptMode = mode || 'answer';
  const systemPrompts = Settings.normalizeSystemPrompts(currentSettings);
  elements.settingSystemPrompt.value = systemPrompts[settingPromptMode] || '';
  elements.settingSystemPrompt.placeholder = I18n.t('systemPromptFor', getModeLabel(settingPromptMode));

  const label = document.querySelector('label[for="setting-system-prompt"]');
  if (label) {
    label.textContent = I18n.t('systemPromptLabel', getModeLabel(settingPromptMode));
  }
}

// ============================
// 监听来自右键菜单的查询（直接消息方式）
// ============================
function listenForContextMenuQueries() {
  chrome.runtime.onMessage.addListener((message) => {
    log('收到运行时消息:', message.type);
    if (message.type === 'inline-answer-record' && message.record) {
      importInlineAnswerRecord(message.record);
      if (message.record.id) {
        acknowledgeInlineRecord(message.record.id);
      }
      return;
    }

    if (message.type === 'open-settings') {
      openSettings();
    }
  });
  log('右键菜单查询监听器已注册');
}

function acknowledgeInlineRecord(recordId) {
  try {
    chrome.runtime.sendMessage({
      type: 'ack-inline-record',
      recordId
    });
  } catch (e) {}
}

function importInlineAnswerRecord(record, { silent = false } = {}) {
  if (!record || !record.id || importedInlineRecordIds.has(record.id)) return false;

  const question = String(record.question || '').trim();
  const answer = String(record.answer || '').trim();
  if (!question || !answer) return false;

  importedInlineRecordIds.add(record.id);

  const label = record.mode === 'personality'
    ? I18n.t('labelScreenshotQA')
    : I18n.t('labelInlineQA');
  const userContent = `[${label}]\n\n${question}`;

  elements.welcome.classList.add('hidden');
  addMessage('user', userContent);
  addMessage('ai', answer);
  conversationMessages.push({ role: 'user', content: userContent });
  conversationMessages.push({ role: 'assistant', content: answer });

  log('内联问答记录已导入侧边栏:', {
    id: record.id,
    mode: record.mode || 'answer',
    auto: record.auto === true
  });

  if (!silent) {
    showToast(record.auto ? I18n.t('toastScreenshotSynced') : I18n.t('toastSyncedToSidebar'), 'success');
  }

  scrollToBottom();
  return true;
}

// ============================
// 消息发送
// ============================
function handleSend() {
  const text = elements.inputText.value.trim();
  if (!text || isStreaming) return;

  sendMessage(text);
  elements.inputText.value = '';
  elements.inputText.style.height = 'auto';
}

function sendMessage(text, options = {}) {
  if (isStreaming) {
    log('正在流式输出中, 忽略发送请求');
    return;
  }

  const useScreenshot = options.useScreenshot === true || currentSettings.mode === 'personality';
  log('发送消息, 长度:', text.length);

  // 隐藏欢迎界面
  elements.welcome.classList.add('hidden');

  // 添加用户消息
  addMessage('user', text);
  conversationMessages.push({ role: 'user', content: text });

  // 开始流式请求
  startStreaming({ useScreenshot, tabId: options.tabId });
}

// ============================
// 分析内容
// ============================
async function analyzeContent(type) {
  if (isStreaming) return;

  log('分析内容:', type);

  try {
    if (currentSettings.mode === 'personality') {
      showToast(I18n.t('toastCapturing'));
      const prompt = type === 'selection'
        ? I18n.t('promptScreenshotSelection')
        : I18n.t('promptScreenshotPage');
      sendMessage(prompt, { useScreenshot: true });
      return;
    }

    if (type === 'page') {
      showToast(I18n.t('toastFetchingPage'));
      chrome.runtime.sendMessage({ type: 'get-page-content', windowId: currentWindowId }, (response) => {
        log('页面内容响应:', response ? 'OK' : 'null', chrome.runtime.lastError?.message || '');
        if (chrome.runtime.lastError) {
          logError('获取页面内容错误:', chrome.runtime.lastError.message);
          showToast(I18n.t('toastPageContentError', chrome.runtime.lastError.message), 'error');
          return;
        }
        if (response?.error) { showToast(response.error, 'error'); return; }
        if (response && response.content) {
          sendMessage(Prompts.buildPageAnalysisPrompt({
            title: response.title || '',
            content: response.content
          }));
        } else {
          showToast(I18n.t('toastPageContentEmpty'), 'error');
          logError('页面内容为空');
        }
      });
    } else if (type === 'selection') {
      chrome.runtime.sendMessage({ type: 'get-selected-text', windowId: currentWindowId }, (response) => {
        log('Selection response received:', Boolean(response?.text));
        if (chrome.runtime.lastError) {
          logError('获取选中文字错误:', chrome.runtime.lastError.message);
          showToast(I18n.t('toastSelectionError'), 'error');
          return;
        }
        if (response?.error) { showToast(response.error, 'error'); return; }
        if (response && response.text && response.text.trim()) {
          sendMessage(Prompts.buildSelectionAnalysisPrompt(response.text));
        } else {
          showToast(I18n.t('toastSelectFirst'), 'error');
        }
      });
    }
  } catch (e) {
    logError('分析内容异常:', e.message);
    showToast(I18n.t('toastOperationFailed', e.message), 'error');
  }
}

// ============================
// 流式对话
// ============================
function startStreaming({ useScreenshot = false, tabId } = {}) {
  isStreaming = true;
  elements.btnSend.disabled = true;
  streamedContent = '';

  // 显示打字指示器
  elements.typingIndicator.style.display = 'flex';
  scrollToBottom();

  log('建立 Port 连接...');

  // 建立 Port 连接
  currentPort = chrome.runtime.connect({ name: 'llm-stream' });

  const port = currentPort;
  port.onMessage.addListener((msg) => {
    if (currentPort !== port) return;
    if (msg.type === 'chunk') {
      handleStreamChunk(msg.content);
    } else if (msg.type === 'done') {
      log('流式输出完成');
      handleStreamDone();
    } else if (msg.type === 'error') {
      logError('流式输出错误:', msg.error);
      handleStreamError(msg.error);
    }
  });

  port.onDisconnect.addListener(() => {
    if (currentPort !== port) return;
    log('Port 断开连接');
    if (isStreaming) {
      handleStreamError(I18n.t('panelErrorDisconnected'));
    }
  });

  // 发送消息
  currentPort.postMessage({
    action: useScreenshot ? 'chat-screenshot' : 'chat',
    messages: [...conversationMessages], windowId: currentWindowId, tabId
  });
  log('Chat 请求已发送, 消息数:', conversationMessages.length, '截图:', useScreenshot);
}

function handleStreamChunk(content) {
  // 隐藏打字指示器
  if (elements.typingIndicator.style.display !== 'none') {
    elements.typingIndicator.style.display = 'none';
  }

  // 创建或追加 AI 消息
  if (!currentAiMessageEl) {
    currentAiMessageEl = addMessage('ai', '');
  }

  streamedContent += content;

  if (renderTimer === null) renderTimer = setTimeout(renderStreamFrame, 80);
}

function renderStreamFrame() {
  clearTimeout(renderTimer);
  renderTimer = null;
  const bubble = currentAiMessageEl?.querySelector('.message-content');
  if (bubble) {
    bubble.innerHTML = renderMarkdown(streamedContent);
    bubble.classList.add('streaming-cursor');
  }
  scrollToBottom();
}

function handleStreamDone() {
  clearTimeout(renderTimer);
  renderTimer = null;
  isStreaming = false;
  elements.btnSend.disabled = false;
  elements.typingIndicator.style.display = 'none';

  if (currentAiMessageEl) {
    const bubble = currentAiMessageEl.querySelector('.message-content');
    if (bubble) {
      bubble.classList.remove('streaming-cursor');
      bubble.innerHTML = renderMarkdown(streamedContent);
      addCopyButtonsToCode(currentAiMessageEl);
    }
  }

  // 保存到对话历史
  if (streamedContent) {
    conversationMessages.push({ role: 'assistant', content: streamedContent });
    log('AI 回复已保存, 长度:', streamedContent.length);
  }

  currentAiMessageEl = null;
  streamedContent = '';
  const finishedPort = currentPort;
  currentPort = null;
  finishedPort?.disconnect();
  checkPendingQuery();

  scrollToBottom();
}

function handleStreamError(error) {
  clearTimeout(renderTimer);
  renderTimer = null;
  isStreaming = false;
  elements.btnSend.disabled = false;
  elements.typingIndicator.style.display = 'none';

  if (!currentAiMessageEl) {
    currentAiMessageEl = addMessage('ai', '');
  }

  const bubble = currentAiMessageEl.querySelector('.message-content');
  if (bubble) {
    bubble.classList.remove('streaming-cursor');
    bubble.innerHTML = `<span style="color: #ef4444;">❌ ${escapeHtml(error)}</span>`;
  }

  currentAiMessageEl = null;
  streamedContent = '';
  const failedPort = currentPort;
  currentPort = null;
  failedPort?.disconnect();
  showToast(error, 'error');
}

// ============================
// UI 操作
// ============================
function addMessage(role, content) {
  const div = document.createElement('div');
  div.className = `message message-${role}`;

  const avatar = role === 'user'
    ? '👤'
    : '<img src="icons/icon48.png" alt="" aria-hidden="true">';
  const renderedContent = role === 'ai' ? renderMarkdown(content) : escapeHtml(content);

  div.innerHTML = `
    <div class="message-avatar">${avatar}</div>
    <div class="message-bubble">
      <div class="message-content">${renderedContent}</div>
      <div class="message-actions">
        <button class="message-action-btn" title="${I18n.t('btnCopyTitle')}">📋</button>
      </div>
    </div>
  `;

  div.querySelector('.message-action-btn').addEventListener('click', event => copyMessageContent(event.currentTarget));
  elements.messages.appendChild(div);

  if (role === 'ai') {
    addCopyButtonsToCode(div);
  }

  scrollToBottom();
  return div;
}

function clearConversation() {
  clearTimeout(renderTimer);
  renderTimer = null;
  const port = currentPort;
  currentPort = null;
  isStreaming = false;
  port?.disconnect();
  currentAiMessageEl = null;
  streamedContent = '';
  elements.btnSend.disabled = false;
  elements.typingIndicator.style.display = 'none';
  conversationMessages = [];
  elements.messages.innerHTML = '';
  elements.welcome.classList.remove('hidden');

  log('对话已清除');
  showToast(I18n.t('toastConversationCleared'), 'success');
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    elements.chatArea.scrollTop = elements.chatArea.scrollHeight;
  });
}

// ============================
// Markdown 渲染
// ============================
function renderMarkdown(text) {
  if (!text) return '';
  if (typeof marked !== 'undefined') {
    try {
      return globalThis.ShadowScholarMarkdown.render(text);
    } catch (e) {
      logError('Markdown 渲染失败:', e.message);
      return escapeHtml(text);
    }
  }
  return escapeHtml(text).replace(/\n/g, '<br>');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================
// 代码块复制按钮
// ============================
function addCopyButtonsToCode(container) {
  const codeBlocks = container.querySelectorAll('pre');
  codeBlocks.forEach((pre) => {
    if (pre.parentElement.classList.contains('code-block-wrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper';
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);

    const btn = document.createElement('button');
    btn.className = 'code-copy-btn';
    btn.textContent = I18n.t('btnCopy');
    btn.addEventListener('click', () => {
      const code = pre.querySelector('code');
      const text = code ? code.textContent : pre.textContent;
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = I18n.t('btnCopied');
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = I18n.t('btnCopy');
          btn.classList.remove('copied');
        }, 2000);
      });
    });
    wrapper.appendChild(btn);
  });
}

// 全局复制消息内容函数
function copyMessageContent(btn) {
  const bubble = btn.closest('.message-bubble');
  const content = bubble.querySelector('.message-content');
  const text = content.textContent || content.innerText;
  navigator.clipboard.writeText(text).then(() => {
    showToast(I18n.t('toastCopied'), 'success');
  });
};

// ============================
// Toast 提示
// ============================
function showToast(message, type = '') {
  const existing = document.querySelector('.status-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `status-toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============================
// 设置管理
// ============================
function openSettings() {
  elements.settingsOverlay.classList.add('active');
  log('设置面板已打开');
}

function closeSettings() {
  elements.settingsOverlay.classList.remove('active');
}

async function loadSettings() {
      const result = await chrome.runtime.sendMessage({ type: 'get-settings' });
      const settings = Settings.normalizeSettings(result);
      currentSettings = settings;
      settingPromptMode = settings.mode || 'answer';

      elements.settingApiUrl.value = settings.apiUrl;
      if (settings.apiKey) elements.settingApiKey.value = settings.apiKey;
      elements.settingModel.value = settings.model;
      elements.settingAntiDetect.checked = settings.antiDetect;
      try { document.getElementById('setting-data-consent').checked = settings.dataConsentEndpoint === Settings.buildChatCompletionsUrl(settings.apiUrl); } catch {};
      setSystemPromptEditorMode(settingPromptMode);
      const langSelect = document.getElementById('setting-language');
      if (langSelect) langSelect.value = settings.language || I18n.detectLanguage();
      log('设置已加载:', {
        apiUrl: maskUrlForLog(settings.apiUrl),
        model: settings.model,
        mode: settings.mode,
        apiKey: settings.apiKey ? '***已设置***' : '(未设置)',
        antiDetect: settings.antiDetect
      });
}

async function saveSettings() {
  rememberSystemPromptDraft();
  const systemPrompts = Settings.normalizeSystemPrompts(currentSettings);
  const newLang = document.getElementById('setting-language')?.value || '';
  const settings = {
    apiUrl: elements.settingApiUrl.value.trim(),
    apiKey: elements.settingApiKey.value.trim(),
    model: elements.settingModel.value.trim(),
    systemPrompt: systemPrompts.answer,
    systemPrompts,
    antiDetect: elements.settingAntiDetect.checked,
    language: newLang,
  };

  try {
    const endpoint = Settings.buildChatCompletionsUrl(settings.apiUrl);
    settings.dataConsentEndpoint = document.getElementById('setting-data-consent').checked ? endpoint : '';
    const oldLanguage = currentSettings.language || I18n.detectLanguage();
    await chrome.storage.session.set({ apiKey: settings.apiKey });
    const { apiKey, ...persistentSettings } = settings;
    await chrome.storage.local.set(persistentSettings);
    currentSettings = Settings.normalizeSettings({ ...currentSettings, ...settings });
    showToast(newLang !== oldLanguage ? I18n.t('toastLanguageChanged') : I18n.t('toastSettingsSaved'), 'success');
    updateConnectionStatus();
    closeSettings();
  } catch (error) { showToast(error.message, 'error'); }

}
