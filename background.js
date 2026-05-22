/**
 * 影学者 - Background Service Worker
 * 职责：
 *   1. 注册右键上下文菜单
 *   2. 处理 API 核心请求 (SSE 流式输出)
 *   3. 消息路由 (侧边栏、内容脚本、Popup 之间的通讯)
 *   4. 通过 Offscreen Document 保持流式请求期间 SW 不被挂起
 * 日志前缀: [影学者:BG]
 */

importScripts('prompts.js', 'settings.js', 'extractors.js');

const Prompts = globalThis.ShadowScholarPrompts;
const Settings = globalThis.ShadowScholarSettings;

// ============================
// 日志系统
// ============================
const LOG_PREFIX = '[影学者:BG]';
const MAX_LOGS = 200;

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

async function storeLog(level, message) {
  try {
    const { debugLogs = [] } = await chrome.storage.local.get('debugLogs');
    debugLogs.push({
      time: new Date().toISOString(),
      level,
      source: 'background',
      message
    });
    // 保留最近 MAX_LOGS 条
    if (debugLogs.length > MAX_LOGS) {
      debugLogs.splice(0, debugLogs.length - MAX_LOGS);
    }
    await chrome.storage.local.set({ debugLogs });
  } catch (e) {
    // 静默失败
  }
}

// ============================
// 点击图标直接打开侧边栏（取代 popup）
// ============================
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .then(() => log('已设置：点击图标打开侧边栏'))
  .catch(e => logError('setPanelBehavior 失败:', e.message));

// ============================
// 安装/更新时初始化
// ============================
chrome.runtime.onInstalled.addListener((details) => {
  log('扩展已安装/更新:', details.reason);

  // 只保留一个扁平菜单项
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'ninja-answer',
      title: '🥷 解答这道题',
      contexts: ['selection']
    });
    log('右键菜单注册完成');
  });

  initializeSettingsAndScripts().catch((e) => {
    logError('初始化设置失败:', e.message);
  });
});

chrome.runtime.onStartup.addListener(() => {
  syncAntiDetectFromStorage().catch((e) => {
    logError('启动时同步反检测脚本失败:', e.message);
  });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes.antiDetect) return;

  syncAntiDetectContentScript(changes.antiDetect.newValue !== false).catch((e) => {
    logError('反检测脚本同步失败:', e.message);
  });
});

syncAntiDetectFromStorage().catch((e) => {
  logError('初始同步反检测脚本失败:', e.message);
});

async function initializeSettingsAndScripts() {
  const result = await chrome.storage.local.get(Settings.SETTINGS_KEYS);
  const updates = Settings.getMissingDefaultUpdates(result);

  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
    log('缺失设置已初始化:', Object.keys(updates).join(', '));
  } else {
    log('现有设置已保留:', result.apiUrl, result.model);
  }

  const effective = Settings.normalizeSettings({ ...result, ...updates });
  await syncAntiDetectContentScript(effective.antiDetect);
}

async function syncAntiDetectFromStorage() {
  const settings = Settings.normalizeSettings(await chrome.storage.local.get(['antiDetect']));
  await syncAntiDetectContentScript(settings.antiDetect);
}

async function syncAntiDetectContentScript(enabled) {
  if (!chrome.scripting?.getRegisteredContentScripts) {
    log('当前浏览器不支持动态 content script 注册，跳过反检测脚本同步');
    return;
  }

  const id = Settings.ANTI_DETECT_SCRIPT_ID;
  const registered = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
  const isRegistered = registered.length > 0;

  if (enabled && !isRegistered) {
    await chrome.scripting.registerContentScripts([{
      id,
      matches: ['<all_urls>'],
      js: ['anti-detect.js'],
      runAt: 'document_start',
      world: 'MAIN'
    }]);
    log('反检测脚本已启用，将在新页面加载时注入');
  } else if (!enabled && isRegistered) {
    await chrome.scripting.unregisterContentScripts({ ids: [id] });
    log('反检测脚本已停用，新页面不再注入');
  } else {
    log('反检测脚本状态无需变更:', enabled ? 'enabled' : 'disabled');
  }
}

