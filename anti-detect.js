/**
 * 影学者 - 反检测系统
 * 运行在 MAIN world，document_start 时注入
 *
 * 策略说明：
 *   - visibilityState / hidden / hasFocus：getter 伪装 + 事件阻断（一致）
 *   - blur / focus：不阻断，改为"blur 后短暂延迟补发 focus"
 *     这样页面逻辑不会被破坏，检测系统看到的是"极短暂切走后立刻切回"
 *   - 复制/选择/右键/debugger/performance 等：保持原有保护
 */
(() => {
  'use strict';

  // ============================
  // 工具：伪装函数 toString()
  // 让被覆盖的函数看起来仍然是 [native code]
  // 防止 func.toString() 检测
  // ============================
  const nativeFnStore = new WeakMap();

  function spoofToString(fake, originalOrName) {
    const name = typeof originalOrName === 'function'
      ? originalOrName.name
      : (originalOrName || fake.name || '');
    nativeFnStore.set(fake, `function ${name}() { [native code] }`);
  }

  // 劫持 Function.prototype.toString 本身
  const originalToString = Function.prototype.toString;
  Function.prototype.toString = function () {
    if (nativeFnStore.has(this)) {
      return nativeFnStore.get(this);
    }
    return originalToString.call(this);
  };
  spoofToString(Function.prototype.toString, originalToString);

  // ============================
  // 1. Page Visibility API 拦截
  //    getter 始终返回"可见"，与事件阻断配合
  // ============================
  try {
    Object.defineProperty(document, 'hidden', {
      get: () => false,
      configurable: true
    });

    Object.defineProperty(document, 'visibilityState', {
      get: () => 'visible',
      configurable: true
    });

    // Webkit 前缀版本
    Object.defineProperty(document, 'webkitHidden', {
      get: () => false,
      configurable: true
    });

    Object.defineProperty(document, 'webkitVisibilityState', {
      get: () => 'visible',
      configurable: true
    });
  } catch (e) {}

  // ============================
  // 2. 焦点检测拦截
  //    hasFocus() 始终返回 true
  // ============================
  try {
    const fakeHasFocus = function hasFocus() { return true; };
    spoofToString(fakeHasFocus, 'hasFocus');
    Object.defineProperty(document, 'hasFocus', {
      value: fakeHasFocus,
      configurable: true,
      writable: false
    });
  } catch (e) {}

  // ============================
  // 3. 可见性事件阻断
  //    因为 getter 永远返回 "visible"，
  //    visibilitychange 事件也不应该被页面看到
  // ============================
  try {
    const stopEvent = (evt) => {
      evt.stopImmediatePropagation();
      evt.stopPropagation();
    };

    const visibilityEvents = ['visibilitychange', 'webkitvisibilitychange'];
    visibilityEvents.forEach(type => {
      window.addEventListener(type, stopEvent, true);
      document.addEventListener(type, stopEvent, true);
    });

    // 拦截 onvisibilitychange 属性设置
    Object.defineProperty(document, 'onvisibilitychange', {
      set: () => {},
      get: () => null,
      configurable: true
    });
  } catch (e) {}

  // ============================
  // 4. 焦点事件补偿（核心改进）
  //    不再用 stopImmediatePropagation 阻断 blur/focus，
  //    而是在 blur 后短暂延迟补发一个 focus 事件。
  //    效果：检测系统看到"极短暂切走又切回"，
  //    页面正常逻辑（下拉菜单、表单验证等）不受影响。
  // ============================
  try {
    let focusCompensationTimer = null;

    window.addEventListener('blur', () => {
      clearTimeout(focusCompensationTimer);
      // 随机延迟 30-80ms，模拟自然的焦点切换
      const delay = 30 + Math.random() * 50;
      focusCompensationTimer = setTimeout(() => {
        window.dispatchEvent(new Event('focus'));
      }, delay);
    }, true);

    // 如果真实 focus 事件先于补偿触发，取消补偿
    window.addEventListener('focus', () => {
      clearTimeout(focusCompensationTimer);
    }, true);
  } catch (e) {}

  // ============================
  // 5. addEventListener 拦截
  //    仅阻止页面注册 visibilitychange 监听器
  //    不再拦截 blur/focus/mouseleave 等，避免破坏页面逻辑
  // ============================
  try {
    const blockedRegistrations = ['visibilitychange', 'webkitvisibilitychange'];
    const originalAddEventListener = EventTarget.prototype.addEventListener;

    const fakeAddEventListener = function addEventListener(type, listener, options) {
      if (blockedRegistrations.includes(type)) {
        // 静默丢弃 — 页面永远不知道监听器没有注册
        return;
      }
      return originalAddEventListener.call(this, type, listener, options);
    };
    spoofToString(fakeAddEventListener, originalAddEventListener);
    EventTarget.prototype.addEventListener = fakeAddEventListener;
  } catch (e) {}

  // ============================
  // 6. 右键菜单保护
  //    阻止页面禁用右键，但不阻断传播
  // ============================
  try {
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault = () => {};
    }, true);
  } catch (e) {}

  // ============================
  // 7. 复制粘贴保护
  //    让 preventDefault() 失效，页面无法禁用复制/选择
  // ============================
  try {
    ['copy', 'paste', 'cut', 'selectstart'].forEach(type => {
      document.addEventListener(type, (e) => {
        e.preventDefault = () => {};
      }, true);
    });
  } catch (e) {}

  // ============================
  // 8. 全屏变化拦截
  //    防止考试页面的全屏退出检测
  // ============================
  try {
    const stopEvent = (evt) => {
      evt.stopImmediatePropagation();
      evt.stopPropagation();
    };
    document.addEventListener('fullscreenchange', stopEvent, true);
    document.addEventListener('webkitfullscreenchange', stopEvent, true);
  } catch (e) {}

  // ============================
  // 9. 开发者工具检测拦截
  // ============================

  // 9a. outerWidth/outerHeight 差值检测
  try {
    const originalOuterWidth = Object.getOwnPropertyDescriptor(window, 'outerWidth');
    const originalOuterHeight = Object.getOwnPropertyDescriptor(window, 'outerHeight');

    if (originalOuterWidth) {
      Object.defineProperty(window, 'outerWidth', {
        get: () => window.innerWidth,
        configurable: true
      });
    }

    if (originalOuterHeight) {
      Object.defineProperty(window, 'outerHeight', {
        get: () => window.innerHeight + 80, // 标题栏和地址栏高度
        configurable: true
      });
    }
  } catch (e) {}

  // 9b. debugger 语句拦截 (通过 Function constructor)
  try {
    const originalFunction = Function;
    const fakeFunction = function Function(...args) {
      const code = args[args.length - 1];
      if (typeof code === 'string' && code.includes('debugger')) {
        args[args.length - 1] = code.replace(/debugger/g, '');
      }
      return originalFunction.apply(this, args);
    };
    fakeFunction.prototype = originalFunction.prototype;
    spoofToString(fakeFunction, originalFunction);
    window.Function = fakeFunction;
  } catch (e) {}

  // 9c. eval 中的 debugger
  try {
    const originalEval = window.eval;
    const fakeEval = function (code) {
      if (typeof code === 'string' && code.includes('debugger')) {
        code = code.replace(/debugger/g, '');
      }
      return originalEval.call(this, code);
    };
    nativeFnStore.set(fakeEval, 'function eval() { [native code] }');
    window.eval = fakeEval;
  } catch (e) {}

  // ============================
  // 10. 扩展存在性隐藏
  //     防止页面通过 chrome.runtime 检测扩展
  // ============================
  try {
    if (window.chrome && window.chrome.runtime) {
      const desc = Object.getOwnPropertyDescriptor(window.chrome, 'runtime');
      if (desc && desc.configurable) {
        const origRuntime = window.chrome.runtime;
        Object.defineProperty(window.chrome, 'runtime', {
          get: () => {
            // 检查调用栈：扩展自身的代码路径包含 chrome-extension://
            try {
              throw new Error();
            } catch (e) {
              if (e.stack && e.stack.includes('chrome-extension://')) {
                return origRuntime;
              }
            }
            return undefined;
          },
          configurable: true
        });
      }
    }
  } catch (e) {}

  // ============================
  // 11. console 计时检测拦截
  // ============================
  try {
    const noop = () => {};
    if (console.profile) {
      console.profile = noop;
      console.profileEnd = noop;
    }
  } catch (e) {}

  // ============================
  // 12. Performance.now() 精度降低
  //     防止通过高精度计时检测 debugger 暂停
  // ============================
  try {
    const originalNow = performance.now.bind(performance);
    const fakeNow = function now() {
      return Math.round(originalNow());
    };
    spoofToString(fakeNow, 'now');
    performance.now = fakeNow;
  } catch (e) {}

})();
