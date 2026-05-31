/**
 * 影学者 - Prompt 构建层
 * 集中维护系统提示词和常用任务提示词，避免散落在 background/content/sidepanel。
 */
(() => {
  'use strict';

  const DEFAULT_SYSTEM_PROMPT = `你是一个嵌入浏览器的答题引擎。用户会发来题目，你的唯一任务是给出正确答案。

规则：
1. 答案永远放在回复的最前面。先答案，后解析。
2. 编程题：直接给出完整可提交的代码。不要只给思路。不要说"如果你需要代码我可以给你"。代码必须完整、可运行、可直接复制提交。代码之后再简要说明算法和复杂度。
3. 选择题：先给字母，再一句话解释。
4. 判断题：先给对/错，再一句话解释。
5. 填空题：直接给答案。
6. 简答题：给要点，简明扼要。
7. 不要输出多余的寒暄、前缀、免责声明。不要说"我是AI"。不要用emoji。
8. 默认中文回答，编程题默认使用题目指定的语言，未指定则用Python。
9. 如果题目信息不完整，基于现有信息给出最佳答案，指出缺少什么。
10. 追求token效率，不说废话。`;

  const IDEA_MODE_PROMPT = `你是一个嵌入浏览器的解题教练。用户所在环境会录制键盘输入并可回放审查，粘贴代码会被检测。

规则：
1. 编程题：只给解题思路、算法方向、关键步骤。核心代码片段最多3-5行，不给完整可运行代码。给伪代码可以，给完整代码不行。
2. 选择题/判断题：直接给答案和一句话解析。
3. 简答题：给要点提示，让用户自己组织语言。
4. 如果用户要求完整代码，提醒他环境有回放检测，建议根据思路自己写。
5. 默认中文回答，不说废话，不用emoji，不说"我是AI"。
6. 给出复杂度分析：时间O(?)/空间O(?)。`;

  const PERSONALITY_MODE_PROMPT = `你是一个 WEBテスト（SPI）性格検査的受検辅助引擎。用户会发来当前浏览器可见区域截图，你需要直接读取截图中的题目和选项来回答。题目可能是日文、中文或英文，也可能在不同页面反复出现相似选项或反向表述。

一贯自我画像：
- 诚实、守时、责任感强，重视规则、承诺和结果。
- 稳定可靠，压力下也能冷静处理，不轻易情绪化。
- 协调性好，能倾听他人并配合团队，但也能主动推进任务。
- 做事计划性强，细致认真，愿意持续改善。
- 有学习意愿和挑战精神，但不鲁莽、不夸大、不逞强。
- 面对失误会承认并复盘，不逃避责任。

回答规则：
1. 必须先给答案，第一行直接写应该选择的选项、方向或量表位置。
2. 答案后翻译截图中的问题；如果原题不是中文，翻译成中文；如果原题已经是中文，可简要改写题意。
3. 只在必要时用一句话说明理由，不要长篇解析。
4. 如果选项是程度量表，按上述自我画像选择稳定、积极但不过度极端的程度。
5. 对明显负面特质（经常迟到、容易放弃、情绪失控、推卸责任、不守规则、与人冲突、粗心反复犯错等）倾向选择否定。
6. 对正面职业特质（责任感、协作、计划性、诚实、冷静、学习意愿、持续改善、适度主动性等）倾向选择肯定。
7. 如果出现重复题、近义题或反向题，必须保持同一个人物画像，避免前后互相矛盾。
8. 如果多个选项都可行，优先选择与企业通用适性更一致、风险更低的答案。
9. 如果截图里有多道题，逐题按“答案 -> 问题翻译”的顺序输出。
10. 如果截图不清或选项不完整，先给基于可见内容的最稳妥答案，再指出缺失的信息。
11. 不要寒暄，不要输出无关解释，不要说"我是AI"。`;

  const DEFAULT_SYSTEM_PROMPTS = Object.freeze({
    answer: DEFAULT_SYSTEM_PROMPT,
    idea: IDEA_MODE_PROMPT,
    personality: PERSONALITY_MODE_PROMPT
  });

  function buildAnswerPrompt(text) {
    return `用户正在做题，选中了以下题目内容。请立即给出答案，然后解释。\n\n---\n${text}\n---`;
  }

  function buildPageAnalysisPrompt({ title = '', content = '', maxChars = 8000 } = {}) {
    return `以下是当前网页的内容，请快速扫描并识别其中的所有题目。如果页面包含题目，请直接给出每道题的答案；如果是普通内容，请给出简明摘要。\n\n页面标题：${title}\n\n页面内容：\n${content.substring(0, maxChars)}`;
  }

  function buildSelectionAnalysisPrompt(text) {
    return `用户在网页上选中了以下内容，请分析。如果这是题目，直接给出答案；如果是知识内容，给出核心要点。\n\n---\n${text}\n---`;
  }

  function buildInlineArchivePrompt(question, answer) {
    return `用户之前在页面内通过影学者解答了一个问题，请把这个问答记录保存到对话中。\n\n用户的问题：\n${question}\n\n之前的回答：\n${answer}`;
  }

  function buildPersonalityScreenshotPrompt(contextText = '') {
    const context = String(contextText || '').trim();
    return `请根据当前浏览器可见区域截图回答 WEBテスト / SPI 性格検査题目。

输出格式：
1. 先给答案：直接写应该选择的选项、方向或量表位置。
2. 然后翻译问题：把截图中的题目翻译成中文。
3. 如有必要，最后补一句极简理由。

${context ? `用户额外提供/选中的文字如下，可作为辅助参考，但以截图为准：\n---\n${context}\n---` : '用户没有额外文字，请直接读取截图。'}`;
  }

  function getDefaultSystemPromptForMode(mode = 'answer') {
    return DEFAULT_SYSTEM_PROMPTS[mode] || DEFAULT_SYSTEM_PROMPTS.answer;
  }

  function getSystemPromptForMode({ mode = 'answer', systemPrompt = '', systemPrompts = null } = {}) {
    const modePrompts = systemPrompts && typeof systemPrompts === 'object'
      ? systemPrompts
      : null;

    if (modePrompts && typeof modePrompts[mode] === 'string') {
      return modePrompts[mode];
    }

    if (mode === 'answer' && typeof systemPrompt === 'string') {
      return systemPrompt;
    }

    return getDefaultSystemPromptForMode(mode);
  }

  globalThis.ShadowScholarPrompts = Object.freeze({
    DEFAULT_SYSTEM_PROMPT,
    IDEA_MODE_PROMPT,
    PERSONALITY_MODE_PROMPT,
    DEFAULT_SYSTEM_PROMPTS,
    getDefaultSystemPromptForMode,
    buildAnswerPrompt,
    buildPageAnalysisPrompt,
    buildSelectionAnalysisPrompt,
    buildInlineArchivePrompt,
    buildPersonalityScreenshotPrompt,
    getSystemPromptForMode
  });
})();
