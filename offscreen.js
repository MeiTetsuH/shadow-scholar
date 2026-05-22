/**
 * 影学者 - Offscreen Document
 * 用于在长时间流式请求期间保持 Service Worker 存活
 * 每 20 秒 ping 一次 service worker
 */

let keepAliveInterval = null;

// 监听来自 service worker 的消息
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'start-keepalive') {
    startKeepAlive();
  } else if (message.type === 'stop-keepalive') {
    stopKeepAlive();
  }
});

function startKeepAlive() {
  if (keepAliveInterval) return;
  keepAliveInterval = setInterval(() => {
    chrome.runtime.sendMessage({ type: 'keepalive-ping' });
  }, 20000); // 每 20 秒
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}
