/**
 * 影学者 - i18n 国际化模块
 * 使用 Chrome 原生 _locales/ 格式存储翻译。
 * 支持用户在设置中覆盖语言（存储在 chrome.storage.local）。
 * 未覆盖时回退到 chrome.i18n.getMessage()（跟随浏览器语言）。
 */
(() => {
  'use strict';

  const LOCALE_DIR = { zh: 'zh_CN', en: 'en' };
  let _messages = null;  // null = 使用原生 chrome.i18n
  let _ready = false;

  /**
   * 检测浏览器默认语言
   */
  function detectLanguage() {
    const lang = navigator.language || '';
    return lang.startsWith('zh') ? 'zh' : 'en';
  }

  /**
   * 初始化 i18n。读取用户存储的语言偏好，
   * 如与浏览器语言不同则加载对应的 messages.json。
   */
  async function initI18n() {
    try {
      const result = await chrome.runtime.sendMessage({ type: 'get-ui-settings' });
      _messages = result?.messages || null;
      if (typeof document !== 'undefined' && location.protocol === 'chrome-extension:') document.documentElement.lang = result?.language === 'zh' ? 'zh-CN' : 'en';
    } catch { _messages = null; }
    _ready = true;
  }

  /**
   * 获取翻译字符串
   * @param {string} key - messages.json 中的键名
   * @param {...string} subs - 替换 $PLACEHOLDER$ 的值（按 $1, $2 顺序）
   */
  function t(key, ...subs) {
    // 优先使用加载的覆盖消息
    if (_messages && _messages[key]) {
      let msg = _messages[key].message;
      const ph = _messages[key].placeholders;
      if (ph && subs.length > 0) {
        for (const [name, info] of Object.entries(ph)) {
          const idx = parseInt(String(info.content).replace('$', '')) - 1;
          if (idx >= 0 && idx < subs.length) {
            msg = msg.replace(new RegExp('\\$' + name + '\\$', 'gi'), () => String(subs[idx]));
          }
        }
      }
      return msg;
    }
    // 回退到原生 chrome.i18n API
    const native = chrome.i18n.getMessage(key, subs);
    return native || key;
  }

  /**
   * 批量应用翻译到 DOM 元素
   * 支持 data-i18n (textContent), data-i18n-placeholder, data-i18n-title
   */
  function applyI18n(root) {
    const el = root || document;
    el.querySelectorAll('[data-i18n]').forEach((node) => {
      const key = node.getAttribute('data-i18n');
      const msg = t(key);
      if (msg !== key) node.textContent = msg;
    });
    el.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
      const key = node.getAttribute('data-i18n-placeholder');
      const msg = t(key);
      if (msg !== key) node.placeholder = msg;
    });
    el.querySelectorAll('[data-i18n-aria]').forEach(node => {
      const key = node.getAttribute('data-i18n-aria');
      const msg = t(key);
      if (msg !== key) node.setAttribute('aria-label', msg);
    });
    el.querySelectorAll('[data-i18n-title]').forEach((node) => {
      const key = node.getAttribute('data-i18n-title');
      const msg = t(key);
      if (msg !== key) node.title = msg;
    });
  }

  globalThis.ShadowScholarI18n = Object.freeze({
    detectLanguage,
    initI18n,
    t,
    applyI18n
  });
})();
