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

function storeLog(level, message) {
  try {
    chrome.storage.local.get('debugLogs', (result) => {
      const logs = result.debugLogs || [];
      logs.push({
        time: new Date().toISOString(),
        level,
        source: 'sidepanel',
        message
      });
      if (logs.length > 200) logs.splice(0, logs.length - 200);
      chrome.storage.local.set({ debugLogs: logs });
    });
  } catch (e) {}
}

// ============================
// DOM 元素引用
// ============================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const Prompts = globalThis.ShadowScholarPrompts;
const Settings = globalThis.ShadowScholarSettings;

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

// ============================
// 初始化
// ============================
document.addEventListener('DOMContentLoaded', () => {
  log('Side Panel 开始初始化');
  loadSettings();
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
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.mode) {
      updateModeBadge(changes.mode.newValue);
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
  if (mode === 'idea') {
    badge.textContent = '💡 思路模式';
    badge.classList.add('idea');
  } else {
    badge.textContent = '🎯 答案模式';
    badge.classList.remove('idea');
  }
}

/**
 * 更新顶部连接状态指示器
 */
function updateConnectionStatus() {
  chrome.storage.local.get(['apiKey'], (result) => {
    const statusEl = document.getElementById('topbar-status');
    if (!statusEl) return;
    if (result.apiKey) {
      statusEl.classList.add('connected');
      statusEl.title = '✅ API 已连接';
    } else {
      statusEl.classList.remove('connected');
      statusEl.title = '⚠️ 未配置 API Key，点击设置';
    }
  });
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

const MARKDOWN_ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'code', 'pre', 'blockquote',
  'ul', 'ol', 'li', 'hr', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
]);

const MARKDOWN_ALLOWED_ATTRS = {
  a: new Set(['href', 'title', 'target', 'rel']),
  code: new Set(['class'])
};

function sanitizeRenderedHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = html;

  template.content.querySelectorAll('*').forEach((el) => {
    const tag = el.tagName.toLowerCase();
    if (!MARKDOWN_ALLOWED_TAGS.has(tag)) {
      el.replaceWith(document.createTextNode(el.textContent || ''));
      return;
    }

    [...el.attributes].forEach((attr) => {
      const allowedAttrs = MARKDOWN_ALLOWED_ATTRS[tag];
      if (!allowedAttrs || !allowedAttrs.has(attr.name)) {
        el.removeAttribute(attr.name);
      }
    });

    if (tag === 'a') {
      const href = el.getAttribute('href') || '';
      let safeHref = false;
      try {
        const parsed = new URL(href, window.location.href);
        safeHref = ['http:', 'https:', 'mailto:'].includes(parsed.protocol);
      } catch (e) {}

      if (!safeHref) {
        el.removeAttribute('href');
      }
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
  });

  return template.innerHTML;
}

