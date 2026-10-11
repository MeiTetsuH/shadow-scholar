/* Bounded OpenAI-compatible SSE decoding, shared with regression tests. */
(() => {
  'use strict';
  async function readChatStream(body, onChunk, signal) {
    if (!body) throw new Error('The AI provider returned an empty response body.');
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let total = 0;
    let sawContent = false;
    const abort = () => { reader.cancel().catch(() => {}); };
    signal?.addEventListener('abort', abort, { once: true });
    function processLine(line) {
      if (!line.startsWith('data:')) return false;
      const data = line.slice(5).trim();
      if (!data) return false;
      if (data === '[DONE]') return true;
      let parsed;
      try { parsed = JSON.parse(data); }
      catch { throw new Error('The AI provider returned malformed streaming data.'); }
      if (parsed.error) throw new Error('The AI provider reported a streaming error.');
      const content = parsed.choices?.[0]?.delta?.content;
      if (typeof content === 'string' && content) {
        total += content.length;
        if (total > 200000) throw new Error('The response exceeds the 200,000 character limit.');
        sawContent = true;
        onChunk(content);
      }
      return false;
    }
    try {
      while (true) {
        signal?.throwIfAborted();
        const { value, done } = await reader.read();
        signal?.throwIfAborted();
        buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
        if (buffer.length > 1000000) throw new Error('The AI provider returned an oversized stream frame.');
        let index;
        while ((index = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, index).replace(/\r$/, '');
          buffer = buffer.slice(index + 1);
          if (processLine(line)) {
            if (!sawContent) throw new Error('The AI provider returned no text.');
            return;
          }
        }
        if (done) {
          if (buffer) processLine(buffer.replace(/\r$/, ''));
          if (!sawContent) throw new Error('The AI provider returned no text. Check the model and endpoint.');
          return;
        }
      }
    } finally {
      signal?.removeEventListener('abort', abort);
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
  globalThis.ShadowScholarStream = Object.freeze({ readChatStream });
})();
