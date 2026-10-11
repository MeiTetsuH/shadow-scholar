/* Bounded, on-demand text extraction without cloning the entire page. */
(() => {
  'use strict';
  const MAX_CHARS = 20000;
  const QUESTION_SELECTORS = ['.question', '.problem', '.quiz-question', '[data-question]', '[data-testid="question"]', '.question-content', '.question-text', '.problem-statement', '.que', '.questionBox', '.question_main', '.stem', '.assessment-question'];
  const NOISE = 'script,style,noscript,nav,header,footer,aside,textarea,input,select,[contenteditable],[role="textbox"],[hidden],[aria-hidden="true"],#__ninja-ai-host__';
  function textFrom(root, doc) {
    if (!root) return '';
    const walker = doc.createTreeWalker(root, 1 | 4, {
      acceptNode(node) {
        if (node.nodeType === 1) return node.matches(NOISE) ? 2 : 3;
        return node.textContent.trim() ? 1 : 3;
      }
    });
    let result = '';
    let node;
    while (result.length < MAX_CHARS && (node = walker.nextNode())) result += node.textContent.slice(0, MAX_CHARS - result.length) + '\n';
    return result.trim().slice(0, MAX_CHARS);
  }
  function extractQuestionContent(doc = document) {
    const selector = QUESTION_SELECTORS.join(',');
    const nodes = [...doc.querySelectorAll(selector)].filter(node => !node.parentElement?.closest(selector) && !node.closest(NOISE));
    let result = '';
    const seen = new Set();
    for (const node of nodes) {
      const text = textFrom(node, doc);
      if (text.length >= 10 && !seen.has(text)) {
        seen.add(text);
        result += (result ? '\n\n---\n\n' : '') + text;
      }
      if (result.length >= MAX_CHARS) break;
    }
    return result.slice(0, MAX_CHARS) || null;
  }
  function extractMainContent(doc = document) { return textFrom(doc.querySelector('article,main,[role="main"]') || doc.body, doc); }
  function extractPageContent(doc = document) {
    const question = extractQuestionContent(doc);
    return { title: doc.title.slice(0, 500), content: question || extractMainContent(doc), type: question ? 'question' : 'main' };
  }
  function getSelectedText(win = window) { return (win.getSelection()?.toString() || '').slice(0, 50000); }
  globalThis.ShadowScholarExtractors = Object.freeze({ extractQuestionContent, extractMainContent, extractPageContent, getSelectedText });
})();