// ============================
// 检查待处理查询（从 storage 消息队列）
// ============================
async function checkPendingQuery() {
  try {
    const result = await chrome.storage.local.get(['pendingQuery', 'pendingAction']);
    
    // 检查待处理查询
    if (result.pendingQuery) {
      const { prompt, timestamp } = result.pendingQuery;
      const age = Date.now() - timestamp;
      log('发现待处理查询, 年龄:', age, 'ms, prompt长度:', prompt.length);

      // 30 秒内的查询才处理
      if (age < 30000) {
        // 立即清除，防止重复处理
        await chrome.storage.local.remove('pendingQuery');
        log('已清除待处理查询, 开始执行');
        // 稍等 DOM 完全就绪
        setTimeout(() => {
          sendMessage(prompt);
        }, 300);
      } else {
        log('待处理查询已过期, 清除');
        await chrome.storage.local.remove('pendingQuery');
      }
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
    if (e.key === 'Enter' && !e.shiftKey) {
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
  const modeAnswer = document.getElementById('sp-mode-answer');
  const modeIdea = document.getElementById('sp-mode-idea');
  if (modeAnswer && modeIdea) {
    modeAnswer.addEventListener('click', () => switchMode('answer'));
    modeIdea.addEventListener('click', () => switchMode('idea'));
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
    setTopbarMode(mode);
    updateModeBadge(mode);
    const label = mode === 'idea' ? '💡 思路模式' : '🎯 答案模式';
    showToast(`已切换到${label}`, 'success');
    log('模式已切换:', mode);
  });
}

function setTopbarMode(mode) {
  document.querySelectorAll('.topbar-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
}

// ============================
// 监听来自右键菜单的查询（直接消息方式）
// ============================
function listenForContextMenuQueries() {
  chrome.runtime.onMessage.addListener((message) => {
    log('收到运行时消息:', message.type);
    if (message.type === 'context-menu-query' && message.prompt) {
      // 检查是否已经有相同的待处理查询（避免重复）
      if (!isStreaming) {
        log('处理右键菜单查询, prompt长度:', message.prompt.length);
        sendMessage(message.prompt);
      } else {
        log('正在流式输出中, 忽略右键菜单查询');
      }
    }
    if (message.type === 'open-settings') {
      openSettings();
    }
  });
  log('右键菜单查询监听器已注册');
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

function sendMessage(text) {
  if (isStreaming) {
    log('正在流式输出中, 忽略发送请求');
    return;
  }

  log('发送消息, 长度:', text.length);

  // 隐藏欢迎界面
  elements.welcome.classList.add('hidden');

  // 添加用户消息
  addMessage('user', text);
  conversationMessages.push({ role: 'user', content: text });

  // 开始流式请求
  startStreaming();
}

// ============================
// 分析内容
// ============================
async function analyzeContent(type) {
  if (isStreaming) return;

  log('分析内容:', type);

  try {
    if (type === 'page') {
      showToast('正在获取页面内容...');
      chrome.runtime.sendMessage({ type: 'get-page-content' }, (response) => {
        log('页面内容响应:', response ? 'OK' : 'null', chrome.runtime.lastError?.message || '');
        if (chrome.runtime.lastError) {
          logError('获取页面内容错误:', chrome.runtime.lastError.message);
          showToast('获取页面内容失败: ' + chrome.runtime.lastError.message, 'error');
          return;
        }
        if (response && response.content) {
          sendMessage(Prompts.buildPageAnalysisPrompt({
            title: response.title || '',
            content: response.content
          }));
        } else {
          showToast('获取页面内容失败，请确保当前页面不是浏览器内部页面', 'error');
          logError('页面内容为空');
        }
      });
    } else if (type === 'selection') {
      chrome.runtime.sendMessage({ type: 'get-selected-text' }, (response) => {
        log('选中文字响应:', response ? `text="${response.text?.substring(0, 50)}"` : 'null');
        if (chrome.runtime.lastError) {
          logError('获取选中文字错误:', chrome.runtime.lastError.message);
          showToast('获取选中文字失败', 'error');
          return;
        }
        if (response && response.text && response.text.trim()) {
          sendMessage(Prompts.buildSelectionAnalysisPrompt(response.text));
        } else {
          showToast('请先在页面中选中文字', 'error');
        }
      });
    }
  } catch (e) {
    logError('分析内容异常:', e.message);
    showToast('操作失败: ' + e.message, 'error');
  }
}

// ============================
// 流式对话
// ============================
function startStreaming() {
  isStreaming = true;
  elements.btnSend.disabled = true;
  streamedContent = '';

  // 显示打字指示器
  elements.typingIndicator.style.display = 'flex';
  scrollToBottom();

  log('建立 Port 连接...');

  // 建立 Port 连接
  currentPort = chrome.runtime.connect({ name: 'llm-stream' });

  currentPort.onMessage.addListener((msg) => {
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

  currentPort.onDisconnect.addListener(() => {
    log('Port 断开连接');
    if (isStreaming) {
      handleStreamDone();
    }
  });

  // 发送消息
  currentPort.postMessage({
    action: 'chat',
    messages: [...conversationMessages]
  });
  log('Chat 请求已发送, 消息数:', conversationMessages.length);
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

  // 渲染 Markdown
  const bubble = currentAiMessageEl.querySelector('.message-content');
  if (bubble) {
    bubble.innerHTML = renderMarkdown(streamedContent);
    bubble.classList.add('streaming-cursor');
    addCopyButtonsToCode(currentAiMessageEl);
  }

  scrollToBottom();
}

function handleStreamDone() {
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
  currentPort = null;

  scrollToBottom();
}

function handleStreamError(error) {
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
  currentPort = null;
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
        <button class="message-action-btn" onclick="copyMessageContent(this)" title="复制">📋</button>
      </div>
    </div>
  `;

  elements.messages.appendChild(div);

  if (role === 'ai') {
    addCopyButtonsToCode(div);
  }

  scrollToBottom();
  return div;
}

function clearConversation() {
  conversationMessages = [];
  elements.messages.innerHTML = '';
  elements.welcome.classList.remove('hidden');

  if (isStreaming && currentPort) {
    currentPort.disconnect();
    isStreaming = false;
    elements.btnSend.disabled = false;
    elements.typingIndicator.style.display = 'none';
    currentAiMessageEl = null;
    streamedContent = '';
    currentPort = null;
  }

  log('对话已清除');
  showToast('对话已清除', 'success');
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
      return sanitizeRenderedHtml(marked.parse(text));
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
    btn.textContent = '复制';
    btn.addEventListener('click', () => {
      const code = pre.querySelector('code');
      const text = code ? code.textContent : pre.textContent;
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = '已复制 ✓';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = '复制';
          btn.classList.remove('copied');
        }, 2000);
      });
    });
    wrapper.appendChild(btn);
  });
}

// 全局复制消息内容函数
window.copyMessageContent = function(btn) {
  const bubble = btn.closest('.message-bubble');
  const content = bubble.querySelector('.message-content');
  const text = content.textContent || content.innerText;
  navigator.clipboard.writeText(text).then(() => {
    showToast('已复制到剪贴板', 'success');
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

function loadSettings() {
  chrome.storage.local.get(
    Settings.SETTINGS_KEYS,
    (result) => {
      const settings = Settings.normalizeSettings(result);

      elements.settingApiUrl.value = settings.apiUrl;
      if (settings.apiKey) elements.settingApiKey.value = settings.apiKey;
      elements.settingModel.value = settings.model;
      elements.settingSystemPrompt.value = settings.systemPrompt;
      elements.settingAntiDetect.checked = settings.antiDetect;
      log('设置已加载:', {
        apiUrl: settings.apiUrl,
        model: settings.model,
        apiKey: settings.apiKey ? '***已设置***' : '(未设置)',
        antiDetect: settings.antiDetect
      });
    }
  );
}

function saveSettings() {
  const settings = {
    apiUrl: elements.settingApiUrl.value.trim(),
    apiKey: elements.settingApiKey.value.trim(),
    model: elements.settingModel.value.trim(),
    systemPrompt: elements.settingSystemPrompt.value.trim(),
    antiDetect: elements.settingAntiDetect.checked,
  };

  chrome.storage.local.set(settings, () => {
    log('设置已保存');
    const suffix = settings.antiDetect ? '' : '，反检测关闭后需刷新页面';
    showToast(`设置已保存 ✓${suffix}`, 'success');
    updateConnectionStatus();
    closeSettings();
  });
}

// ============================
// 调试日志查看器
// ============================
function setupDebugLogViewer() {
  const btnShowLogs = document.getElementById('btn-show-logs');
  const btnClearLogs = document.getElementById('btn-clear-logs');
  const debugLogsDiv = document.getElementById('debug-logs');
  const debugLogsContent = document.getElementById('debug-logs-content');

  if (btnShowLogs) {
    btnShowLogs.addEventListener('click', () => {
      if (debugLogsDiv.style.display === 'none') {
        debugLogsDiv.style.display = 'block';
        loadDebugLogs();
        btnShowLogs.textContent = '🔍 隐藏调试日志';
      } else {
        debugLogsDiv.style.display = 'none';
        btnShowLogs.textContent = '🔍 查看调试日志';
      }
    });
  }

  if (btnClearLogs) {
    btnClearLogs.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'clear-debug-logs' }, () => {
        if (debugLogsContent) debugLogsContent.innerHTML = '<span style="color: #22c55e;">日志已清除</span>';
        showToast('调试日志已清除', 'success');
      });
    });
  }
}

function loadDebugLogs() {
  const debugLogsContent = document.getElementById('debug-logs-content');
  if (!debugLogsContent) return;

  chrome.storage.local.get('debugLogs', (result) => {
    const logs = result.debugLogs || [];
    if (logs.length === 0) {
      debugLogsContent.innerHTML = '<span style="color: var(--text-tertiary);">暂无日志</span>';
      return;
    }

    const html = logs.map(entry => {
      const time = new Date(entry.time).toLocaleTimeString();
      const levelClass = entry.level === 'ERROR' ? 'log-error' : 'log-info';
      const sourceClass = entry.source === 'background' ? 'log-source-bg' : 'log-source-sp';
      const sourceLabel = entry.source === 'background' ? 'BG' : 'SP';
      return `<span class="${levelClass}">[${time}] <span class="${sourceClass}">[${sourceLabel}]</span> ${escapeHtml(entry.message)}</span>`;
    }).join('\n');

    debugLogsContent.innerHTML = html;
    // 滚动到底部
    debugLogsContent.parentElement.scrollTop = debugLogsContent.parentElement.scrollHeight;
  });
}

// 初始化调试日志查看器
document.addEventListener('DOMContentLoaded', () => {
  setupDebugLogViewer();
});
