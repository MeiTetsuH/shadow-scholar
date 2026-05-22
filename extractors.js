/**
 * 影学者 - 页面提取层
 * 统一页面正文、题目块和选中文字提取逻辑。
 */
(() => {
  'use strict';

  const QUESTION_SELECTORS = Object.freeze([
    '.question', '.problem', '.quiz-question', '.exam-question',
    '[data-question]', '[data-testid="question"]',
    '.question-content', '.question-text', '.question-body',
    '.problem-statement', '.problem-content',
    '.que', '.questionBox', '.topic-content',
    '.ques-content', '.subject_describe',
    '.question_main', '.stem', '.stem_text',
    '.challenge-body', '.task-body', '.exercise-content',
    '.assessment-question', '.test-question',
    '[class*="question"]', '[class*="problem"]',
    '[id*="question"]', '[id*="problem"]'
  ]);

  const NOISE_SELECTORS = Object.freeze([
    'nav', 'header', 'footer',
    '.nav', '.navbar', '.sidebar', '.menu', '.ad',
    'script', 'style', 'noscript'
  ]);

  function getElementText(element) {
    return (element?.innerText || element?.textContent || '').trim();
  }

  function getUniqueTexts(elements, { minLength = 10, maxLength = 10000 } = {}) {
    const texts = [];
    elements.forEach((element) => {
      const text = getElementText(element);
      if (text.length >= minLength && text.length <= maxLength) {
        texts.push(text);
      }
    });
    return [...new Set(texts)];
  }

  function extractQuestionContent(doc = document) {
    const questions = [];

    QUESTION_SELECTORS.forEach((selector) => {
      try {
        questions.push(...getUniqueTexts(doc.querySelectorAll(selector)));
      } catch (e) {}
    });

    const unique = [...new Set(questions)];
    return unique.length > 0 ? unique.join('\n\n---\n\n') : null;
  }

  function extractMainContent(doc = document) {
    const mainContent = doc.querySelector('article, main, [role="main"]');
    if (mainContent) return getElementText(mainContent);

    const body = doc.body;
    if (!body) return '';

    const clone = body.cloneNode(true);
    NOISE_SELECTORS.forEach((selector) => {
      try {
        clone.querySelectorAll(selector).forEach((element) => element.remove());
      } catch (e) {}
    });

    return getElementText(clone);
  }

  function extractPageContent(doc = document, win = window) {
    const title = doc.title;
    const url = win.location.href;
    const questionContent = extractQuestionContent(doc);

    if (questionContent) {
      return { title, url, content: questionContent, type: 'question' };
    }

    const mainContent = doc.querySelector('article, main, [role="main"]');
    if (mainContent) {
      return { title, url, content: getElementText(mainContent), type: 'main' };
    }

    return { title, url, content: extractMainContent(doc), type: 'fullpage' };
  }

  function getSelectedText(win = window) {
    return win.getSelection()?.toString() || '';
  }

  globalThis.ShadowScholarExtractors = Object.freeze({
    QUESTION_SELECTORS,
    NOISE_SELECTORS,
    extractQuestionContent,
    extractMainContent,
    extractPageContent,
    getSelectedText
  });
})();