// ============================
// 使用 chrome.scripting.executeScript 获取页面内容
// 不依赖 content script 是否已加载
// ============================
async function getPageContentDirect(tabId) {
  log('通过 executeScript 获取页面内容, tabId:', tabId);
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['extractors.js']
    });

    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => globalThis.ShadowScholarExtractors.extractPageContent()
    });

    const result = results?.[0]?.result;
    log('页面内容获取成功:', result ? `${result.type}, ${result.content.length}字` : 'null');
    return result;
  } catch (e) {
    logError('executeScript 获取页面内容失败:', e.message);
    return null;
  }
}

async function getSelectedTextDirect(tabId) {
  log('通过 executeScript 获取选中文字, tabId:', tabId);
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['extractors.js']
    });

    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => globalThis.ShadowScholarExtractors.getSelectedText()
    });
    const text = results?.[0]?.result || '';
    log('选中文字获取结果:', text ? `${text.length}字` : '(空)');
    return text;
  } catch (e) {
    logError('executeScript 获取选中文字失败:', e.message);
    return '';
  }
}

async function getActiveTabId() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      log('当前活动标签页:', tabs[0].id, tabs[0].url?.substring(0, 60));
      return tabs[0].id;
    }
    logError('未找到活动标签页');
    return null;
  } catch (e) {
    logError('查询活动标签页失败:', e.message);
    return null;
  }
}

// ============================
// 右键菜单点击处理（只有一个菜单项）
// ============================
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  log('右键菜单点击, 选中文字长度:', info.selectionText?.length || 0);

  // 关键：sidePanel.open() 必须是第一个 await
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
    log('侧边面板已打开');
  } catch (e) {
    logError('打开侧边面板失败:', e.message);
  }

  if (!info.selectionText) return;

  const prompt = Prompts.buildAnswerPrompt(info.selectionText);

  // 存储待处理查询
  await chrome.storage.local.set({
    pendingQuery: {
      prompt,
      timestamp: Date.now()
    }
  });
  log('待处理查询已存入 storage, prompt长度:', prompt.length);

  // 也尝试直接发送消息（如果面板已在运行）
  setTimeout(() => {
    try {
      chrome.runtime.sendMessage({
        type: 'context-menu-query',
        prompt: prompt
      });
      log('直接消息已发送到面板');
    } catch (e) {
      log('直接消息发送失败，面板将从 storage 读取');
    }
  }, 500);
});

