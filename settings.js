/**
 * 影学者 - 设置与迁移层
 * 统一默认值、storage key、URL 规范化和缺失配置初始化。
 */
(() => {
  'use strict';

  const DEFAULT_MODEL = 'gpt-5.4-mini';
  const DEFAULT_API_URL = 'https://api.openai.com/v1';
  const ANTI_DETECT_SCRIPT_ID = 'shadow-scholar-anti-detect-main';
  const PROMPT_MODES = Object.freeze(['answer', 'idea', 'personality']);

  const SETTINGS_KEYS = Object.freeze([
    'apiUrl',
    'apiKey',
    'model',
    'systemPrompt',
    'systemPrompts',
    'antiDetect',
    'mode',
    'language',
    'dataConsentEndpoint'
  ]);

  function getDefaultSystemPrompts() {
    const prompts = globalThis.ShadowScholarPrompts;
    return {
      answer: prompts?.DEFAULT_SYSTEM_PROMPT || '',
      idea: prompts?.IDEA_MODE_PROMPT || '',
      personality: prompts?.PERSONALITY_MODE_PROMPT || ''
    };
  }

  function normalizeSystemPrompts(current = {}) {
    const defaults = getDefaultSystemPrompts();
    const stored = current.systemPrompts && typeof current.systemPrompts === 'object'
      ? current.systemPrompts
      : {};

    const normalized = {};
    PROMPT_MODES.forEach((mode) => {
      if (typeof stored[mode] === 'string') {
        normalized[mode] = stored[mode];
      } else if (mode === 'answer' && typeof current.systemPrompt === 'string') {
        normalized[mode] = current.systemPrompt;
      } else {
        normalized[mode] = defaults[mode];
      }
    });

    return normalized;
  }

  function getDefaultSettings() {
    const systemPrompts = getDefaultSystemPrompts();
    return {
      apiUrl: DEFAULT_API_URL,
      apiKey: '',
      model: DEFAULT_MODEL,
      systemPrompt: systemPrompts.answer,
      systemPrompts,
      antiDetect: false,
      mode: 'answer',
      language: '',
      dataConsentEndpoint: ''
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

    try {
      if (current.model === 'openai/gpt-5.4-mini' && (!current.apiUrl || new URL(current.apiUrl).hostname === 'api.openai.com')) updates.model = DEFAULT_MODEL;
    } catch { /* Invalid legacy endpoints remain editable in Settings. */ }

    const normalizedPrompts = normalizeSystemPrompts(current);
    if (typeof current.systemPrompt === 'undefined') {
      updates.systemPrompt = normalizedPrompts.answer;
    }
    const storedPrompts = current.systemPrompts && typeof current.systemPrompts === 'object'
      ? current.systemPrompts
      : null;
    if (!storedPrompts || PROMPT_MODES.some((mode) => typeof storedPrompts[mode] === 'undefined')) {
      updates.systemPrompts = normalizedPrompts;
    }

    return updates;
  }

  function normalizeSettings(current = {}) {
    const defaults = getDefaultSettings();
    const systemPrompts = normalizeSystemPrompts(current);
    return {
      ...defaults,
      ...current,
      apiUrl: current.apiUrl || defaults.apiUrl,
      model: current.model || defaults.model,
      systemPrompt: systemPrompts.answer,
      systemPrompts,
      mode: current.mode || defaults.mode,
      antiDetect: current.antiDetect === true
    };
  }

  function buildChatCompletionsUrl(inputUrl) {
    const url = new URL(String(inputUrl || DEFAULT_API_URL).trim());
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
      throw new Error('Use HTTPS, or HTTP on localhost for a local AI server.');
    }
    if (url.username || url.password || url.hash) {
      throw new Error('API URLs must not contain credentials or fragments.');
    }
    let path = url.pathname.replace(/\/+$/, '');
    // Ollama's native /api/chat uses a different protocol. Use its compatible API.
    if (loopback && /^\/api(?:\/chat)?$/.test(path)) path = '/v1';
    if (!path.endsWith('/chat/completions')) {
      if (!path) path = '/v1';
      path += '/chat/completions';
    }
    url.pathname = path;
    return url.href;
  }

  globalThis.ShadowScholarSettings = Object.freeze({
    DEFAULT_API_URL,
    DEFAULT_MODEL,
    ANTI_DETECT_SCRIPT_ID,
    PROMPT_MODES,
    SETTINGS_KEYS,
    getDefaultSystemPrompts,
    normalizeSystemPrompts,
    getDefaultSettings,
    getMissingDefaultUpdates,
    normalizeSettings,
    buildChatCompletionsUrl
  });
})();
