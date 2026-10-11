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
  console.log('%c🥷 影学者 内容脚本已加载', 'color: #a78bfa; font-size: 14px; font-weight: bold;');

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
    * { margin:0; padding:0; box-sizing:border-box; }

    /* 影学者浮动快捷按钮（极度精致小巧，高透明隐形设计） */
    .ninja-fab {
      position: fixed;
      display: none;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: linear-gradient(135deg, #8b5cf6, #ec4899);
      border: 1px solid rgba(255,255,255,0.25);
      cursor: pointer;
      pointer-events: auto;
      z-index: 2147483647;
      font-size: 13px;
      line-height: 22px;
      text-align: center;
      box-shadow: 0 2px 8px rgba(139,92,246,0.35), inset 0 1px 1px rgba(255,255,255,0.2);
      opacity: 0.5;
      transition: transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1), box-shadow 0.25s ease, opacity 0.2s ease, background 0.3s ease;
      user-select: none;
      animation: ninja-pop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .ninja-fab.idea-mode {
      background: linear-gradient(135deg, #f59e0b, #ef4444);
      box-shadow: 0 2px 8px rgba(245,158,11,0.35), inset 0 1px 1px rgba(255,255,255,0.2);
    }
    .ninja-fab.personality-mode {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: linear-gradient(135deg, #db2777, #f97316);
      border-color: rgba(251,113,133,0.55);
      font-size: 13px;
      line-height: 22px;
      box-shadow: 0 2px 9px rgba(219,39,119,0.42), 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 1px rgba(255,255,255,0.24);
      opacity: 0.72;
    }
    .ninja-fab:hover {
      transform: scale(1.22) rotate(15deg);
      opacity: 0.95;
      box-shadow: 0 4px 16px rgba(139,92,246,0.6), 0 0 10px rgba(236,72,153,0.35);
    }
    .ninja-fab.idea-mode:hover {
      box-shadow: 0 4px 16px rgba(245,158,11,0.6), 0 0 10px rgba(239,68,68,0.35);
    }
    .ninja-fab.personality-mode:hover {
      box-shadow: 0 4px 16px rgba(236,72,153,0.58), 0 0 10px rgba(139,92,246,0.34);
    }
    .ninja-fab:active { transform: scale(0.9); }
    @keyframes ninja-pop {
      0% { transform: scale(0); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }

    /* 内联答题面板（现代化高透光磨砂液态玻璃，确保极其出色的文本清晰度与透光折射） */
    .ninja-panel {
      position: fixed;
      display: none;
      width: min(420px, calc(100vw - 16px));
      max-height: 480px;
      background: rgba(10, 11, 22, 0.62); /* 62% 的高透光透明度，完美融于页面背景并透射细节 */
      backdrop-filter: blur(28px) saturate(180%);
      -webkit-backdrop-filter: blur(28px) saturate(180%);
      border: 1px solid rgba(255, 255, 255, 0.08); /* 极细亮白玻璃边框 */
      border-radius: 14px;
      box-shadow: 0 16px 48px rgba(0,0,0,0.55), inset 0 1px 1px rgba(255,255,255,0.15), 0 0 16px rgba(168,85,247,0.06);
      pointer-events: auto;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans SC', sans-serif;
      color: #f1f5f9;
      font-size: 14px;
      line-height: 1.7;
      overflow: hidden;
      animation: ninja-slide 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    }
    @keyframes ninja-slide {
      0% { transform: translateY(12px) scale(0.97); opacity: 0; }
      100% { transform: translateY(0) scale(1); opacity: 1; }
    }

    /* 极简玻璃切片头部 */
    .ninja-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.02); /* 极致通透轻量分割 */
      border-bottom: 1px solid rgba(255, 255, 255, 0.06); /* 超细白色玻璃分割线 */
      cursor: move;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
    }
    .ninja-panel-title {
      font-size: 13.5px;
      font-weight: 700;
      background: linear-gradient(135deg, #a855f7 0%, #60a5fa 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      display: flex;
      align-items: center;
      gap: 6px;
      letter-spacing: 0.5px;
    }
    .ninja-panel-close {
      width: 24px;
      height: 24px;
      border: 1px solid rgba(255,255,255,0.05);
      background: rgba(255,255,255,0.04);
      border-radius: 6px;
      color: #94a3b8;
      cursor: pointer;
      font-size: 12px;
      line-height: 22px;
      text-align: center;
      pointer-events: auto;
      transition: all 0.15s ease;
    }
    .ninja-panel-close:hover { 
      background: rgba(239,68,68,0.22); 
      border-color: rgba(239,68,68,0.3);
      color: #f87171; 
      transform: scale(1.05);
    }

    .ninja-panel-body {
      padding: 16px;
      max-height: 390px;
      overflow-y: auto;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .ninja-panel-body::-webkit-scrollbar { width: 4px; }
    .ninja-panel-body::-webkit-scrollbar-track { background: transparent; }
    .ninja-panel-body::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.35); border-radius: 4px; }
    .ninja-panel-body::-webkit-scrollbar-thumb:hover { background: rgba(139,92,246,0.6); }

    /* 高可读性文本渲染 */
    .ninja-panel-body p { margin-bottom: 10px; }
    .ninja-panel-body strong, .ninja-panel-body b { 
      color: #fca5a5; /* 醒目的淡红色，帮助在答题时一目了然锁定重点 */
      font-weight: 700;
      background: rgba(239, 68, 68, 0.08);
      padding: 0px 4px;
      border-radius: 3px;
      border: 1px solid rgba(239, 68, 68, 0.12);
    }
    .ninja-panel-body code {
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(255,255,255,0.05);
      padding: 2px 5px;
      border-radius: 4px;
      font-family: 'JetBrains Mono', 'Menlo', monospace;
      font-size: 12.5px;
      color: #fda4af;
    }
    .ninja-panel-body pre {
      background: rgba(3, 4, 8, 0.7);
      border: 1px solid rgba(139,92,246,0.2);
      border-radius: 8px;
      padding: 12px 14px;
      overflow-x: auto;
      margin: 10px 0;
      font-size: 12px;
      line-height: 1.55;
      box-shadow: inset 0 1px 3px rgba(0,0,0,0.4);
    }
    .ninja-panel-body pre code {
      background: none;
      padding: 0;
      font-size: 12px;
      color: #cbd5e1;
    }
    .ninja-panel-body ul, .ninja-panel-body ol { padding-left: 20px; margin: 8px 0; }
    .ninja-panel-body li { margin: 4px 0; }
    .ninja-panel-body h1,.ninja-panel-body h2,.ninja-panel-body h3,.ninja-panel-body h4 {
      color: #ffffff; margin: 12px 0 8px 0; font-weight: 700;
    }
    .ninja-panel-body h1 { font-size: 16px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 3px; }
    .ninja-panel-body h2 { font-size: 15px; }
    .ninja-panel-body blockquote {
      border-left: 3px solid #8b5cf6;
      padding-left: 10px;
      margin: 10px 0;
      color: #94a3b8;
      background: rgba(139,92,246,0.05);
      border-radius: 0 4px 4px 0;
      padding: 6px 10px;
    }
    .ninja-panel-body hr {
      border: none;
      border-top: 1px solid rgba(255,255,255,0.08);
      margin: 12px 0;
    }
    .ninja-panel-body a { color: #60a5fa; text-decoration: underline; }
    .ninja-panel-body table { border-collapse: collapse; width: 100%; margin: 10px 0; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; overflow:hidden;}
    .ninja-panel-body th, .ninja-panel-body td {
      border: 1px solid rgba(255,255,255,0.08);
      padding: 6px 10px;
      font-size: 12.5px;
    }
    .ninja-panel-body th { background: rgba(139,92,246,0.12); color: #ffffff; font-weight: 700; }

    /* 加载动画 */
    .ninja-loading {
      display: inline-flex;
      gap: 4px;
      padding: 4px 0;
    }
    .ninja-loading span {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #8b5cf6;
      animation: ninja-bounce 1.2s infinite;
    }
    .ninja-loading span:nth-child(2) { animation-delay: 0.15s; }
    .ninja-loading span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes ninja-bounce {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
      40% { transform: scale(1); opacity: 1; }
    }

    /* 底部操作卡片按钮 */
    .ninja-panel-footer {
      display: flex;
      justify-content: flex-end;
      padding: 10px 16px 12px;
      gap: 8px;
      background: rgba(0, 0, 0, 0.08); /* 极致通透轻量分割 */
      border-top: 1px solid rgba(255,255,255,0.04);
    }
    .ninja-panel-btn {
      padding: 6px 14px;
      border: 1px solid rgba(255, 255, 255, 0.08); /* 极细白玻璃边框 */
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.03); /* 轻透玻璃背景 */
      color: #e2e8f0;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      pointer-events: auto;
      box-shadow: inset 0 1px 1px rgba(255,255,255,0.05);
    }
    .ninja-panel-btn:hover {
      background: linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(59, 130, 246, 0.12) 100%); /* 优雅的品牌霓虹微光 hover */
      border-color: rgba(168, 85, 247, 0.3);
      color: #ffffff;
      box-shadow: inset 0 1px 1px rgba(255,255,255,0.1), 0 4px 12px rgba(168,85,247,0.1);
      transform: translateY(-1px);
    }
    .ninja-panel-btn:active {
      transform: translateY(0);
    }
  `;
  shadow.appendChild(style);

  // ============================
  // 创建浮动按钮
  // ============================
  const fab = document.createElement('div');
  fab.className = 'ninja-fab';
  fab.textContent = '🥷';
  fab.title = I18n.t('fabTitleDefault');
  shadow.appendChild(fab);

  // 根据模式更新浮动按钮样式
  let currentMode = 'answer';
  function updateFabMode(mode) {
    currentMode = mode || 'answer';
    fab.classList.remove('idea-mode', 'personality-mode');
    if (currentMode === 'idea') {
      fab.classList.add('idea-mode');
      fab.textContent = '💡';
      fab.title = I18n.t('fabTitleIdea');
    } else if (currentMode === 'personality') {
      fab.classList.add('personality-mode');
      fab.textContent = '📸';
      fab.title = I18n.t('fabTitleScreenshot');
    } else {
      fab.textContent = '🥷';
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
      <div class="ninja-panel-close" title="${I18n.t('panelClose')}">✕</div>
    </div>
    <div class="ninja-panel-body"></div>
    <div class="ninja-panel-footer">
      <div class="ninja-panel-btn" data-action="copy">${I18n.t('panelBtnCopy')}</div>
      <div class="ninja-panel-btn" data-action="sidebar">${I18n.t('panelBtnSidebar')}</div>
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
    fab.style.animation = 'none';
    fab.offsetHeight; // reflow
    fab.style.animation = 'ninja-pop 0.2s ease-out';
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
    const pw = 420, maxH = 480;
    let left = x - pw / 2;
    let top = y + 10;
    if (left < 10) left = 10;
    if (left + pw > window.innerWidth - 10) left = window.innerWidth - pw - 10;
    if (top + maxH > window.innerHeight - 10) top = y - maxH - 10;
    if (top < 10) top = 10;

    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
    panel.style.animation = 'none';
    panel.offsetHeight;
    panel.style.animation = 'ninja-slide 0.25s ease-out';

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
    if (e.target === panelClose) return;
    isDragging = true;
    dragOffX = e.clientX - panel.offsetLeft;
    dragOffY = e.clientY - panel.offsetTop;
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    panel.style.left = (e.clientX - dragOffX) + 'px';
    panel.style.top = (e.clientY - dragOffY) + 'px';
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
      panelBody.innerHTML = `<p style="color:#f87171;">${I18n.t('panelErrorInvalidated')}</p>`;
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
          panelBody.innerHTML = `<p style="color:#f87171;">⚠️ ${escapeHtml(err)}</p>
            <p style="color:#94a3b8;font-size:12px;margin-top:6px;">${I18n.t('panelErrorRefresh')}</p>`;
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
        panelBody.innerHTML = `<p style="color:#f87171;">${I18n.t('panelErrorExtUpdated')}</p>`;
      } else {
        panelBody.innerHTML = `<p style="color:#f87171;">❌ ${escapeHtml(msg)}</p>`;
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