// ============================
// 消息处理（一次性消息）
// ============================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  log('收到消息:', message.type, '来自:', sender.url?.substring(0, 40) || sender.id);

  if (message.type === 'keepalive-ping') {
    return;
  }

  if (message.type === 'get-settings') {
    chrome.storage.local.get(Settings.SETTINGS_KEYS, (result) => {
      const settings = Settings.normalizeSettings(result);
      log('返回设置:', { ...settings, apiKey: settings.apiKey ? '***已设置***' : '(未设置)' });
      sendResponse(settings);
    });
    return true;
  }

  if (message.type === 'save-settings') {
    chrome.storage.local.set(message.settings, () => {
      log('设置已保存');
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'get-page-content') {
    (async () => {
      try {
        const tabId = await getActiveTabId();
        if (!tabId) {
          logError('get-page-content: 无法获取活动标签页');
          sendResponse(null);
          return;
        }
        const result = await getPageContentDirect(tabId);
        sendResponse(result);
      } catch (e) {
        logError('get-page-content 错误:', e.message);
        sendResponse(null);
      }
    })();
    return true;
  }

  if (message.type === 'get-selected-text') {
    (async () => {
      try {
        const tabId = await getActiveTabId();
        if (!tabId) {
          logError('get-selected-text: 无法获取活动标签页');
          sendResponse({ text: '' });
          return;
        }
        const text = await getSelectedTextDirect(tabId);
        sendResponse({ text });
      } catch (e) {
        logError('get-selected-text 错误:', e.message);
        sendResponse({ text: '' });
      }
    })();
    return true;
  }

  // 注意：'open-sidepanel' 不再在这里处理
  // sidePanel.open() 只能在用户手势中调用（popup/contextMenu 直接调用）

  // 获取调试日志
  if (message.type === 'get-debug-logs') {
    chrome.storage.local.get('debugLogs', (result) => {
      sendResponse(result.debugLogs || []);
    });
    return true;
  }

  // 清除调试日志
  if (message.type === 'clear-debug-logs') {
    chrome.storage.local.set({ debugLogs: [] }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  // 保存内联回答到历史
  if (message.type === 'save-inline-history') {
    chrome.storage.local.get('inlineHistory', (result) => {
      const history = result.inlineHistory || [];
      history.unshift({
        question: message.question,
        answer: message.answer,
        url: message.url,
        title: message.title,
        timestamp: message.timestamp
      });
      // 最多保留 50 条
      if (history.length > 50) history.length = 50;
      chrome.storage.local.set({ inlineHistory: history });
      log('内联历史已保存, 共', history.length, '条');
    });
    return false;
  }

  // 将内联回答发送到侧边栏
  if (message.type === 'save-inline-to-sidebar') {
    // 存为 pendingQuery，侧边栏打开时会读取
    const prompt = Prompts.buildInlineArchivePrompt(message.question, message.answer);
    chrome.storage.local.set({
      pendingQuery: { prompt, timestamp: Date.now() }
    });
    // 尝试通知已打开的侧边栏
    try {
      chrome.runtime.sendMessage({
        type: 'context-menu-query',
        prompt
      });
    } catch(e) {}
    log('内联回答已转发到侧边栏');
    return false;
  }
});

// ============================
// 流式连接处理 (Port)
// ============================
chrome.runtime.onConnect.addListener((port) => {
  log('Port 连接建立:', port.name);

  if (port.name === 'llm-stream') {
    let portDisconnected = false;
    let activeReader = null;

    port.onMessage.addListener(async (msg) => {
      log('Port 消息:', msg.action, '消息数:', msg.messages?.length);
      if (msg.action === 'chat') {
        await handleStreamChat(msg.messages, port, () => portDisconnected, (r) => { activeReader = r; });
      }
    });

    port.onDisconnect.addListener(() => {
      log('Port 连接断开');
      portDisconnected = true;
      // 取消正在进行的流读取，避免浪费带宽
      if (activeReader) {
        try { activeReader.cancel(); } catch (e) {}
        activeReader = null;
      }
    });
  }
});

/**
 * 安全地向 port 发送消息
 */
function safeSend(port, msg, isDisconnected) {
  if (isDisconnected()) {
    log('Port 已断开，跳过发送:', msg.type);
    return false;
  }
  try {
    port.postMessage(msg);
    return true;
  } catch (e) {
    log('Port 发送失败:', e.message);
    return false;
  }
}

/**
 * 处理流式 LLM 对话
 * @param {Array} messages - 消息数组 [{role, content}]
 * @param {chrome.runtime.Port} port - 通信端口
 * @param {Function} isDisconnected - 检查 port 是否断开
 * @param {Function} setReader - 注册 reader 以便断开时取消
 */
async function handleStreamChat(messages, port, isDisconnected, setReader) {
  try {
    const storedSettings = await chrome.storage.local.get(Settings.SETTINGS_KEYS);
    const settings = Settings.normalizeSettings(storedSettings);

    if (!settings.apiKey) {
      logError('API Key 未设置');
      safeSend(port, { type: 'error', error: '请先在设置中配置 API Key' }, isDisconnected);
      return;
    }

    if (!settings.apiUrl) {
      logError('API 地址未设置');
      safeSend(port, { type: 'error', error: '请先在设置中配置 API 地址' }, isDisconnected);
      return;
    }

    // 启动保活（不阻断流程）
    ensureKeepAlive().catch(() => {});

    const rawUrl = settings.apiUrl;
    const apiUrl = Settings.buildChatCompletionsUrl(rawUrl);
    const model = settings.model;
    const mode = settings.mode;

    log('开始流式请求:', { rawUrl, apiUrl, model, mode, messageCount: messages.length });

    // 根据模式选择系统提示词
    const fullMessages = [];
    const systemPrompt = Prompts.getSystemPromptForMode({
      mode,
      systemPrompt: settings.systemPrompt
    });
    if (systemPrompt) {
      fullMessages.push({ role: 'system', content: systemPrompt });
    }
    fullMessages.push(...messages);

    const requestBody = {
      model: model,
      messages: fullMessages,
      stream: true
    };
    const requestChars = fullMessages.reduce((total, item) => total + String(item.content || '').length, 0);
    log('请求体元数据:', {
      model,
      stream: true,
      messageCount: fullMessages.length,
      requestChars
    });

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    log('API 响应状态:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      logError('API 请求失败:', response.status, errorText.substring(0, 200));
      safeSend(port, {
        type: 'error',
        error: `API 错误 (${response.status}): ${errorText.substring(0, 200)}`
      }, isDisconnected);
      await stopKeepAlive();
      return;
    }

    log('API 连接成功, 开始读取流...');

    const reader = response.body.getReader();
    setReader(reader);
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let totalChunks = 0;

    while (true) {
      if (isDisconnected()) {
        log('Port 已断开，中止流读取');
        try { reader.cancel(); } catch (e) {}
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          log('流式输出完成, 总 chunks:', totalChunks);
          safeSend(port, { type: 'done' }, isDisconnected);
          setReader(null);
          await stopKeepAlive();
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            totalChunks++;
            if (!safeSend(port, { type: 'chunk', content: content }, isDisconnected)) {
              // Port 断开，中止流
              try { reader.cancel(); } catch (e) {}
              setReader(null);
              await stopKeepAlive();
              return;
            }
          }
        } catch (e) {
          // 跳过解析错误
        }
      }
    }

    log('流结束, 总 chunks:', totalChunks);
    safeSend(port, { type: 'done' }, isDisconnected);
    setReader(null);
    await stopKeepAlive();

  } catch (error) {
    if (error.message === 'The operation was aborted.' || error.name === 'AbortError') {
      log('流读取已被取消（Port 断开）');
    } else {
      logError('流式请求异常:', error.message);
      safeSend(port, { type: 'error', error: error.message }, isDisconnected);
    }
    setReader(null);
    await stopKeepAlive();
  }
}

