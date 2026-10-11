import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// Scroll handling for client-side route changes:
// - A new navigation (link / button → PUSH or REPLACE) starts the page at the
//   top, so e.g. a dev's awards page doesn't open already scrolled halfway.
// - Going back (browser back, or a Back button that calls nav(-1) → POP)
//   returns to where the visitor had scrolled on that page, instead of
//   restarting it from the top.
// Positions are remembered per history entry (location.key), so the same
// page opened twice keeps two separate spots.
const KEY = 'dt_scroll_positions';

// Kept in memory while scrolling, written to sessionStorage only once the
// scrolling stops (and when the tab is hidden), so a reload still returns
// to the spot. Parsing and rewriting the whole storage entry on every
// scroll frame, as before, was synchronous work in the middle of each
// frame and made scrolling stutter, most of all on the long landing page.
let positions = null;
function readAll() {
  if (positions) return positions;
  try {
    positions = JSON.parse(sessionStorage.getItem(KEY) || '{}');
  } catch {
    positions = {};
  }
  return positions;
}

function persist() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(readAll()));
  } catch {
    // storage blocked (private mode etc.) — just don't remember
  }
}

function save(entryKey, y) {
  readAll()[entryKey] = y;
}

// The very first page the app renders also reports a POP navigation; only a
// POP after the app has moved between pages is a real "came back". Tracked
// by entry key (not a simple flag) so React's dev-mode double effects don't
// mistake the first page for a return.
let lastKey = null;
let moves = 0;
function isReturn(navType, key) {
  return navType === 'POP' && lastKey !== null && (key !== lastKey || moves > 0);
}

// True while the current page was reached by going back (Back button or
// browser back) rather than opened fresh or loaded first.
export function useReturning() {
  const navType = useNavigationType();
  const { key } = useLocation();
  return isReturn(navType, key);
}

export default function ScrollToTop() {
  const location = useLocation();
  const navType = useNavigationType();
  // Which history entry scroll events belong to. Updated before the new
  // page scrolls, so its scroll-to-top never overwrites the spot saved for
  // the page being left.
  const current = useRef(location.key);

  // We restore positions ourselves; stop the browser doing its own.
  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    let idle = 0;
    // Just a number into memory now, so no need to batch it into a frame.
    const onScroll = () => {
      save(current.current, window.scrollY);
      clearTimeout(idle);
      idle = setTimeout(persist, 250);
    };
    const onHide = () => document.visibilityState === 'hidden' && persist();
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', persist);
    return () => {
      clearTimeout(idle);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', persist);
    };
  }, []);

  useLayoutEffect(() => {
    current.current = location.key;
    // Coming back to a page it shouldn't replay its entrance (fade/rise)
    // animations on top of the jump to the old scroll spot; styles.css turns
    // them off while this flag is set. Kept until the next navigation, since
    // clearing it mid-page would restart those animations.
    const returning = isReturn(navType, location.key);
    if (lastKey !== null && location.key !== lastKey) moves += 1;
    lastKey = location.key;
    if (returning) document.documentElement.dataset.returning = '';
    else delete document.documentElement.dataset.returning;
    const target = returning ? readAll()[location.key] || 0 : 0;
    window.scrollTo(0, target);
    if (!target) return undefined;
    // The page may still be loading content (stats, lists) and be too short
    // to reach the old spot yet; retry briefly until it's tall enough. But
    // the moment the visitor scrolls themselves, stop: a retry landing
    // mid-swipe yanked the page back to the old spot — the small "warp"
    // seen scrolling right after coming back from an awards page.
    let userMoved = false;
    const stop = () => {
      userMoved = true;
    };
    const opts = { passive: true, capture: true };
    const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    events.forEach((ev) => window.addEventListener(ev, stop, opts));
    const timers = [80, 200, 400, 800].map((ms) =>
      setTimeout(() => {
        if (!userMoved && Math.abs(window.scrollY - target) > 2) window.scrollTo(0, target);
      }, ms),
    );
    return () => {
      timers.forEach(clearTimeout);
      events.forEach((ev) => window.removeEventListener(ev, stop, opts));
    };
  }, [location.key, navType]);

  return null;
}
