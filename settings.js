/**
 * 影学者 - 设置与迁移层
 * 统一默认值、storage key、URL 规范化和缺失配置初始化。
 */
(() => {
  'use strict';

  const DEFAULT_MODEL = 'openai/gpt-5.4-mini';
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
    'mode'
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
