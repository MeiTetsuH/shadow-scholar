/* Render provider text using a shared, restrictive HTML allowlist. */
(() => {
  'use strict';
  const tags = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 's', 'del', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'hr', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
  function render(text) {
    const template = document.createElement('template');
    template.innerHTML = marked.parse(String(text), { breaks: true, gfm: true, async: false });
    for (const el of template.content.querySelectorAll('*')) {
      const tag = el.tagName.toLowerCase();
      if (!tags.has(tag) || el.namespaceURI !== 'http://www.w3.org/1999/xhtml') {
        el.replaceWith(document.createTextNode(el.textContent || ''));
        continue;
      }
      for (const attr of [...el.attributes]) {
        if (!(tag === 'a' && ['href', 'title'].includes(attr.name))) el.removeAttribute(attr.name);
      }
      if (tag === 'a') {
        try {
          const url = new URL(el.getAttribute('href'));
          if (!['https:', 'http:', 'mailto:'].includes(url.protocol)) throw new Error();
          el.href = url.href;
        } catch { el.removeAttribute('href'); }
        el.target = '_blank';
        el.rel = 'noopener noreferrer';
      }
    }
    return template.innerHTML;
  }
  globalThis.ShadowScholarMarkdown = Object.freeze({ render });
})();
