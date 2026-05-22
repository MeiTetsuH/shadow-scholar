/**
 * 影学者 - 设置与迁移层
 * 统一默认值、storage key、URL 规范化和缺失配置初始化。
 */
(() => {
  'use strict';

  const DEFAULT_MODEL = 'openai/gpt-5.4-mini';
  const ANTI_DETECT_SCRIPT_ID = 'shadow-scholar-anti-detect-main';

  const SETTINGS_KEYS = Object.freeze([
    'apiUrl',
    'apiKey',
    'model',
    'systemPrompt',
    'antiDetect',
    'mode'
  ]);

  function getDefaultSettings() {
    return {
      apiUrl: '',
      apiKey: '',
      model: DEFAULT_MODEL,
      systemPrompt: globalThis.ShadowScholarPrompts?.DEFAULT_SYSTEM_PROMPT || '',
      antiDetect: true,
      mode: 'answer'
    };
  }

  function getMissingDefaultUpdates(current = {}) {
    const defaults = getDefaultSettings();
    const updates = {};

    ['apiUrl', 'model', 'systemPrompt', 'antiDetect', 'mode'].forEach((key) => {
      if (typeof current[key] === 'undefined') {
        updates[key] = defaults[key];
      }
    });

    return updates;
  }

  function normalizeSettings(current = {}) {
    const defaults = getDefaultSettings();
    return {
      ...defaults,
      ...current,
      apiUrl: current.apiUrl || defaults.apiUrl,
      model: current.model || defaults.model,
      mode: current.mode || defaults.mode,
      antiDetect: current.antiDetect !== false
    };
  }

  function buildChatCompletionsUrl(inputUrl) {
    if (!inputUrl) return inputUrl;

    let url = inputUrl.replace(/\/+$/, '');

    if (url.includes('/chat/completions')) return url;
    if (url.includes('gateway.ai.cloudflare.com')) return url + '/chat/completions';
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      if (url.includes('/api')) return url + '/chat';
      return url + '/v1/chat/completions';
    }
    if (url.endsWith('/v1')) return url + '/chat/completions';

    return url + '/v1/chat/completions';
  }

  globalThis.ShadowScholarSettings = Object.freeze({
    DEFAULT_MODEL,
    ANTI_DETECT_SCRIPT_ID,
    SETTINGS_KEYS,
    getDefaultSettings,
    getMissingDefaultUpdates,
    normalizeSettings,
    buildChatCompletionsUrl
  });
})();
