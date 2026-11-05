(() => { const run = () => {
(() => {
  if (window.__tentBlocker) return;
  window.__tentBlocker = true;

  let settings = window.__tbYT || {};

  const redirect = (path) => {
    const p = path.split('/').filter(Boolean);
    if (!settings.showSubscriptions && p.join('/') === 'feed/subscriptions') return '/';
    if (settings.showShorts) return null;
    if (p.length === 1 && p[0] === 'shorts') return '/';
    if (p.length === 2 && p[0] === 'shorts') return `/watch?v=${p[1]}`;
    if ((p.length === 2 || p.length === 3) && p[p.length - 1] === 'shorts') return '/' + p.slice(0, -1).join('/');
    return null;
  };

  // What's hidden is decided by classes on <html>, which the stylesheet below keys off.
  // `tb-home` marks the home feed, the only page where recommendations are the whole page.
  const applyClasses = () => {
    const classes = document.documentElement.classList;
    classes.toggle('tb-hide-shorts', !settings.showShorts);
    classes.toggle('tb-hide-subs', !settings.showSubscriptions);
    classes.toggle('tb-hide-recs', !settings.showRecommendations);
    classes.toggle('tb-home', location.pathname === '/');
  };

  // YouTube changes pages in place (history.pushState), which never reaches the app's navigation delegate.
  const check = () => {
    const target = redirect(location.pathname);
    if (target) return location.replace(target);
    applyClasses();
  };
  for (const name of ['pushState', 'replaceState']) {
    const original = history[name];
    history[name] = function (...args) {
      const result = original.apply(this, args);
      check();
      return result;
    };
  }
  addEventListener('popstate', check);
  check();

  // Called by the app when a setting changes while the page is open.
  window.__tbYTApply = (next) => {
    settings = next;
    check();
  };

  // Catch taps on links to hidden pages before YouTube's router opens them (e.g. the Shorts player).
  addEventListener('click', (event) => {
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    const url = new URL(link.href, location.href);
    if (!/(^|\.)youtube\.com$/.test(url.hostname)) return;
    const target = redirect(url.pathname);
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    location.assign(target);
  }, true);

  const style = document.createElement('style');
  style.textContent = `
    /* Always: the "Open App" banners. */
    ytm-mealbar-promo-renderer,
    .open-app-button { display: none !important; }

    /* Shorts: the bottom-bar tab, shelves, Shorts thumbnails in feeds and search, a channel's Shorts tab. */
    .tb-hide-shorts ytm-pivot-bar-item-renderer:has(.pivot-shorts),
    .tb-hide-shorts ytm-pivot-bar-item-renderer:has(a[href^="/shorts"]),
    .tb-hide-shorts ytm-reel-shelf-renderer,
    .tb-hide-shorts ytm-shorts-lockup-view-model,
    .tb-hide-shorts ytm-shorts-lockup-view-model-v2,
    .tb-hide-shorts ytm-rich-section-renderer:has(ytm-reel-shelf-renderer),
    .tb-hide-shorts ytm-rich-section-renderer:has(ytm-shorts-lockup-view-model),
    .tb-hide-shorts ytm-rich-section-renderer:has(ytm-shorts-lockup-view-model-v2),
    .tb-hide-shorts ytm-rich-item-renderer:has(a[href^="/shorts/"]),
    .tb-hide-shorts ytm-video-with-context-renderer:has(a[href^="/shorts/"]),
    .tb-hide-shorts ytm-compact-video-renderer:has(a[href^="/shorts/"]),
    .tb-hide-shorts ytm-item-section-renderer:has(> ytm-reel-shelf-renderer),
    .tb-hide-shorts grid-shelf-view-model:has(ytm-shorts-lockup-view-model),
    .tb-hide-shorts grid-shelf-view-model:has(ytm-shorts-lockup-view-model-v2),
    .tb-hide-shorts a[href$="/shorts"][role="tab"],
    .tb-hide-shorts .scbrr-tab[href$="/shorts"],
    .tb-hide-shorts .tb-shorts { display: none !important; }

    /* Subscriptions: the bottom-bar tab and links to the feed. */
    .tb-hide-subs ytm-pivot-bar-item-renderer:has(.pivot-subs),
    .tb-hide-subs ytm-pivot-bar-item-renderer:has(a[href="/feed/subscriptions"]),
    .tb-hide-subs a[href="/feed/subscriptions"],
    .tb-hide-subs .tb-subs { display: none !important; }

    /* Recommendations: the home feed and its topic chips, the videos under the player,
       and the suggestions over the player when a video ends. */
    .tb-hide-recs.tb-home ytm-browse > *,
    .tb-hide-recs ytm-item-section-renderer[section-identifier="related-items"],
    .tb-hide-recs ytm-item-section-renderer[data-content-type="related"],
    .tb-hide-recs ytm-watch-next-secondary-results-renderer,
    .tb-hide-recs .ytm-autonav-bar,
    .tb-hide-recs .ytp-autonav-endscreen,
    .tb-hide-recs .ytp-endscreen-content,
    .tb-hide-recs .html5-endscreen,
    .tb-hide-recs .ytp-ce-element,
    .tb-hide-recs .ytp-pause-overlay { display: none !important; }
    .tb-hide-recs.tb-home ytm-browse::before {
      content: 'Recommendations are off. Search for something to watch.';
      display: block;
      padding: 64px 32px;
      text-align: center;
      font-size: 15px;
      color: #888;
    }
  `;
  const addStyle = () => (document.head || document.documentElement).appendChild(style);
  if (document.head) addStyle(); else addEventListener('DOMContentLoaded', addStyle);

  // Some entries are only recognisable by their label: Shorts filter chips and channel tabs,
  // and the bottom-bar tabs, whose markup doesn't say which tab they are.
  const labelled = { Shorts: 'tb-shorts', Subscriptions: 'tb-subs' };
  // At most once a frame, however many mutations YouTube makes while rendering.
  let scheduled = false;
  const onMutation = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyClasses(); // in case YouTube rewrote <html>'s classes
      for (const el of document.querySelectorAll('ytm-chip-cloud-chip-renderer, [role="tab"], ytm-pivot-bar-item-renderer')) {
        const name = labelled[el.textContent.trim()];
        if (name) el.classList.add(name);
      }
    });
  };
  new MutationObserver(onMutation).observe(document.documentElement, { childList: true, subtree: true });
})();
}; if (document.documentElement) run(); else new MutationObserver(function(_, o) { if (document.documentElement) { o.disconnect(); run(); } }).observe(document, {childList:true}); })();
