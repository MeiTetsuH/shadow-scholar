/**
 * 影学者 - Content Script (ISOLATED World)
 * 职责：
 *   1. 页面内容提取、选中文字获取
 *   2. 浮动快捷按钮（选中文字后出现）
 *   3. 内联答题面板（点击浮动按钮后弹出，流式显示回答）
 * 运行在 document_idle 时
 */

const Extractors = globalThis.ShadowScholarExtractors;
const Prompts = globalThis.ShadowScholarPrompts;
const I18n = globalThis.ShadowScholarI18n;

// ============================
// 消息监听（保留原有功能）
// ============================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageContent') { sendResponse(Extractors.extractPageContent()); return true; }
  if (request.action === 'getSelectedText') { sendResponse({ text: Extractors.getSelectedText() }); return true; }
  if (request.action === 'getContext') {
    sendResponse({ selectedText: Extractors.getSelectedText(), pageContent: Extractors.extractPageContent() });
    return true;
  }
});

// ============================
// 浮动快捷按钮 + 内联答题面板
// 使用 Shadow DOM 隔离样式
// ============================
(async () => {
  await I18n.initI18n();
  const Icons = globalThis.ShadowScholarIcons;

  // 等待 body 就绪
  const container = document.body || document.documentElement;

  // 创建宿主容器
  const host = document.createElement('div');
  host.id = '__ninja-ai-host__';
  host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;overflow:visible;';
  container.appendChild(host);

  const shadow = host.attachShadow({ mode: 'closed' });

  // 注入样式
  const style = document.createElement('style');
  style.textContent = `
:host{color-scheme:light}*{margin:0;padding:0;box-sizing:border-box}button{font:inherit;cursor:pointer}svg{display:block;pointer-events:none}button:focus-visible,a:focus-visible{outline:2px solid #a23e2b;outline-offset:3px}
.ninja-fab{position:fixed;display:none;width:34px;height:34px;border-radius:6px;background:#263832;border:1px solid #fffefa;color:#f7f6f0;pointer-events:auto;z-index:2147483647;box-shadow:0 3px 10px #26383225;opacity:1;user-select:none;padding:7px;transition:background .15s}
.ninja-fab:hover{background:#a23e2b}.ninja-fab.idea-mode{background:#65705a}.ninja-fab.personality-mode{background:#a23e2b}
.ninja-panel{position:fixed;display:none;width:min(420px,calc(100vw - 20px));max-height:min(480px,calc(100dvh - 20px));background:#fffefa;border:1px solid #c9cec1;border-radius:6px;box-shadow:0 12px 38px #26383225;pointer-events:auto;z-index:2147483647;font:14px/1.85 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;color:#263832;overflow:hidden}
.ninja-panel-header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 16px;background:#f7f6f0;border-bottom:1px solid #dcded4;cursor:move;flex-shrink:0}
.ninja-panel-title{font-weight:600;font-size:12px;letter-spacing:.5px;display:flex;gap:8px;align-items:center}.ninja-panel-title::before{content:'';width:3px;height:15px;background:#a23e2b}
.ninja-panel-close{width:30px;height:30px;display:grid;place-items:center;border:0;background:transparent;border-radius:3px;color:#67716b}.ninja-panel-close:hover{background:#eeefe7;color:#a23e2b}
.ninja-panel-body{padding:20px;min-height:0;overflow:auto;overflow-wrap:anywhere;scrollbar-width:thin;scrollbar-color:#c7cdc3 transparent}.ninja-panel-body p{margin:0 0 12px}.ninja-panel-body>:last-child{margin-bottom:0}.ninja-panel-body strong,.ninja-panel-body b{font-weight:650;color:#263832}.ninja-panel-body code{background:#eeefe7;padding:2px 5px;border-radius:3px;font:12px/1.7 Menlo,Consolas,monospace}.ninja-panel-body pre{background:#eeefe7;border:1px solid #dcded4;border-radius:4px;padding:12px;overflow-x:auto;margin:12px 0}.ninja-panel-body pre code{background:none;padding:0;white-space:pre}.ninja-panel-body ul,.ninja-panel-body ol{padding-left:20px;margin:10px 0}.ninja-panel-body li{margin:5px 0}.ninja-panel-body h1,.ninja-panel-body h2,.ninja-panel-body h3,.ninja-panel-body h4{font-family:'Iowan Old Style','Songti SC',Georgia,serif;font-weight:600;line-height:1.5;margin:18px 0 10px}.ninja-panel-body h1{font-size:22px}.ninja-panel-body h2{font-size:20px}.ninja-panel-body h3{font-size:17px}.ninja-panel-body blockquote{border-left:2px solid #a23e2b;padding:2px 0 2px 12px;margin:12px 0;color:#67716b}.ninja-panel-body hr{border:0;border-top:1px solid #dcded4;margin:14px 0}.ninja-panel-body a{color:#a23e2b;text-decoration:underline;text-underline-offset:3px}.ninja-panel-body table{display:block;max-width:100%;overflow-x:auto;border-collapse:collapse;margin:12px 0}.ninja-panel-body th,.ninja-panel-body td{border:1px solid #dcded4;padding:6px 10px;font-size:12px;text-align:left}.ninja-panel-body th{background:#eeefe7}
.ninja-loading{display:flex;gap:5px;padding:10px 0}.ninja-loading span{width:5px;height:5px;background:#67716b;border-radius:50%;animation:ninja-breathe 1.2s infinite}.ninja-loading span:nth-child(2){animation-delay:.15s}.ninja-loading span:nth-child(3){animation-delay:.3s}@keyframes ninja-breathe{50%{opacity:.2}}
.ninja-panel-footer{display:flex;justify-content:flex-end;align-items:center;padding:9px 14px;gap:12px;border-top:1px solid #dcded4;background:#f7f6f0;flex-shrink:0}.ninja-panel-btn{min-height:30px;padding:3px 5px;border:0;border-radius:3px;background:none;color:#67716b;font-size:11px}.ninja-panel-btn:hover{color:#a23e2b;background:#eeefe7}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
  `;
  shadow.appendChild(style);

  // ============================
  // 创建浮动按钮
  // ============================
  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'ninja-fab';
  fab.innerHTML = Icons.svg('book');
  fab.title = I18n.t('fabTitleDefault');
  shadow.appendChild(fab);

  // 根据模式更新浮动按钮样式
  let currentMode = 'answer';
  function updateFabMode(mode) {
    currentMode = mode || 'answer';
    fab.classList.remove('idea-mode', 'personality-mode');
    if (currentMode === 'idea') {
      fab.classList.add('idea-mode');
      fab.innerHTML = Icons.svg('idea');
      fab.title = I18n.t('fabTitleIdea');
    } else if (currentMode === 'personality') {
      fab.classList.add('personality-mode');
      fab.innerHTML = Icons.svg('camera');
      fab.title = I18n.t('fabTitleScreenshot');
    } else {
      fab.innerHTML = Icons.svg('book');
      fab.title = I18n.t('fabTitleAnswer');
    }
  }
  // 初始化
  try {
    chrome.runtime.sendMessage({ type: 'get-ui-settings' }).then(r => updateFabMode(r.mode)).catch(() => {});
    chrome.runtime.onMessage.addListener(message => {
      if (message.type === 'ui-settings-changed') updateFabMode(message.settings.mode);
    });
  } catch(e) {}

  // ============================
  // 创建内联面板
  // ============================
  const panel = document.createElement('div');
  panel.className = 'ninja-panel';
  panel.innerHTML = `
    <div class="ninja-panel-header">
      <div class="ninja-panel-title">${I18n.t('panelTitleDefault')}</div>
      <button type="button" class="ninja-panel-close" title="${I18n.t('panelClose')}">${Icons.svg('close',16)}</button>
    </div>
    <div class="ninja-panel-body"></div>
    <div class="ninja-panel-footer">
      <button type="button" class="ninja-panel-btn" data-action="copy">${I18n.t('panelBtnCopy')}</button>
      <button type="button" class="ninja-panel-btn" data-action="sidebar">${I18n.t('panelBtnSidebar')}</button>
    </div>
  `;
  shadow.appendChild(panel);

  const panelBody = panel.querySelector('.ninja-panel-body');
  const panelClose = panel.querySelector('.ninja-panel-close');
  const btnCopy = panel.querySelector('[data-action="copy"]');
  const btnSidebar = panel.querySelector('[data-action="sidebar"]');
  const panelTitle = panel.querySelector('.ninja-panel-title');

  let renderTimer = null;
  let selectedText = '';
  let currentQuestionText = '';
  let currentAnswer = '';
  let currentPort = null;
  let hideTimeout = null;
  let currentQuestionMode = 'answer';
  let currentSidebarRecordId = '';
  let currentSidebarSent = false;

  // ============================
  // 选中文字检测
  // ============================
  document.addEventListener('mouseup', (e) => {
    // 忽略在我们自己的 UI 上的点击
    if (e.target === host || host.contains(e.target)) return;

    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
      const sel = window.getSelection();
      const text = sel?.toString().trim();
      if (text && text.length >= 2) {
        selectedText = text;
        showFab(e.clientX, e.clientY);
      } else {
        // 不要在面板可见时隐藏 fab
        if (panel.style.display !== 'flex') {
          hideFab();
        }
      }
    }, 100);
  }, true);

  // 点击空白处隐藏
  document.addEventListener('mousedown', (e) => {
    if (e.target === host || host.contains(e.target)) return;
    // 检查是否点击在 shadow DOM 内
    const path = e.composedPath();
    if (path.includes(fab) || path.includes(panel)) return;

    if (panel.style.display === 'flex') {
      hidePanel();
    }
    hideFab();
  }, true);

  // ============================
  // 浮动按钮逻辑
  // ============================
  function showFab(x, y) {
    fab.style.display = 'block';
    // 放在选中文字右上方
    fab.style.left = Math.min(x + 10, window.innerWidth - 50) + 'px';
    fab.style.top = Math.max(y - 45, 5) + 'px';
  }

  function hideFab() {
    fab.style.display = 'none';
  }

  fab.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedText) return;
    hideFab();
    showPanel(e.clientX, e.clientY);
    askQuestion(selectedText);
  });

  // ============================
  // 内联面板逻辑
  // ============================
  function showPanel(x, y) {
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';

    // 智能定位：尽量靠近点击位置，但不超出屏幕
    const pw = Math.min(420, window.innerWidth - 20), maxH = Math.min(480, window.innerHeight - 20);
    let left = x - pw / 2;
    let top = y + 10;
    if (left < 10) left = 10;
    if (left + pw > window.innerWidth - 10) left = window.innerWidth - pw - 10;
    if (top + maxH > window.innerHeight - 10) top = y - maxH - 10;
    if (top < 10) top = 10;

    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
    panelClose.focus({ preventScroll: true });

    panelBody.innerHTML = '<div class="ninja-loading"><span></span><span></span><span></span></div>';
    currentQuestionText = '';
    currentAnswer = '';
    currentQuestionMode = currentMode;
    currentSidebarRecordId = '';
    currentSidebarSent = false;
    panelTitle.textContent = currentQuestionMode === 'personality'
      ? I18n.t('panelTitleScreenshot')
      : I18n.t('panelTitleDefault');
    btnSidebar.textContent = currentQuestionMode === 'personality'
      ? I18n.t('panelBtnAutoSync')
      : I18n.t('panelBtnSidebar');
  }

  function hidePanel() {
    clearTimeout(renderTimer);
    renderTimer = null;
    panel.style.display = 'none';
    if (currentPort) {
      try { currentPort.disconnect(); } catch(e) {}
      currentPort = null;
    }
  }

  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') { hidePanel(); hideFab(); }
  });

  panelClose.addEventListener('click', (e) => {
    e.stopPropagation();
    hidePanel();
  });

  // 复制按钮
  btnCopy.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!currentAnswer) return;
    navigator.clipboard.writeText(currentAnswer).then(() => {
      btnCopy.textContent = I18n.t('panelBtnCopied');
      setTimeout(() => { btnCopy.textContent = I18n.t('panelBtnCopy'); }, 1500);
    });
  });

  // 发到侧边栏
  btnSidebar.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!currentQuestionText || !currentAnswer) return;
    sendInlineAnswerToSidebar(currentQuestionText, currentAnswer, {
      auto: false,
      mode: currentQuestionMode
    });
  });

  // 面板拖拽
  let isDragging = false, dragOffX = 0, dragOffY = 0;
  const panelHeader = panel.querySelector('.ninja-panel-header');

  panelHeader.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    isDragging = true;
    dragOffX = e.clientX - panel.offsetLeft;
    dragOffY = e.clientY - panel.offsetTop;
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    panel.style.left = Math.max(10, Math.min(e.clientX - dragOffX, window.innerWidth - panel.offsetWidth - 10)) + 'px';
    panel.style.top = Math.max(10, Math.min(e.clientY - dragOffY, window.innerHeight - panel.offsetHeight - 10)) + 'px';
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // ============================
  // 向 AI 提问 (通过 Port 流式)
  // ============================
  function askQuestion(text) {
    // 先检查扩展上下文是否有效
    if (!chrome.runtime?.id) {
      panelBody.innerHTML = `<p style="color:#a23e2b;">${I18n.t('panelErrorInvalidated')}</p>`;
      return;
    }

    const questionMode = currentQuestionMode;
    const useScreenshot = questionMode === 'personality';
    const prompt = useScreenshot ? text : Prompts.buildAnswerPrompt(text);
    currentQuestionText = useScreenshot
      ? `${I18n.t('panelScreenshotLabel')}${text ? `\n\n${I18n.t('panelScreenshotAux')}\n${text}` : ''}`
      : text;

    try {
      currentPort = chrome.runtime.connect({ name: 'llm-stream' });

      const port = currentPort;
      let finished = false;
      port.onMessage.addListener((msg) => {
        if (currentPort !== port) return;
        if (msg.type === 'chunk') {
          if (currentAnswer === '') panelBody.innerHTML = '';
          currentAnswer += msg.content;
          if (renderTimer === null) renderTimer = setTimeout(() => { renderTimer = null; renderMarkdown(currentAnswer); }, 80);
        } else if (msg.type === 'done') {
          finished = true;
          clearTimeout(renderTimer);
          renderTimer = null;
          renderMarkdown(currentAnswer);
          saveToHistory(currentQuestionText, currentAnswer);
          if (questionMode === 'personality') {
            sendInlineAnswerToSidebar(currentQuestionText, currentAnswer, {
              auto: true,
              mode: questionMode
            });
          }
        } else if (msg.type === 'error') {
          finished = true;
          clearTimeout(renderTimer);
          renderTimer = null;
          panelBody.textContent = `❌ ${msg.error}`;
        }
      });

      port.onDisconnect.addListener(() => {
        if (currentPort !== port) return;
        currentPort = null;
        clearTimeout(renderTimer);
        renderTimer = null;
        if (finished) return;
        // 如果还在加载中（没有收到内容），说明连接异常断开
        if (!finished) {
          const err = chrome.runtime.lastError?.message || I18n.t('panelErrorDisconnected');
          panelBody.innerHTML = `<p style="color:#a23e2b;">⚠️ ${escapeHtml(err)}</p>
            <p style="color:#67716b;font-size:12px;margin-top:6px;">${I18n.t('panelErrorRefresh')}</p>`;
        }
      });

      // 发送消息
      currentPort.postMessage({
        action: useScreenshot ? 'chat-screenshot' : 'chat',
        messages: [{ role: 'user', content: prompt }]
      });
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('Extension context invalidated') || msg.includes('context')) {
        panelBody.innerHTML = `<p style="color:#a23e2b;">${I18n.t('panelErrorExtUpdated')}</p>`;
      } else {
        panelBody.innerHTML = `<p style="color:#a23e2b;">❌ ${escapeHtml(msg)}</p>`;
      }
    }
  }

  // ============================
  // Markdown 渲染（简易版）
  // ============================
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function renderMarkdown(text) {
    panelBody.innerHTML = globalThis.ShadowScholarMarkdown.render(text);
    panelBody.scrollTop = panelBody.scrollHeight;
  }

  // ============================
  // 保存到历史记录 (chrome.storage)
  // ============================
  function saveToHistory(question, answer) {
    try {
      chrome.runtime.sendMessage({
        type: 'save-inline-history',
        question,
        answer,
        timestamp: Date.now()
      });
    } catch(e) {}
  }

  async function sendInlineAnswerToSidebar(question, answer, { auto = false, mode = currentMode } = {}) {
    if (currentSidebarSent) {
      btnSidebar.textContent = I18n.t('panelBtnSynced');
      return;
    }

    currentSidebarSent = true;
    currentSidebarRecordId = currentSidebarRecordId || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      const result = await chrome.runtime.sendMessage({
        type: 'save-inline-to-sidebar',
        recordId: currentSidebarRecordId,
        question,
        answer,
        mode,
        auto,
        timestamp: Date.now()
      });
      if (!result?.success) throw new Error('Could not save the record.');
      btnSidebar.textContent = auto ? I18n.t('panelBtnAutoSynced') : I18n.t('panelBtnSent');
    } catch(e) {
      currentSidebarSent = false;
      btnSidebar.textContent = I18n.t('panelBtnSyncFailed');
    }
  }

})();
