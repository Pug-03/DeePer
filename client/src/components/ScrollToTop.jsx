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

function readAll() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

function save(entryKey, y) {
  try {
    const all = readAll();
    all[entryKey] = y;
    sessionStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // storage blocked (private mode etc.) — just don't remember
  }
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
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => save(current.current, window.scrollY));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
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
    // to reach the old spot yet; retry briefly until it's tall enough.
    const timers = [80, 200, 400, 800].map((ms) =>
      setTimeout(() => {
        if (Math.abs(window.scrollY - target) > 2) window.scrollTo(0, target);
      }, ms),
    );
    return () => timers.forEach(clearTimeout);
  }, [location.key, navType]);

  return null;
}
