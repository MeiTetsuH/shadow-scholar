/* Trusted, packaged interface symbols. Never interpolate provider content here. */
(() => {
  const paths = {
    book: '<path d="M3 4c3-1 6 0 9 2 3-2 6-3 9-2v15c-3-1-6 0-9 2-3-2-6-3-9-2Z"/><path d="M12 6v15"/>',
    idea: '<path d="M9 18h6m-5 3h4M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 2H9s0-1-1-2Z"/>',
    camera: '<path d="M8 5l2-2h4l2 2h4a1 1 0 0 1 1 1v13H3V6a1 1 0 0 1 1-1Z"/><circle cx="12" cy="12" r="4"/>',
    page: '<path d="M14 3H5v18h14V8Z"/><path d="M14 3v5h5M8 12h8m-8 4h5"/>',
    selection: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M7 9h10m-10 4h7m-7 4h4"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    send: '<path d="M12 20V4m-6 6 6-6 6 6"/>',
    copy: '<rect x="8" y="8" width="12" height="13" rx="1"/><path d="M15 8V3H3v13h5"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    settings: '<path d="M3 6h18M3 12h18M3 18h18"/><path d="M8 3v6m8 0v6m-6 0v6"/>',
    clear: '<path d="M5 7h14M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6m4-6v6"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    monitor: '<rect x="3" y="3" width="18" height="13" rx="1"/><path d="M12 16v5m-5 0h10"/>',
  };
  function svg(name, size = 18) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.book}</svg>`;
  }
  function apply(root = document) {
    root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = svg(el.dataset.icon); });
  }
  globalThis.ShadowScholarIcons = Object.freeze({ svg, apply });
})();
