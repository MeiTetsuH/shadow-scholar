/* Optional selection helper. Never patch focus, visibility, timing, eval, or built-ins. */
(() => {
  'use strict';
  function isEditablePasteTarget(target) {
    let node = target;
    if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement;
    if (!node || typeof node.closest !== 'function') return false;
    return Boolean(node.isContentEditable || node.closest('textarea,input,[contenteditable],[role="textbox"]'));
  }
  for (const type of ['copy', 'selectstart', 'contextmenu']) {
    document.addEventListener(type, event => {
      // Rich editors own clipboard and selection behavior. Preserve their handlers.
      if (event.composedPath().some(isEditablePasteTarget)) return;
      event.preventDefault = () => {};
    }, true);
  }
  // Do not intercept paste or cut: rich editors sanitize and insert their own content.
})();