// ============================
// Service Worker 保活机制
// ============================
async function ensureKeepAlive() {
  try {
    // chrome.runtime.getContexts 可能在某些 Chromium 版本不可用
    if (typeof chrome.runtime.getContexts !== 'function') {
      log('getContexts 不可用，跳过保活');
      return;
    }
    if (typeof chrome.offscreen?.createDocument !== 'function') {
      log('offscreen API 不可用，跳过保活');
      return;
    }
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    if (existingContexts.length === 0) {
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['WORKERS'],
        justification: 'Keep service worker alive during streaming'
      });
      log('Offscreen document 已创建');
    }
    try {
      chrome.runtime.sendMessage({ type: 'start-keepalive' });
    } catch (e) {}
  } catch (e) {
    log('保活设置忽略:', e.message);
  }
}

async function stopKeepAlive() {
  try {
    if (typeof chrome.runtime.getContexts !== 'function') return;
    if (typeof chrome.offscreen?.closeDocument !== 'function') return;
    try {
      chrome.runtime.sendMessage({ type: 'stop-keepalive' });
    } catch (e) {}
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    if (existingContexts.length > 0) {
      await chrome.offscreen.closeDocument();
      log('Offscreen document 已关闭');
    }
  } catch (e) {
    // 忽略
  }
}

log('Service Worker 已启动');
