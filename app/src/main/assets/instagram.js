(() => { const run = () => {
(() => {
  if (window.__tentBlocker) return;
  window.__tentBlocker = true;

  // ---- Reels -------------------------------------------------------------

  const reelsRedirect = (path) => {
    const p = path.split('/').filter(Boolean);
    if (p.length === 1 && p[0] === 'reels') return '/';
    if (p.length === 2 && p[0] === 'reels') return `/reel/${p[1]}/`;
    if (p.length === 2 && p[1] === 'reels') return `/${p[0]}/`;
    return null;
  };

  const post = (message) => window.tentBlocker?.postMessage(JSON.stringify(message));

  // The transition currently running, if any (see startTransition).
  let activeTransition = null;

  const onNavigate = () => {
    const target = reelsRedirect(location.pathname);
    if (target) return location.replace(target);
    // Telling the app can show or hide the tab bar, which resizes the page, and WebKit cancels a
    // view transition when the page changes size. So during one, tell the app once it's done.
    const report = () => post({ kind: 'path', path: location.pathname });
    if (activeTransition) activeTransition.finished.finally(report); else report();
  };

  // ---- Page transitions ---------------------------------------------------
  // Instagram changes pages in place (history.pushState), so there's no native navigation to
  // animate. WebKit's View Transitions snapshot the page as it was, let Instagram render the new
  // page, then run the CSS animations below between the two.

  const transitionFor = (from, to, back) => {
    const isStory = (p) => p.startsWith('/stories/');
    if (from === to || (isStory(from) && isStory(to))) return null; // next story: Instagram animates it
    // Opening a story isn't animated: Instagram draws the story before changing the page address,
    // so both snapshots would show the story.
    if (isStory(to)) return null;
    if (isStory(from)) return 'story-close';
    if (profileTabSwitch(from, to)) return `profile-tab:${from}:${to}`;
    return back ? 'back' : 'forward';
  };

  // ---- Profile tabs (posts / reposts / tagged / saved) ----
  // Switching tabs only changes the grid below the tab row, so only that part slides; the header and
  // tabs stay put. The grid gets its own view-transition-name so it animates separately from the page.

  const PROFILE_TABS = ['tagged', 'reposts', 'saved'];
  const NOT_PROFILES = ['p', 'reel', 'reels', 'explore', 'direct', 'accounts', 'stories', 'notifications', 'create'];
  const profileOf = (path) => {
    const p = path.split('/').filter(Boolean);
    if (!p.length || NOT_PROFILES.includes(p[0])) return null;
    if (p.length === 1) return { user: p[0], tab: '' };
    if (p.length === 2 && PROFILE_TABS.includes(p[1])) return { user: p[0], tab: p[1] };
    return null;
  };
  const profileTabSwitch = (from, to) => {
    const a = profileOf(from), b = profileOf(to);
    return !!(a && b && a.user === b.user && a.tab !== b.tab);
  };

  // The tab row's links, and the element holding the posts below it.
  const profileTabLinks = (user) => [...document.querySelectorAll('main a[href^="/"]')].filter((a) => {
    const p = profileOf(pathOf(a));
    return p && p.user === user && p.tab;
  });
  const profileGrid = (user) => {
    const links = profileTabLinks(user);
    if (!links.length) return null;
    let row = links[0].parentElement;
    while (row && !links.every((l) => row.contains(l))) row = row.parentElement;
    // A single non-posts tab: widen to include the posts tab link (href = /user/).
    while (row && links.length === 1 && ![...row.querySelectorAll('a[href^="/"]')].some((a) => pathOf(a) === `/${user}/`)) row = row.parentElement;
    // The posts are in whatever follows the tab row: take the tallest, climbing past empty spacers.
    for (let el = row; el && el.tagName !== 'MAIN'; el = el.parentElement) {
      const after = [];
      for (let sib = el.nextElementSibling; sib; sib = sib.nextElementSibling) after.push(sib);
      if (!after.length) continue;
      const tallest = after.reduce((a, b) => (b.getBoundingClientRect().height > a.getBoundingClientRect().height ? b : a));
      if (tallest.getBoundingClientRect().height > 1) return tallest;
    }
    return null;
  };
  // Slide toward the tab that was picked: the tab further right slides in from the right.
  const profileTabDirection = (from, to) => {
    const a = profileOf(from), b = profileOf(to);
    const x = (tab) => {
      if (!tab) return -1; // the posts tab is always first
      const link = profileTabLinks(a.user).find((l) => profileOf(pathOf(l)).tab === tab);
      return link ? link.getBoundingClientRect().left : 0;
    };
    return x(b.tab) >= x(a.tab) ? 'forward' : 'back';
  };

  // Runs `update` (if any) after WebKit has captured the current page, then waits for Instagram to
  // replace it before animating. Instagram often fetches the next page before drawing it, so a
  // quiet DOM isn't enough: wait until the post or section that was in the middle of the screen
  // is gone or covered (a carousel changing photos inside it doesn't count).
  const startTransition = (kind, update = () => {}) => {
    if (!kind || !document.startViewTransition || document.visibilityState !== 'visible') return update();
    const root = document.documentElement;
    if (kind.startsWith('profile-tab')) return startProfileTabTransition(kind, update);
    root.dataset.tbTransition = kind;
    const centre = () => document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    const hit = centre();
    const anchor = hit && (hit.closest('article') || hit);
    const transition = document.startViewTransition(() => new Promise((resolve) => {
      update();
      const started = Date.now();
      const check = () => {
        const now = centre();
        const replaced = !anchor || !anchor.isConnected || !now || !anchor.contains(now);
        // A beat after the change so the new page finishes laying out; capped so a slow page
        // isn't held frozen (it then just appears without animating).
        if (replaced) return setTimeout(resolve, 40);
        if (Date.now() - started > 1000) return resolve();
        setTimeout(check, 30);
      };
      check();
    }));
    track(transition, kind);
  };

  const track = (transition, kind, cleanup = () => {}) => {
    const root = document.documentElement;
    activeTransition = transition;
    transition.finished.finally(() => {
      if (root.dataset.tbTransition === kind) delete root.dataset.tbTransition;
      if (activeTransition === transition) activeTransition = null;
      cleanup();
    });
  };

  // kind is 'profile-tab:<from>:<to>'. Only the grid animates; the rest of the page cuts over at once.
  const startProfileTabTransition = (kind, update) => {
    const [, from, to] = kind.split(':');
    const user = profileOf(from).user;
    const oldGrid = profileGrid(user);
    if (!oldGrid) return update();
    const root = document.documentElement;
    const direction = profileTabDirection(from, to);
    root.dataset.tbTransition = `profile-tab-${direction}`;
    const named = new Set();
    const name = (el) => { el.style.viewTransitionName = 'tb-profile-grid'; named.add(el); };
    name(oldGrid);
    const transition = document.startViewTransition(() => new Promise((resolve) => {
      // Release the old grid's name so the new grid (often the same element, refilled) can take it.
      oldGrid.style.viewTransitionName = '';
      update();
      // Wait for Instagram to swap the grid's contents, then a beat to settle; capped.
      let settle;
      const done = () => {
        observer.disconnect(); clearTimeout(cap);
        const newGrid = profileGrid(user);
        if (newGrid) name(newGrid);
        resolve();
      };
      const observer = new MutationObserver(() => { clearTimeout(settle); settle = setTimeout(done, 60); });
      observer.observe(document.querySelector('main') || document.body, { childList: true, subtree: true });
      const cap = setTimeout(done, 700);
    }));
    track(transition, root.dataset.tbTransition, () => named.forEach((el) => { el.style.viewTransitionName = ''; }));
  };

  // iOS-style push/pop: the new page slides in from the right over the old one, which shifts left
  // and dims; back is the reverse. A closing story shrinks and fades away. Profile tabs: the page
  // stays put and only the grid slides sideways.
  const TRANSITION_CSS = `
    html[data-tb-transition]::view-transition-old(root),
    html[data-tb-transition]::view-transition-new(root) {
      animation-duration: .35s; animation-timing-function: cubic-bezier(.2, .8, .2, 1);
      animation-fill-mode: both; mix-blend-mode: normal;
    }
    html[data-tb-transition="forward"]::view-transition-old(root) { animation-name: tb-shift-left; }
    html[data-tb-transition="forward"]::view-transition-new(root) { animation-name: tb-from-right; box-shadow: -8px 0 24px rgba(0,0,0,.15); }
    html[data-tb-transition="back"]::view-transition-old(root) { animation-name: tb-to-right; z-index: 1; box-shadow: -8px 0 24px rgba(0,0,0,.15); }
    html[data-tb-transition="back"]::view-transition-new(root) { animation-name: tb-from-left; }
    html[data-tb-transition="story-close"]::view-transition-old(root) { animation-name: tb-zoom-out; z-index: 1; }
    html[data-tb-transition="story-close"]::view-transition-new(root) { animation-name: none; }
    html[data-tb-transition^="profile-tab"]::view-transition-old(root),
    html[data-tb-transition^="profile-tab"]::view-transition-new(root) { animation: none; }
    html[data-tb-transition^="profile-tab"]::view-transition-group(tb-profile-grid) { animation: none; overflow: hidden; }
    html[data-tb-transition^="profile-tab"]::view-transition-old(tb-profile-grid),
    html[data-tb-transition^="profile-tab"]::view-transition-new(tb-profile-grid) {
      animation-duration: .3s; animation-timing-function: cubic-bezier(.2, .8, .2, 1);
      animation-fill-mode: both; mix-blend-mode: normal; height: auto;
    }
    html[data-tb-transition="profile-tab-forward"]::view-transition-old(tb-profile-grid) { animation-name: tb-to-left; }
    html[data-tb-transition="profile-tab-forward"]::view-transition-new(tb-profile-grid) { animation-name: tb-from-right; }
    html[data-tb-transition="profile-tab-back"]::view-transition-old(tb-profile-grid) { animation-name: tb-to-right; }
    html[data-tb-transition="profile-tab-back"]::view-transition-new(tb-profile-grid) { animation-name: tb-from-left-full; }
    @keyframes tb-to-left { to { transform: translateX(-100%); } }
    @keyframes tb-from-left-full { from { transform: translateX(-100%); } }
    @keyframes tb-from-right { from { transform: translateX(100%); } }
    @keyframes tb-shift-left { to { transform: translateX(-30%); filter: brightness(.85); } }
    @keyframes tb-to-right { to { transform: translateX(100%); } }
    @keyframes tb-from-left { from { transform: translateX(-30%); filter: brightness(.85); } }
    @keyframes tb-zoom-out { to { transform: scale(.88); opacity: 0; } }
  `;

  let lastPath = location.pathname;
  let alreadyAnimating = false; // set when a transition was started before the navigation (below)
  const navigated = (back) => {
    const from = lastPath;
    lastPath = location.pathname;
    if (alreadyAnimating) { alreadyAnimating = false; return onNavigate(); }
    // The edge-swipe back gesture animates by itself (the app sets __tbSwipeBack when it starts).
    const swiped = back && Date.now() - (window.__tbSwipeBack || 0) < 3000;
    if (swiped) window.__tbSwipeBack = 0;
    if (!swiped) startTransition(transitionFor(from, lastPath, back));
    onNavigate();
  };

  // Going back, Instagram draws the (cached) previous page the moment the history changes, before
  // WebKit can capture the page being left. So start the transition first, and only navigate once
  // the current page has been captured.
  const transitionThen = (kind, go) => {
    if (!document.startViewTransition || activeTransition) return go();
    startTransition(kind, () => { alreadyAnimating = true; go(); });
  };
  const leaveKind = () => (location.pathname.startsWith('/stories/') ? 'story-close' : 'back');

  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function (...args) {
      const result = original.apply(this, args);
      if (method === 'pushState') navigated(false); else { lastPath = location.pathname; onNavigate(); }
      return result;
    };
  }
  addEventListener('popstate', () => navigated(true));

  const originalBack = history.back.bind(history);
  history.back = () => transitionThen(leaveKind(), originalBack);
  const originalGo = history.go.bind(history);
  history.go = (delta) => (delta < 0 ? transitionThen(leaveKind(), () => originalGo(delta)) : originalGo(delta));

  // Instagram's back arrows (labelled "Back") are links to the previous page, so they change the screen
  // before the page address. Hold the tap, capture the page, then replay the tap to Instagram.
  // (A story's X calls history.go(-1), handled above.)
  let replaying = false;
  addEventListener('click', (event) => {
    if (replaying || !document.startViewTransition) return;
    const control = event.target.closest('a, button, [role="button"]');
    const label = (event.target.closest('svg')?.getAttribute('aria-label')
      || control?.getAttribute('aria-label') || '').toLowerCase();
    if (!control || label !== 'back') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    // Replay on the exact element tapped (Instagram's handler may sit on an inner element), as a
    // MouseEvent since SVG elements have no click().
    const tapped = event.target;
    const replay = () => {
      replaying = true;
      tapped.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      replaying = false;
    };
    transitionThen('back', replay);
  }, true);
  onNavigate();

  const pathOf = (a) => {
    try { return new URL(a.getAttribute('href'), location.href).pathname; } catch { return ''; }
  };

  const hide = (el) => {
    el.style.setProperty('display', 'none', 'important');
    el.dataset.tbHidden = '1';
  };

  // Hide the bottom-bar Reels tab and the Reels tab on profiles. Each tab sits in its
  // own wrapper, so climb to the outermost ancestor that contains no other link.
  const hideReelsTabs = () => {
    for (const a of document.querySelectorAll('a[href*="reels"]:not([data-tb-hidden])')) {
      const p = pathOf(a).split('/').filter(Boolean);
      const isTab = (p.length === 1 && p[0] === 'reels') || (p.length === 2 && p[1] === 'reels');
      if (!isTab) continue;
      let slot = a;
      while (slot.parentElement && slot.parentElement !== document.body &&
             slot.parentElement.querySelectorAll('a').length === 1) {
        slot = slot.parentElement;
      }
      hide(a);
      hide(slot);
    }
  };

  // ---- "Use the app" prompts ----------------------------------------------

  const APP_PROMPT = /\b(open|use|get|download|install|switch to|continue (in|on)|try)( the)?( instagram)? app\b|^open instagram$|\bin the (instagram )?app\b/i;
  const DISMISS = /^(not now|cancel|close|dismiss|no thanks|maybe later|continue on web|stay on web)$/i;

  const textOf = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();

  const isPinned = (el) => {
    const pos = getComputedStyle(el).position;
    return pos === 'fixed' || pos === 'sticky';
  };

  const removePrompts = () => {
    // Prompt dialogs / bottom sheets: press their own "Not now" button if there is one.
    for (const dialog of document.querySelectorAll('[role="dialog"]:not([data-tb-hidden])')) {
      const text = textOf(dialog);
      if (text.length > 400 || !APP_PROMPT.test(text)) continue;
      const dismiss = [...dialog.querySelectorAll('button, [role="button"], a')]
        .find((b) => DISMISS.test(textOf(b)) || /^close$/i.test(b.getAttribute('aria-label') || ''));
      if (dismiss) {
        dismiss.click();
      } else {
        let overlay = dialog;
        while (overlay.parentElement && overlay.parentElement !== document.body && !isPinned(overlay)) {
          overlay = overlay.parentElement;
        }
        hide(overlay);
        document.body.style.removeProperty('overflow');
      }
    }

    // Inline buttons and banners ("Open app", "Open Instagram", "Use the app"...).
    for (const btn of document.querySelectorAll('button, [role="button"], a')) {
      if (btn.closest('[data-tb-hidden]')) continue;
      const text = textOf(btn);
      if (!text || text.length > 40 || !APP_PROMPT.test(text)) continue;
      hide(btn);
      // If it lives in a small pinned banner with nothing else to tap but a close button, drop the banner.
      for (let el = btn.parentElement; el && el !== document.body; el = el.parentElement) {
        if (el.querySelectorAll('a[href^="/"]').length > 0) break;
        if (el.querySelectorAll('button, [role="button"]').length > 2) break;
        if (isPinned(el)) { hide(el); break; }
      }
    }
  };

  // ---- Discover (the grid of suggested posts on the Search tab) ------------
  // Marked here, and hidden by CSS while the app turns Discover off (html.tb-no-discover), so the
  // search bar and search results still work. Only on /explore/ itself: tag and place pages are results.

  const isPostPath = (path) => /(^|\/)(p|reel)\/[^/]+\/?$/.test(path);
  const markDiscover = () => {
    const explore = location.pathname === '/explore/';
    document.documentElement.classList.toggle('tb-explore', explore);
    const main = explore && document.querySelector('main');
    if (!main) return;
    for (const a of main.querySelectorAll('a[href]:not([data-tb-discover] a)')) {
      if (!isPostPath(pathOf(a))) continue;
      // Climb to the outermost block holding nothing but posts: the grid.
      let grid = a;
      for (let el = a.parentElement; el && el !== main; el = el.parentElement) {
        if (el.querySelector('input, [role="search"]')) break;
        if ([...el.querySelectorAll('a[href]')].some((l) => !isPostPath(pathOf(l)))) break;
        grid = el;
      }
      grid.dataset.tbDiscover = '1';
    }
  };

  // ---- Instagram's own tab bar (replaced by the app's native one) ---------

  // The pinned bar that holds both the Explore and Direct links.
  const findWebNav = () => {
    const cached = document.querySelector('[data-tb-nav]');
    if (cached) return cached;
    for (const a of document.querySelectorAll('a[href="/explore/"]')) {
      for (let el = a.parentElement; el && el !== document.body; el = el.parentElement) {
        if (!isPinned(el)) continue;
        if (!el.querySelector('a[href*="direct"]')) break;
        // The bar is wrapped in more pinned layers (one draws its top border); take the outermost
        // one that still holds nothing but the tab links.
        const count = el.querySelectorAll('a').length;
        let nav = el;
        for (let up = el.parentElement; up && up !== document.body; up = up.parentElement) {
          if (up.querySelectorAll('a').length !== count) break;
          if (isPinned(up)) nav = up;
        }
        nav.dataset.tbNav = '1';
        return nav;
      }
    }
    return null;
  };

  let lastReport = '';
  const handleWebNav = () => {
    const nav = findWebNav();
    if (!nav) return;
    if (!nav.dataset.tbHidden) hide(nav);

    const links = [...nav.querySelectorAll('a')];
    const profile = links.find((a) => a.querySelector('img')) || links[links.length - 1];
    const direct = links.find((a) => (a.getAttribute('href') || '').includes('direct'));
    const state = {
      kind: 'nav',
      profilePath: profile ? pathOf(profile) : null,
      avatar: profile?.querySelector('img')?.src || null,
      unread: parseInt((direct?.textContent || '').replace(/\D/g, ''), 10) || 0,
    };
    const key = JSON.stringify(state);
    if (key === lastReport) return;
    lastReport = key;
    post(state);
  };

  // Instagram leaves a gap the height of its own tab bar (--mobile-nav-height) under the page, as a
  // bottom margin on an ancestor of <main>. With that bar replaced, close the gap so the comment box
  // etc. sit at the bottom. (The variable itself can't be zeroed: the top bar sizes itself from it.)
  const removeNavGap = () => {
    const main = document.querySelector('main');
    const navHeight = getComputedStyle(document.documentElement).getPropertyValue('--mobile-nav-height').trim();
    if (!main || !navHeight || navHeight === '0px') return;
    for (let el = main; el && el !== document.body; el = el.parentElement) {
      const cs = getComputedStyle(el);
      if (cs.marginBottom === navHeight) el.style.setProperty('margin-bottom', '0px', 'important');
      if (cs.paddingBottom === navHeight) el.style.setProperty('padding-bottom', '0px', 'important');
    }
  };

  // Used by the native tab bar: navigate in-page through the hidden link when possible (no reload).
  window.__tentBlockerGo = (path) => {
    const link = [...document.querySelectorAll('[data-tb-nav] a')].find((a) => pathOf(a) === path);
    if (!link) return location.assign(path);
    if (location.pathname === path) return link.click();
    transitionThen('back', () => link.click()); // returning to the tab's first page reads as going back
  };

  // ---- Run on every DOM change -------------------------------------------

  const style = document.createElement('style');
  // On full-screen pages (comments, DM threads; the app sets the class), also zero the tab-bar height
  // Instagram sizes things like the comments list with. Only there: on the feed, Discover and post
  // pages, content inside <main> uses it to sit below the top bar.
  style.textContent = 'a[href="/reels/"]{display:none!important}' +
    ' html.tb-full-screen main * { --mobile-nav-height: 0px !important; }' +
    // The grid's later siblings go too: the spinner there would otherwise keep loading more posts.
    ' html.tb-no-discover.tb-explore :is([data-tb-discover], [data-tb-discover] ~ *) { display: none !important; }' +
    ' html.tb-no-discover.tb-explore main::after { content: "Discover is off. Search for people, tags and places.";' +
    ' display: block; padding: 64px 32px; text-align: center; font-size: 15px; color: #888; }' +
    TRANSITION_CSS;
  (document.head || document.documentElement).appendChild(style);

  let overlayOpen = false;
  const reportOverlay = () => {
    // The share sheet's dialog element is tall but only a few points wide, so don't go by width.
    const open = [...document.querySelectorAll('[role="dialog"]')].some((d) => {
      const r = d.getBoundingClientRect();
      return r.height > 0 && (d.getAttribute('aria-modal') === 'true' || r.height > innerHeight * 0.3);
    });
    if (open !== overlayOpen) { overlayOpen = open; post({ kind: 'overlay', open }); }
  };

  let queued = false;
  const sweep = () => {
    queued = false;
    hideReelsTabs();
    markDiscover();
    handleWebNav();
    removeNavGap();
    removePrompts();
    reportOverlay();
  };
  const schedule = () => {
    if (!queued) { queued = true; requestAnimationFrame(sweep); }
  };
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener('DOMContentLoaded', schedule);
})();
}; if (document.documentElement) run(); else new MutationObserver(function(_, o) { if (document.documentElement) { o.disconnect(); run(); } }).observe(document, {childList:true}); })();
