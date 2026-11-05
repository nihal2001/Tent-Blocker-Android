// Keep shared reels playable without opening the endless Reels viewer.
(() => {
  if (window.__tbReelGuard) return;
  window.__tbReelGuard = true;
  const reelId = path => /^\/reels?\/([^/]+)(?:\/|$)/.exec(path)?.[1] || null;
  const isPanel = target => {
    if (target?.closest?.('input, textarea, select, [contenteditable="true"]')) return true;
    const dialog = target?.closest?.('[role="dialog"], [aria-modal="true"]');
    // Instagram can render the entire reel viewer as a dialog. Only exempt
    // separate panels (comments/share), not a dialog containing the video.
    return !!dialog && !dialog.querySelector('video');
  };
  let pinned = reelId(location.pathname);
  let pinnedPath = pinned ? location.pathname : null;
  const inViewer = () => !!pinned && /^\/reels?\/[^/]+\/?$/.test(location.pathname);
  const locked = new Map();
  const unlock = () => {
    for (const element of locked.keys()) element.removeAttribute('data-tb-reel-scroll');
    locked.clear();
    document.documentElement?.classList.remove('tb-single-reel');
  };
  const sync = () => {
    const id = reelId(location.pathname);
    if (!id) { pinned = null; pinnedPath = null; unlock(); return; }
    if (pinned && id !== pinned) { location.replace(pinnedPath); return; }
    pinned = id;
    pinnedPath = '/reel/' + id + '/';
    if (!inViewer()) { unlock(); return; }
    document.documentElement?.classList.add('tb-single-reel');
    // Lock every scroller surrounding a video, including nested snap-scroll viewers.
    // Do not touch comment/share dialogs or their scroll containers.
    for (const video of document.querySelectorAll('video')) {
      if (isPanel(video)) continue;
      for (let el = video.parentElement; el; el = el.parentElement) {
        if (el.scrollHeight <= el.clientHeight + 1 || locked.has(el)) continue;
        locked.set(el, {top: el.scrollTop, left: el.scrollLeft});
        el.setAttribute('data-tb-reel-scroll', '');
      }
    }
  };
  const stop = event => { event.preventDefault(); event.stopImmediatePropagation(); };
  const stopGesture = event => {
    if (inViewer() && !isPanel(event.target)) stop(event);
  };
  for (const type of ['touchmove', 'wheel']) window.addEventListener(type, stopGesture, {capture:true, passive:false});
  window.addEventListener('keydown', event => {
    if (['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key)) stopGesture(event);
  }, true);
  window.addEventListener('click', event => {
    if (!pinned || isPanel(event.target)) return;
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    const url = new URL(link.getAttribute('href'), location.href);
    const next = reelId(url.pathname);
    if (url.origin === location.origin && next && next !== pinned) stop(event);
  }, true);
  document.addEventListener('scroll', event => {
    const el = event.target === document ? document.scrollingElement : event.target;
    const position = locked.get(el);
    if (pinned && position && !isPanel(el)) {
      if (el.scrollTop !== position.top) el.scrollTop = position.top;
      if (el.scrollLeft !== position.left) el.scrollLeft = position.left;
    }
  }, true);
  for (const method of ['pushState','replaceState']) {
    const original = history[method];
    history[method] = function (...args) {
      const url = args[2] == null ? null : new URL(args[2], location.href);
      const next = url && reelId(url.pathname);
      if (pinned && next && next !== pinned && url.origin === location.origin) {
        // Reload the pinned reel if Instagram has already replaced the video before updating history.
        location.replace(pinnedPath);
        return;
      }
      const result = original.apply(this, args);
      sync();
      return result;
    };
  }
  window.addEventListener('popstate', () => { pinned = null; sync(); });
  const install = () => {
    if (!document.documentElement) return false;
    const style = document.createElement('style');
    style.textContent = 'html.tb-single-reel,html.tb-single-reel body,html.tb-single-reel [data-tb-reel-scroll]{overflow:hidden!important;overscroll-behavior:none!important;scroll-snap-type:none!important}' +
      'html.tb-single-reel video{touch-action:none!important}';
    document.documentElement.appendChild(style);
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; sync(); });
    }).observe(document.documentElement, {childList:true,subtree:true});
    sync();
    return true;
  };
  if (!install()) {
    const observer = new MutationObserver(() => { if (install()) observer.disconnect(); });
    observer.observe(document, {childList:true});
  }
})();
