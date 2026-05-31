/**
 * 影学者 - Popup 逻辑 (极简版)
 * 一个入口：打开侧边面板
 * 模式切换：答案模式 / 思路模式 / 性格测试模式
 */

document.addEventListener('DOMContentLoaded', () => {
  const Settings = globalThis.ShadowScholarSettings;
  const modeHints = {
    answer: '直接给出完整答案',
    idea: '只给解题思路，适合有回放检测的平台',
    personality: '截图读取当前页面，先给答案再翻译题目'
  };

  // 检查 API 配置状态 & 当前模式
  chrome.storage.local.get(Settings.SETTINGS_KEYS, (result) => {
    const settings = Settings.normalizeSettings(result);
    const statusBadge = document.getElementById('status-badge');
    const statusText = statusBadge.querySelector('.status-text');
    if (settings.apiKey) {
      statusBadge.classList.add('connected');
      statusText.textContent = '已连接';
    }
    document.getElementById('toggle-anti-detect').checked = settings.antiDetect;

    // 恢复模式状态
    setActiveMode(settings.mode);
  });

  // 模式切换
  function setActiveMode(mode) {
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    document.getElementById('mode-hint').textContent = modeHints[mode] || '';
  }

  document.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode || 'answer';
      setActiveMode(mode);
      chrome.storage.local.set({ mode });
    });
  });

  // 打开侧边面板
  document.getElementById('btn-open-panel').addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) await chrome.sidePanel.open({ tabId: tab.id });
    } catch (e) {}
    window.close();
  });

  // 反检测开关
  document.getElementById('toggle-anti-detect').addEventListener('change', (e) => {
    chrome.storage.local.set({ antiDetect: e.target.checked });
  });

  // 完整设置
  document.getElementById('btn-full-settings').addEventListener('click', async () => {
    try {
      await chrome.storage.local.set({
        pendingAction: { type: 'open-settings', timestamp: Date.now() }
      });
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) await chrome.sidePanel.open({ tabId: tab.id });
    } catch (e) {}
    window.close();
  });
});
