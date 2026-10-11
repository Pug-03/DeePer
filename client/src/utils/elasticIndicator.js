import { useEffect, useLayoutEffect, useRef } from 'react';
import { animate, useMotionValue } from 'framer-motion';

// Elastic sliding capsule for a row of options, the same feel as Home's
// category tabs (CatTabs): the edge in the direction of travel races ahead
// on a snappy spring while the trailing edge lags on a soft one, so the
// capsule stretches across before snapping to the target's width. It also
// tracks top/height, for rows that wrap onto a second line on narrow phones.
//
// Give the row `rowRef`, each option `itemRef(key)`, and render a
// position:absolute element with `style`. `dragHandlers` add press-and-drag
// selection across the row; options need a `data-pick` attribute.
export function useElasticIndicator(active, onPick) {
  const rowRef = useRef(null);
  const items = useRef({});
  const mounted = useRef(false);
  // The capsule is placed by its left edge and its inset from the row's
  // right edge — both plain values, set and animated directly. It used to
  // take a width derived from left/right edges (useTransform), but that
  // derived value could miss the first placement, made in a layout effect
  // before it had subscribed: the capsule then sat at width 0, invisible,
  // until the selection changed. Seen on opening the partner page.
  const leftX = useMotionValue(0);
  const rightInset = useMotionValue(0);
  const top = useMotionValue(0);
  const height = useMotionValue(0);
  // Whether the capsule has been placed on an option yet.
  const placed = useRef(false);

  const moveTo = (key, animated) => {
    const rowEl = rowRef.current;
    const el = items.current[key];
    if (!rowEl || !el) return;
    const rowRect = rowEl.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    // Offsets from the row's padding box, where the absolute capsule lives.
    const l = r.left - rowRect.left - rowEl.clientLeft;
    const ri = rowEl.clientLeft + rowEl.clientWidth - (r.right - rowRect.left);
    const tp = r.top - rowRect.top - rowEl.clientTop;
    // Nothing was selected before (no capsule yet): appear in place rather
    // than stretching in from the row's corner.
    if (!animated || !placed.current) {
      placed.current = true;
      leftX.set(l);
      rightInset.set(ri);
      top.set(tp);
      height.set(r.height);
      return;
    }
    const movingRight = l > leftX.get();
    const LEAD = { type: 'spring', stiffness: 700, damping: 40, mass: 0.6 };
    const LAG = { type: 'spring', stiffness: 170, damping: 26, mass: 1 };
    const ROW = { type: 'spring', stiffness: 400, damping: 34 };
    animate(leftX, l, movingRight ? LAG : LEAD);
    animate(rightInset, ri, movingRight ? LEAD : LAG);
    animate(top, tp, ROW);
    animate(height, r.height, ROW);
  };

  const activeRef = useRef(active);
  activeRef.current = active;

  useLayoutEffect(() => {
    moveTo(activeRef.current, false);
    mounted.current = true;
    // Snap whenever the options change size: the webfont coming in, the
    // window resizing (the row can wrap or unwrap), or the labels changing
    // with the app language.
    const reposition = () => moveTo(activeRef.current, false);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(reposition) : null;
    if (ro) {
      if (rowRef.current) ro.observe(rowRef.current);
      Object.values(items.current).forEach((el) => el && ro.observe(el));
    } else {
      window.addEventListener('resize', reposition);
    }
    document.fonts?.ready?.then(reposition);
    return () => (ro ? ro.disconnect() : window.removeEventListener('resize', reposition));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mounted.current) moveTo(active, true);
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pointer capture keeps the event target on the option the press started
  // on, so look up what's under the finger by coordinate instead.
  const pickAt = (x, y) => {
    const el = document.elementFromPoint(x, y)?.closest('[data-pick]');
    if (el && rowRef.current?.contains(el)) onPick(el.dataset.pick);
  };

  return {
    rowRef,
    itemRef: (key) => (el) => (items.current[key] = el),
    style: { left: leftX, right: rightInset, top, height },
    dragHandlers: {
      onPointerDown: (e) => pickAt(e.clientX, e.clientY),
      onPointerMove: (e) => e.buttons === 1 && pickAt(e.clientX, e.clientY),
    },
  };
}
