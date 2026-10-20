import { Fragment, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useReturning } from '../components/ScrollToTop.jsx';
import { motion, useInView, useReducedMotion, animate, cubicBezier } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useI18n } from '../store/i18n.jsx';
import { api } from '../api.js';
import LangToggle from '../components/LangToggle.jsx';
import Sparkles from '../components/Sparkles.jsx';
import Fireworks from '../components/Fireworks.jsx';
import {
  IcSparkle,
  IcMousePointer,
  IcCards,
  IcUser,
  IcPlus,
  IcShare,
  IcHistory,
  IcFileText,
  IcInstagram,
  IcTikTok,
} from '../components/icons.jsx';
import { DEV_TEAM } from '../dev-team-info.js';
import { unbreakablePhrases } from '../utils/phrases.jsx';
import { useLaunch } from '../launch.js';
import Countdown from '../components/Countdown.jsx';
import DiveStory from '../components/DiveStory.jsx';
import DeepWater, { DepthGauge } from '../components/DeepWater.jsx';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { SPONSORS, SPONSOR_TIERS, SUPPORTERS } from '../sponsors-info.js';
import { socialLinks } from '../social-info.js';
// `import.meta.env.DEV` below is a compile-time constant, so Vite's
// production build dead-code-eliminates the branch that reads this import —
// this fixture (and its placeholder strings) never reaches the shipped
// bundle. See client/src/dev/mockSupporters.js for the full explanation.
import { makeMockSupportersDevOnly } from '../dev/mockSupporters.js';
import { makeMockReviewsDevOnly } from '../dev/mockReviews.js';

// Same easing the rest of the app's motion uses (page-load stagger, Saved's
// scroll-pop, OnboardingTour, PostAuthWelcome) — kept identical here so the
// landing page's scroll-reveal reads as the same motion language, not a
// different one bolted on.
const EASE = [0.16, 1, 0.3, 1];

const SOCIAL_ICONS = { instagram: IcInstagram, tiktok: IcTikTok };

// Fades + rises one landing element in as it crosses into view — each
// heading, paragraph, row and tier gets its own, so they arrive one by one
// while scrolling. Replays only once: unlike Saved's cards this isn't a
// scrolling feed, so a repeat-on-every-pass would read as fidgety rather
// than lively.
// Coming back to this page (Back / browser back) shows each section in place
// right away instead of replaying its fade-in — see useReturning.
function Reveal({ children = null, delay = 0, className }) {
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.3, once: true });
  const returning = useReturning();
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={returning ? false : { opacity: 0, y: 30, filter: 'blur(10px)' }}
      animate={returning || inView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 30, filter: 'blur(10px)' }}
      transition={{ duration: 0.9, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

// A paragraph that lights up word by word as it scrolls up the screen:
// each word sits dim until it passes into the upper half, so the reading
// follows the scroll. Thai has no spaces, so words come from
// Intl.Segmenter (falling back to the spaces there are). All lit with
// reduced motion, or when coming back to the page.
function ScrollLit({ text, className }) {
  const ref = useRef(null);
  const returning = useReturning();
  const words = useMemo(() => {
    try {
      const seg = new Intl.Segmenter(undefined, { granularity: 'word' });
      return [...seg.segment(text)].map((w) => w.segment);
    } catch {
      return text.split(/(\s+)/);
    }
  }, [text]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const spans = [...el.children];
    if (returning || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      spans.forEach((s) => (s.style.opacity = 1));
      return undefined;
    }
    // Word positions on the page, measured only when the layout changes
    // (not every frame), and each word written only when its light moves.
    let mids = [];
    const shown = [];
    const measure = () => {
      mids = spans.map((s) => {
        const r = s.getBoundingClientRect();
        return r.top + window.scrollY + r.height / 2;
      });
    };
    let frame = 0;
    const update = () => {
      frame = 0;
      const vh = window.innerHeight;
      const y = window.scrollY;
      spans.forEach((s, i) => {
        const lit = Math.min(Math.max((vh * 0.82 - (mids[i] - y)) / (vh * 0.3), 0), 1);
        const o = (0.16 + 0.84 * lit).toFixed(2);
        if (shown[i] !== o) {
          shown[i] = o;
          s.style.opacity = o;
        }
      });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const relayout = () => {
      measure();
      update();
    };
    relayout();
    const ro = new ResizeObserver(relayout);
    ro.observe(document.querySelector('.app-shell') || document.body);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, [words, returning]);
  return (
    <p className={className} ref={ref} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} aria-hidden="true">
          {w}
        </span>
      ))}
    </p>
  );
}

// Children of the returned ref's element float up out of the water one
// after another as they scroll into view, tied to the scroll (scrolling back
// sinks them again) rather than played once: each starts lower, faded and
// blurred, and settles as it climbs the bottom third of the screen. Items
// on the right of a row trail the left a little, so a grid rises in reading
// order. Settled straight away with reduced motion or when coming back.
function useRiseWithScroll() {
  const ref = useRef(null);
  const returning = useReturning();
  useEffect(() => {
    const el = ref.current;
    if (!el || returning || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const items = [...el.children];
    // Where each item sits on the page, measured with no transform on it
    // and only when the layout changes: reading positions every frame while
    // also moving the items made the browser lay the page out again and
    // again during the scroll.
    let spots = [];
    const measure = () => {
      items.forEach((it) => (it.style.transform = 'none'));
      const left = el.getBoundingClientRect().left;
      spots = items.map((it) => {
        const r = it.getBoundingClientRect();
        return { top: r.top + window.scrollY, lag: r.left - left > 40 };
      });
    };
    let frame = 0;
    const update = () => {
      frame = 0;
      const vh = window.innerHeight;
      const y = window.scrollY;
      items.forEach((it, i) => {
        const { top, lag } = spots[i];
        const k = Math.min(Math.max((vh * 0.98 - (lag ? vh * 0.06 : 0) - (top - y)) / (vh * 0.32), 0), 1);
        const e = 1 - (1 - k) ** 3;
        it.style.opacity = e.toFixed(3);
        it.style.transform = `translate3d(0, ${((1 - e) * 70).toFixed(1)}px, 0) scale(${(0.94 + 0.06 * e).toFixed(3)})`;
      });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const relayout = () => {
      measure();
      update();
    };
    relayout();
    const ro = new ResizeObserver(relayout);
    ro.observe(document.querySelector('.app-shell') || document.body);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, [returning]);
  return ref;
}

// Smooth scrolling on a computer, like the reference sites: wheel and
// trackpad input glide the page to where it's going instead of stepping
// notch by notch, so everything tied to the scroll (the water, the rising
// lines, the gauge) moves in one continuous motion. Phones keep their own
// native touch scrolling, which already glides. Not with reduced motion,
// and held off while the opening plays. ScrollCue reaches it through
// `smoothScroller`.
let smoothScroller = null;
function useSmoothScroll(enabled) {
  useEffect(() => {
    if (!enabled) return undefined;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const lenis = new Lenis({ duration: 1.15, easing: (t) => 1 - 2 ** (-10 * t), smoothWheel: true });
    smoothScroller = lenis;
    let frame = requestAnimationFrame(function raf(time) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    });
    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
      smoothScroller = null;
    };
  }, [enabled]);
}

// Each section heading catches a sweep of light once, as it comes up into
// view: a pink-white glint passes across the words (.h2.is-lit). The same
// moment draws the underline under a heading's marked word (.mark-word).
function useHeadingSweep() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add('is-lit');
          io.unobserve(e.target);
        }),
      { rootMargin: '0px 0px -30% 0px' },
    );
    document.querySelectorAll('.landing-more .h2').forEach((h) => io.observe(h));
    return () => io.disconnect();
  }, []);
}

// "DeePer" in a heading set in the wordmark's white-to-red gradient, the
// same as the hero's.
// The words around the name are kept whole (they only wrap at their
// spaces), so a narrow screen breaks "ใครอยู่เบื้องหลัง | DeePer" rather
// than mid-word.
function withLogo(text) {
  const parts = text.split('DeePer');
  if (parts.length === 1) return text;
  const keep = (part, i) => <Fragment key={`t${i}`}>{unbreakablePhrases(part)}</Fragment>;
  return parts.flatMap((part, i) =>
    i === 0
      ? [keep(part, i)]
      : [
          <span className="brand-inline" key={i}>
            DeePer
          </span>,
          keep(part, i),
        ],
  );
}

// The landing user count: "···" until the stat loads, then counts up from 0
// on a gentle ease-out the first time it scrolls into view, and pops when it
// lands — same timing as the iOS app's CountUpNumber (WelcomeView.swift).
function CountUpNumber({ target, className = 'stat-number' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  // Coming back to the page shows the final number instead of recounting.
  const prefersReduced = useReducedMotion();
  const returning = useReturning();
  const reduceMotion = prefersReduced || returning;
  const [value, setValue] = useState(0);
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    if (!inView || target == null) return;
    if (reduceMotion) {
      setValue(target);
      return;
    }
    // A steeper curve burns through most of the count while the section
    // is still fading in, so keep the ease-out gentle.
    const controls = animate(0, target, {
      duration: 0.8,
      delay: 0.1,
      ease: [0.3, 0.1, 0.3, 1],
      onUpdate: (v) => setValue(Math.round(v)),
      onComplete: () => setLanded(true),
    });
    return () => controls.stop();
  }, [inView, target, reduceMotion]);

  return (
    <motion.div
      ref={ref}
      className={className}
      // Landing pop: swell out, then spring back to size.
      animate={landed ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={{ duration: 0.66, times: [0, 0.25, 1], ease: ['easeOut', [0.34, 1.56, 0.64, 1]] }}
    >
      {target == null ? '···' : `${value.toLocaleString('en-US')}+`}
    </motion.div>
  );
}

// Small twinkle accent next to the stat number — separate from (and
// independent of) OnboardingTour's own tip-corner sparkles. Uses the shared
// <Sparkles/> component (see components/Sparkles.jsx); History's page-title
// accent reuses the same component with its own point set.
const STAT_SPARKLES = [
  { top: -8, right: -14, delay: 0, size: 16 },
  { bottom: -4, left: -16, delay: 1.1, size: 11 },
];
// Same twinkle on the "follow us" heading, offset in time from the stat's.
const SOCIAL_SPARKLES = [
  { top: -10, right: -18, delay: 0.4, size: 14 },
  { bottom: -2, left: -18, delay: 1.6, size: 10 },
];

// The app's standout features, shown below the About blurb — icon +
// i18n key pair per row, kept as data so the section is one small map()
// rather than six near-identical JSX blocks. Six, so the two columns on a
// computer come out even.
const FEATURES = [
  { Icon: IcCards, key: 'deck' },
  { Icon: IcUser, key: 'partner' },
  { Icon: IcPlus, key: 'own' },
  { Icon: IcShare, key: 'share' },
  { Icon: IcHistory, key: 'memory' },
  { Icon: IcFileText, key: 'history' },
];

// Dev-only preview of the marquee at any item count — never on by default,
// even locally: needs both a dev build AND `?mockSupporters=<count>` in the
// URL (e.g. ?mockSupporters=10). Production builds fold this whole check to
// `0` at compile time, which is also what lets the mock-data import above
// get stripped.
function useMockSupporterCountForPreview() {
  if (!import.meta.env.DEV) return 0;
  const n = Number(new URLSearchParams(window.location.search).get('mockSupporters'));
  return Number.isInteger(n) && n > 0 ? Math.min(n, 50) : 0;
}

const initials = (name) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

// JS-driven marquee: each row moves at a velocity that always eases back
// to the cruising speed. Drag it (finger or mouse) and it follows your hand;
// let go mid-swipe and it keeps your release speed, then slows down
// smoothly until it's back at cruising speed — it never stops dead. A
// sideways trackpad/wheel swipe nudges it the same way. Holding a finger on
// it (or the mouse button down) holds it still.
//
// Loop is seamless: each row's track renders its item list twice back-to-
// back, and whenever the position passes one set's width (half the
// scrollWidth) it jumps back by exactly that width — the frame on either
// side of the jump is pixel-identical. The same wrap applies while
// dragging, so it never hits an end.
//
// Speed is in px/second, so every row moves at the same physical speed
// regardless of item count or name length.
const MARQUEE_PX_PER_SECOND = 40;
// How fast a fling eases back to cruising speed (1/s): higher = shorter
// glide. At 1.6 a hard swipe takes ~2.5s to settle.
const MARQUEE_EASE_RATE = 1.6;
const MARQUEE_MAX_PX_PER_SECOND = 4000;
const MARQUEE_FLING_STALE_MS = 80; // held still this long before release = no fling
const MARQUEE_ROWS = 3;

// Round-robin (not chunked) so consecutive items land on different rows —
// with the 10-item mock set that spreads 01..10 across all 3 rows instead
// of stacking 01-03 in row 1, which reads as more "alive" once the rows
// start scrolling opposite directions.
function splitIntoRows(items, rowCount) {
  const rows = Array.from({ length: rowCount }, () => []);
  items.forEach((item, i) => rows[i % rowCount].push(item));
  return rows.filter((row) => row.length > 0);
}

// A row whose one set is narrower than the container would show a blank gap
// before the loop point — so short rows repeat their items into a longer
// set first (still seamless: the track is that set twice, animated -50%).
const MARQUEE_MIN_SET_ITEMS = 6;

// Name only — no photo or initials circle.
const renderSupporterChip = (s, i, hidden) => (
  <span className="supporter-chip glass" key={`${s.name}-${i}`} aria-hidden={hidden}>
    <span className="supporter-name">{s.name}</span>
  </span>
);

function SupportersRow({ items, reverse, renderItem = renderSupporterChip }) {
  let set = items;
  while (set.length < MARQUEE_MIN_SET_ITEMS) set = [...set, ...items];
  const track = [...set, ...set];
  const scrollerRef = useRef(null);
  // Position and velocity live in refs so they survive the effect
  // re-running; position null = not placed yet.
  const posRef = useRef(null);
  const velRef = useRef(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Cruising velocity this row eases back to (px/s along scrollLeft).
    const cruise = reduceMotion ? 0 : (reverse ? -1 : 1) * MARQUEE_PX_PER_SECOND;
    // Float position kept here, not read back from scrollLeft, since some
    // browsers round scrollLeft to whole pixels and 40px/s at 60fps is
    // well under one pixel per frame.
    let pos = posRef.current ?? 0;
    let vel = velRef.current ?? cruise;
    let lastTime = 0;
    let frame = 0;
    let drag = null;
    let lastWheel = 0;

    // Width of one set, measured when the row's content resizes rather than
    // read every frame (that forced a page layout per frame mid-scroll).
    let setWidth = el.scrollWidth / 2;
    const oneSet = () => setWidth;
    const ro = new ResizeObserver(() => (setWidth = el.scrollWidth / 2));
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    const wrap = (x) => {
      const half = oneSet();
      if (half <= 0) return x;
      return ((x % half) + half) % half;
    };
    const clamp = (v) => Math.max(-MARQUEE_MAX_PX_PER_SECOND, Math.min(MARQUEE_MAX_PX_PER_SECOND, v));
    // First mount only: start reversed rows mid-set so they have room to
    // move left too. Later runs keep wherever the row already was.
    if (posRef.current === null) pos = reverse ? oneSet() / 2 : 0;
    el.scrollLeft = pos;

    const tick = (now) => {
      const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.1) : 0;
      lastTime = now;
      if (!drag) {
        // Exponential ease toward cruising speed — frame-rate independent.
        vel = cruise + (vel - cruise) * Math.exp(-MARQUEE_EASE_RATE * dt);
        pos = wrap(pos + vel * dt);
        el.scrollLeft = pos;
      }
      posRef.current = pos;
      velRef.current = vel;
      frame = visible ? requestAnimationFrame(tick) : 0;
    };
    // Only run while the row is on screen: off screen it would keep moving
    // scrollLeft (and the page's other rows) every frame for nothing,
    // costing frames while the visitor scrolls elsewhere.
    let visible = true;
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !frame) {
        lastTime = 0;
        frame = requestAnimationFrame(tick);
      }
    });
    io.observe(el);
    frame = requestAnimationFrame(tick);

    // Finger or mouse drag. touch-action: pan-y (styles.css) leaves vertical
    // swipes to the page and hands horizontal ones to us.
    const onPointerDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      drag = { id: e.pointerId, x: e.clientX, start: pos, lastX: e.clientX, lastT: e.timeStamp, v: 0 };
      vel = 0;
      el.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      pos = wrap(drag.start - (e.clientX - drag.x));
      el.scrollLeft = pos;
      // Smoothed so one jittery event doesn't set the whole fling.
      const dtMs = e.timeStamp - drag.lastT;
      if (dtMs > 0) {
        const v = ((drag.lastX - e.clientX) / dtMs) * 1000;
        drag.v = drag.v * 0.3 + v * 0.7;
        drag.lastX = e.clientX;
        drag.lastT = e.timeStamp;
      }
    };
    const onPointerUp = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const stale = e.timeStamp - drag.lastT > MARQUEE_FLING_STALE_MS;
      // From here the tick eases this back to cruising speed.
      vel = stale ? 0 : clamp(drag.v);
      drag = null;
    };

    // Sideways trackpad / shift+wheel: move with it, and carry its speed
    // into the glide once the gesture ends.
    const onWheel = (e) => {
      const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
      if (!dx) return;
      e.preventDefault();
      const dtMs = Math.max(e.timeStamp - lastWheel, 8);
      lastWheel = e.timeStamp;
      pos = wrap(pos + dx);
      el.scrollLeft = pos;
      vel = clamp(vel * 0.5 + ((dx / dtMs) * 1000) * 0.5);
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
      ro.disconnect();
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('wheel', onWheel);
    };
  }, [items, reverse]);

  return (
    <div className="supporters-marquee" ref={scrollerRef}>
      <div className="supporters-track">
        {track.map((s, i) => renderItem(s, i, i >= items.length))}
      </div>
    </div>
  );
}

// Rows alternate direction. No hover pause: the rows ease back to cruising
// speed after a fling instead of stopping under the cursor.
function SupportersMarquee({ items, renderItem, rowCount = MARQUEE_ROWS }) {
  // Memoized so a re-render hands each row the same array — a new one would
  // restart the row's scroll effect and make it jump.
  const rows = useMemo(() => splitIntoRows(items, rowCount), [items, rowCount]);

  return (
    <div className="supporters-marquee-group">
      {rows.map((row, i) => (
        <SupportersRow key={i} items={row} reverse={i % 2 === 1} renderItem={renderItem} />
      ))}
    </div>
  );
}

// Organization logos — no tile/background: the logo files themselves are
// transparent and pre-recolored for the dark page (see sponsors-info.js).
// Admin-added sponsors may carry a link; those logos open it.
const renderSponsorLogo = (s, i) =>
  s.link ? (
    <a className="sponsor-logo" key={`${s.name}-${i}`} href={s.link} target="_blank" rel="noopener noreferrer">
      <img src={s.logo} alt={s.name} />
    </a>
  ) : (
    <span className="sponsor-logo" key={`${s.name}-${i}`}>
      <img src={s.logo} alt={s.name} />
    </span>
  );

// Sponsors grouped by tier, largest logos first. Each tier uses a static
// centered wall so every logo stays visible.
function LaunchCountdown({ t, launch }) {
  if (launch.launched) return <LaunchOpened t={t} />;
  return (
    <>
      <div className="landing-section" data-depth={t('welcome.launch.eyebrow')}>
        <Reveal>
          <h2 className="h2 launch-title">
            <span className="brand-inline">DeePer</span>{' '}
            <span className="mark-word">{t('welcome.launch.titleMark')}</span>{' '}
            <span className="nowrap">{t('welcome.launch.titleRest')}</span>
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <Countdown remaining={launch.remaining} t={t} />
        </Reveal>
        <Reveal delay={0.2}>
          <p className="stat-label">{t('welcome.launch.when')}</p>
        </Reveal>
      </div>
    </>
  );
}

// Takes the countdown's place once launch time passes: springs up from
// below with a little overshoot when scrolled into view (or right away if
// the visitor is already looking at it when the clock hits zero).
function LaunchOpened({ t }) {
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.4, once: true });
  // Fireworks keep going the whole time this is on screen, and start again
  // whenever the visitor scrolls back to it.
  const onScreen = useInView(ref, { amount: 0.2 });
  const reduceMotion = useReducedMotion();
  return (
    <>
      <div className="landing-section launch-opened" ref={ref} data-depth={t('welcome.launch.openEyebrow')}>
        <Fireworks play={onScreen} />
        <motion.div
          style={{ position: 'relative' }}
          initial={reduceMotion ? false : { opacity: 0, y: 70, scale: 0.85 }}
          animate={inView ? { opacity: 1, y: 0, scale: 1 } : undefined}
          transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.15 }}
        >
          <h2 className="h2 launch-opened-title">
            <span className="sparkle-anchor">
              {t('welcome.launch.openTitle')}
              <Sparkles points={STAT_SPARKLES} />
            </span>
          </h2>
          <p className="stat-label">{t('welcome.launch.openSub')}</p>
        </motion.div>
      </div>
    </>
  );
}

// Dev-only preview of the stats at a future size — never on by default:
// needs a dev build AND `?mockStats=<user count>` in the URL, e.g.
// ?mockStats=10000 or ?mockStats=100000. The activity totals are scaled
// from the user count with rough per-person ratios, just to see how big
// numbers sit in the layout. Production builds fold this to null.
function useMockStatsForPreview() {
  if (!import.meta.env.DEV) return null;
  const n = Number(new URLSearchParams(window.location.search).get('mockStats'));
  if (!Number.isInteger(n) || n <= 0) return null;
  return {
    user_count: n,
    swipe_count: n * 38,
    answer_count: n * 9,
    save_count: n * 6,
    share_count: Math.round(n * 1.4),
  };
}

// Smaller totals under the user count: every card swiped, answered, saved
// and shared.
// Below these the landing page leaves the stats out (see the stats section).
const STATS_MIN_USERS = 50;
const STATS_MIN_ACTIVITY = 10;
const ACTIVITY_STATS = [
  { key: 'swipes', field: 'swipe_count' },
  { key: 'answers', field: 'answer_count' },
  { key: 'saves', field: 'save_count' },
  { key: 'shares', field: 'share_count' },
];

// Until launch, sponsor logos and individual supporters are `sealed`:
// blurred out behind a strip of red "caution tape", and not clickable.
// Flips open on its own when the clock passes LAUNCH_AT.
// The tape's text: drifts slowly on its own, and can be dragged sideways by
// hand (mouse or finger); let go and it glides on, easing back to its drift.
// Holds the text twice and wraps by half its width, so it loops seamlessly.
function TapeTrack({ text, dir }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    // The whole strip (stripes included) is the drag handle, not just the text.
    const handle = el.parentElement;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const drift = still ? 0 : 10 * dir; // px per second
    let x = 0;
    let v = drift;
    let dragging = false;
    let lastX = 0;
    let lastT = 0;
    let frame = 0;
    let prev = performance.now();
    // Measured on resize, not per frame: reading it right after moving the
    // text made the browser lay the page out again every frame.
    let h = 1;
    const ro = new ResizeObserver(() => (h = el.scrollWidth / 2 || 1));
    ro.observe(el);
    const place = () => {
      x = ((x % h) + h) % h - h; // keep within [-half, 0)
      el.style.transform = `translateX(${x}px)`;
    };
    const tick = (now) => {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      if (!dragging) {
        v += (drift - v) * Math.min(1, dt * 1.5); // ease back to the drift
        x += v * dt;
        place();
      }
      frame = visible ? requestAnimationFrame(tick) : 0;
    };
    // Drift only while the tape is on screen (same reason as the marquee).
    let visible = true;
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !frame) {
        prev = performance.now();
        frame = requestAnimationFrame(tick);
      }
    });
    io.observe(handle);
    const down = (e) => {
      dragging = true;
      lastX = e.clientX;
      lastT = performance.now();
      v = 0;
      handle.setPointerCapture?.(e.pointerId);
    };
    const move = (e) => {
      if (!dragging) return;
      const now = performance.now();
      const dx = e.clientX - lastX;
      x += dx;
      v = dx / Math.max(0.016, (now - lastT) / 1000);
      lastX = e.clientX;
      lastT = now;
      place();
    };
    const up = () => {
      dragging = false;
    };
    handle.addEventListener('pointerdown', down);
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
      ro.disconnect();
      handle.removeEventListener('pointerdown', down);
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
    };
  }, [dir]);
  return (
    <div className="sponsor-tape-track" ref={ref}>
      <span>{text}</span>
      <span aria-hidden="true">{text}</span>
    </div>
  );
}

// A small burst of stars shooting out from the middle of a sponsor tier,
// once, as its logos are revealed. Each `burst` change fires a new one.
const BURST_COLORS = ['#ff5a72', '#ffd2d9', '#fbbf24', '#ffffff'];
function StarBurst({ burst }) {
  const stars = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const r = 70 + Math.random() * 60;
        return {
          x: Math.cos(a) * r * 1.6,
          y: Math.sin(a) * r * 0.55,
          size: 9 + Math.random() * 7,
          color: BURST_COLORS[i % BURST_COLORS.length],
          delay: Math.random() * 0.12,
        };
      }),
    // A fresh scatter for every burst.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [burst],
  );
  if (!burst) return null;
  return (
    <div className="star-burst" aria-hidden="true" key={burst}>
      {stars.map((st, i) => (
        <motion.span
          key={i}
          style={{ color: st.color }}
          initial={{ x: 0, y: 0, scale: 0.2, opacity: 0, rotate: 0 }}
          animate={{ x: st.x, y: st.y, scale: [0.2, 1, 0.6], opacity: [0, 1, 0], rotate: 120 }}
          transition={{ duration: 1.1, delay: st.delay, ease: [0.16, 1, 0.3, 1] }}
        >
          <IcSparkle size={st.size} />
        </motion.span>
      ))}
    </div>
  );
}

function Sealed({ t, sealed, index = 0, children }) {
  // sealed → (launch passes while the page is open) → opening → open.
  // While opening, the tape peels off and the logos come into focus; the
  // wrapper stays the same element throughout so nothing inside remounts.
  const [phase, setPhase] = useState(sealed ? 'sealed' : 'open');
  // Stars shoot out as the logos come into focus — at the reveal, or (when
  // the page opens after launch) the first time the tier scrolls into view.
  const [burst, setBurst] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (!sealed && phase === 'sealed') setPhase('opening');
  }, [sealed, phase]);
  // Timers live in their own effect keyed on the opening phase: in the one
  // above they'd be cleared again by the very re-render setPhase causes.
  useEffect(() => {
    if (phase !== 'opening') return undefined;
    const id = setTimeout(() => setPhase('open'), 2200 + index * 280);
    const starsId = setTimeout(() => setBurst((b) => b + 1), 1100 + index * 280);
    return () => {
      clearTimeout(id);
      clearTimeout(starsId);
    };
  }, [phase, index]);
  useEffect(() => {
    if (inView && !sealed && phase === 'open' && burst === 0) setBurst(1);
  }, [inView]); // eslint-disable-line react-hooks/exhaustive-deps
  const half = Array.from({ length: 12 }, () => `${t('welcome.supporters.sealed')}   ✦   `).join('');
  const open = phase === 'open';
  return (
    // Tapes peel off in alternating directions: left→right, then right→left.
    <div
      ref={ref}
      className={`sealed${index % 2 ? ' peel-rev' : ''}${phase === 'opening' ? ' is-opening' : ''}${open ? ' is-open' : ''}`}
      style={{ '--i': index }}
    >
      {!reduceMotion && <StarBurst burst={burst} />}
      <div className="sealed-content" aria-hidden={open ? undefined : 'true'} inert={open ? undefined : ''}>
        {children}
      </div>
      {!open && (
        <div className="sponsor-tape">
          <TapeTrack text={half} dir={index % 2 ? 1 : -1} />
        </div>
      )}
    </div>
  );
}

function SponsorTiers({ t, sponsors, sealed }) {
  const byTier = SPONSOR_TIERS.map((tier) => [tier, sponsors.filter((s) => s.tier === tier)]).filter(([, items]) => items.length);
  return (
    <div className="sponsor-tiers">
      {byTier.map(([tier, items], i) => {
        return (
          // Each tier reveals on its own as it scrolls into view.
          <Reveal className={`sponsor-tier sponsor-tier-${tier}`} key={tier}>
            {/* Gold / silver / bronze: metallic gradient label between two
                gem glyphs (see .sponsor-tier-label--<tier> in styles.css). */}
            <p className={`sponsor-tier-label sponsor-tier-label--${tier}`}>
              <span className="tier-gem" aria-hidden="true">✦</span>
              {t(`welcome.supporters.tier.${tier}`)}
              <span className="tier-gem" aria-hidden="true">✦</span>
            </p>
            {/* Before launch only the logos are veiled; the tier label
                above stays readable. */}
            <Sealed t={t} sealed={sealed} index={i}>
              <div className="sponsor-wall">{items.map(renderSponsorLogo)}</div>
            </Sealed>
          </Reveal>
        );
      })}
    </div>
  );
}

// The hero's sample question cards: a small deck of two that loops. The
// front card shows a question; the next one waits behind it, tilted the
// other way and peeking out. Every SAMPLE_MS (or on a tap) the front card
// slides out to the left and tucks back in behind the stack, picking up the
// question after next, while the waiting card comes forward, like flipping
// through a deck by moving the top card to the bottom.
//
// The whole deck runs off one number, `pos`: how many cards have been
// flipped so far (fractional while one is moving). Each tap or auto-advance
// raises the target by one and a frame loop moves `pos` toward it, writing
// both cards' transforms straight to the DOM. One continuous clock means no
// restarts or handoffs between flips: tapping again mid-swing just speeds the
// deck up, and it eases back down as it catches up.
const SAMPLE_KEYS = ['welcome.sample', 'welcome.sample2', 'welcome.sample3', 'welcome.sample4', 'welcome.sample5', 'welcome.sample6'];
const SAMPLE_MS = 4500;
const CYCLE_S = 1.15;
// The leaving card reaches its furthest point (and is clear of the other
// card) a bit before halfway: out quick, back in slower, like a hand
// pulling the top card off and tucking it under. That's also when the
// stacking order flips.
const PEAK_AT = 0.42;
const SAMPLE_FRONT = { x: 0, y: 0, rotate: -4, scale: 1 };
const SAMPLE_BACK = { x: 22, y: 12, rotate: 7, scale: 0.94 };
// How far the leaving card swings out on its way round; it also shrinks so
// by the time it drops behind it's clear of the card coming forward and it
// reads as moving away.
const SAMPLE_SWING = { x: -250, y: -34, rotate: -16, scale: -0.24 };
const ease = (s) => 0.5 - Math.cos(Math.PI * s) / 2;
const lerp = (a, b, s) => a + (b - a) * s;
const warp = Math.log(0.5) / Math.log(PEAK_AT);
const comeForward = cubicBezier(0.4, 0, 0.25, 1.2);
const pose = (p) => `translate(${p.x}px, ${p.y}px) rotate(${p.rotate}deg) scale(${p.scale})`;
// Where each card sits at phase s (0..1) of a flip.
const leavingPose = (s) => {
  const e = ease(s ** warp);
  const p = {};
  for (const k in SAMPLE_FRONT) p[k] = lerp(SAMPLE_FRONT[k], SAMPLE_BACK[k], e) + SAMPLE_SWING[k] * Math.sin(Math.PI * e);
  return p;
};
// The waiting card holds still until the top card is clear and has dropped
// behind (so the two never overlap as the order flips, and it reads as
// revealed, not pushed), then eases forward (no jolt from standing still) with a slight overshoot.
const arrivingPose = (s) => {
  if (s <= PEAK_AT) return SAMPLE_BACK;
  const e = comeForward((s - PEAK_AT) / (1 - PEAK_AT));
  const p = {};
  for (const k in SAMPLE_FRONT) p[k] = lerp(SAMPLE_BACK[k], SAMPLE_FRONT[k], e);
  return p;
};
// An auto flip takes CYCLE_S; a tapped one TAP_CYCLE_S, so even the first
// tap answers the finger briskly. The further the deck is behind the taps,
// the faster it runs (up to MAX_SPEED× an auto flip), so the pace follows the finger:
// slow taps get a full swing, quick taps a snappy one. Changes in pace are
// smoothed over PACE_S so it never lurches.
const BASE_SPEED = 1 / CYCLE_S;
const TAP_CYCLE_S = 0.8;
const MAX_SPEED = 3;
const SPEED_PER_CARD = 1.2;
const PACE_S = 0.12;
const MAX_BEHIND = 3;
function SampleCard({ t }) {
  const n = SAMPLE_KEYS.length;
  const reduceMotion = useReducedMotion();
  const cards = [useRef(null), useRef(null)];
  const pos = useRef(0);
  const target = useRef(0);
  const velocity = useRef(0);
  const baseSpeed = useRef(BASE_SPEED);
  const raf = useRef(0);
  // Re-render only when a flip starts or finishes (to swap the front card's
  // highlight and the questions), never per frame.
  const [step, setStep] = useState({ done: 0, front: 0 });
  const paint = () => {
    const p = pos.current;
    const k = Math.floor(p);
    const s = p - k;
    const leaving = k % 2;
    const [a, b] = [cards[leaving].current, cards[1 - leaving].current];
    if (!a || !b) return;
    a.style.transform = pose(leavingPose(s));
    b.style.transform = pose(arrivingPose(s));
    a.style.zIndex = s < PEAK_AT ? 2 : 0;
    b.style.zIndex = s < PEAK_AT ? 0 : 2;
    const done = k;
    const front = s > 0 ? 1 - leaving : leaving;
    setStep((old) => (old.done === done && old.front === front ? old : { done, front }));
  };
  const tick = (now, last) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    const behind = target.current - pos.current;
    const want = Math.min(BASE_SPEED * MAX_SPEED, baseSpeed.current * Math.max(1, 1 + SPEED_PER_CARD * (behind - 1)));
    velocity.current += (want - velocity.current) * (1 - Math.exp(-dt / PACE_S));
    pos.current = Math.min(target.current, pos.current + velocity.current * dt);
    paint();
    if (pos.current < target.current) raf.current = requestAnimationFrame((next) => tick(next, now));
    else {
      velocity.current = 0;
      raf.current = 0;
    }
  };
  const advance = (speed = BASE_SPEED) => {
    target.current = Math.min(target.current + 1, Math.floor(pos.current) + MAX_BEHIND);
    if (reduceMotion) {
      // Reduced motion: the cards just trade places, no swing round.
      pos.current = target.current;
      paint();
      return;
    }
    // A tap during an auto flip lifts it to tap pace too.
    baseSpeed.current = raf.current ? Math.max(baseSpeed.current, speed) : speed;
    if (!raf.current) {
      velocity.current = speed;
      raf.current = requestAnimationFrame((now) => tick(now, now));
    }
  };
  useEffect(() => {
    paint();
    return () => cancelAnimationFrame(raf.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Auto-advance only while the cards are on screen and at rest.
  const stackRef = useRef(null);
  const inView = useInView(stackRef);
  useEffect(() => {
    if (!inView) return undefined;
    const id = setTimeout(() => {
      if (!raf.current) advance();
    }, SAMPLE_MS);
    return () => clearTimeout(id);
  }, [step, inView]); // eslint-disable-line react-hooks/exhaustive-deps
  // Card c holds every other question: the one it shows now, or (once it
  // has gone round behind) the one after next. The switch happens the moment
  // a flip completes, while the card is fully covered, so nothing blinks.
  const question = (c) => {
    const q = step.done % 2 === c ? step.done : step.done + 1;
    return SAMPLE_KEYS[q % n];
  };
  return (
    <button ref={stackRef} type="button" className="sample-stack" onClick={() => advance(1 / TAP_CYCLE_S)} aria-label={t('welcome.sampleNext')}>
      {[0, 1].map((c) => {
        const isFront = c === step.front;
        return (
          <div key={c} ref={cards[c]} className={`glass sample-card${isFront ? ' is-front' : ''}`}>
            <p aria-hidden={isFront ? undefined : 'true'}>{t(question(c))}</p>
          </div>
        );
      })}
    </button>
  );
}

// Small bobbing chevron under the sign-up buttons: the hero fills the whole
// screen, so without it nothing hints that the countdown, about and sponsors
// sit below. Tapping it scrolls there. As the page scrolls it shrinks and
// fades out gradually, following the finger (gone by FADE_PX), instead of
// switching off at one point.
const SCROLL_CUE_FADE_PX = 140;
function ScrollCue({ label }) {
  const ref = useRef(null);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const p = Math.min(window.scrollY / SCROLL_CUE_FADE_PX, 1);
      ref.current?.style.setProperty('--cue-p', p);
      setGone(p >= 1);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  // The wrapper takes the hero's stagger entrance (.stagger > *), which
  // animates opacity/transform; the button inside is free to fade with scroll.
  return (
    <div className="scroll-cue-wrap">
      <button
        ref={ref}
        type="button"
        className={`scroll-cue${gone ? ' is-gone' : ''}`}
        aria-label={label}
        tabIndex={gone ? -1 : undefined}
        onClick={() => {
          const target = document.querySelector('.dive, .landing-more');
          if (smoothScroller) smoothScroller.scrollTo(target);
          else target?.scrollIntoView({ behavior: 'smooth' });
        }}
      >
        <ChevronDown size={22} strokeWidth={2} />
      </button>
    </div>
  );
}


// Plain text, no box/border — matches the rest of the page's text-based
// feel rather than reading as another boxed component. Just a small avatar
// added to the left of each name+role line.
function DevTeamCard({ dev, lang, nav }) {
  const [imgFailed, setImgFailed] = useState(false);
  const name = (lang === 'en' ? dev.nameEn : dev.nameTh) || dev.nameTh;
  const role = (lang === 'en' ? dev.roleEn : dev.roleTh) || dev.roleTh;
  const showPhoto = dev.avatar && !imgFailed;

  const avatar = showPhoto ? (
    <img
      className="dev-team-avatar-img"
      src={dev.avatar}
      alt=""
      style={{ objectPosition: dev.avatarPosition || 'center' }}
      onError={() => setImgFailed(true)}
      draggable={false}
    />
  ) : (
    <span className="supporter-avatar dev-team-avatar-fallback">{initials(name)}</span>
  );

  return (
    <div className="dev-team-entry">
      {dev.awardsHref ? (
        // The whole row (avatar, name and role) is one button, so a tap
        // anywhere on it opens the profile instead of only on the name text.
        <button
          type="button"
          className="dev-team-row dev-team-row-clickable"
          onClick={() => nav(dev.awardsHref)}
        >
          {avatar}
          <span className="dev-team-text">
            <span className="dev-team-name">
              {name}
              <IcMousePointer size={17} className="dev-team-name-icon" />
            </span>
            <span className="dev-team-role">{unbreakablePhrases(role)}</span>
          </span>
        </button>
      ) : (
        <div className="dev-team-row">
          {avatar}
          <div className="dev-team-text">
            <p className="dev-team-name">{name}</p>
            <p className="dev-team-role">{unbreakablePhrases(role)}</p>
          </div>
        </div>
      )}
      {dev.link && (
        <a className="link dev-team-link" href={dev.link} target="_blank" rel="noreferrer">
          {dev.link.replace(/^https?:\/\//, '')}
        </a>
      )}
    </div>
  );
}

// Approved user reviews, between the stats and "follow us": numbers first,
// then what people say about it. Renders nothing until at least one review
// has been approved in the admin dashboard.
// Landing-page data kept for the rest of the visit. Coming back from another
// page (Back from report / contact / awards) then renders at full height
// straight away, so the old scroll spot can be restored in one go instead of
// jumping again as each list loads in. Still refreshed in the background.
const landingCache = {};
function useLandingData(key, path, pick, initial) {
  const [value, setValue] = useState(key in landingCache ? landingCache[key] : initial);
  useEffect(() => {
    let cancelled = false;
    api
      .get(path, { auth: false })
      .then((d) => {
        landingCache[key] = pick(d);
        if (!cancelled) setValue(landingCache[key]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, path]);
  return value;
}

// Dev-only preview of the reviews section: needs a dev build AND
// `?mockReviews=<count>` (e.g. ?mockReviews=5). Production folds this to 0.
function useMockReviewCountForPreview() {
  if (!import.meta.env.DEV) return 0;
  const n = Number(new URLSearchParams(window.location.search).get('mockReviews'));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 20) : 0;
}

function ReviewsSection({ t, lang }) {
  // Wrapped so a streak of light can sweep across the round photo on hover.
  const fetched = useLandingData('reviews', '/reviews', (d) => d.reviews, []);
    <span className="dev-team-avatar">
  const mockCount = useMockReviewCountForPreview();
  // The literal import.meta.env.DEV lets production builds drop the mock entirely.
  const reviews = import.meta.env.DEV && mockCount > 0 ? makeMockReviewsDevOnly(mockCount, lang) : fetched;
  if (reviews.length === 0) return null;
  return (
    <>
      <div className="landing-section" data-depth={t('welcome.reviews.eyebrow')}>
        <Reveal>
    </span>
          <h2 className="h2">{t('welcome.reviews.title')}</h2>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="review-row">
            {reviews.map((r) => (
              <figure className="review-card glass" key={r.id}>
                <blockquote>“{r.text}”</blockquote>
                <figcaption>
                  <b>{r.nickname || r.nickname_en}</b>
                  {' · '}
                  {t(`welcome.reviews.with.${r.relation}`)}
                </figcaption>
              </figure>
            ))}
          </div>
        </Reveal>
      </div>
    </>
  );
}

// The opening: the screen is dark, a red drop falls to the middle, lands
// like a drop of water (rings ripple out, the screen glows red), then the
// drop travels to the dot beside the DeePer wordmark and the hero builds in
// around it (the `intro-in` styles). Never with reduced motion, which opens
// straight onto the page.
// The full opening (about 6s) plays on the first visit of the day; after
// that each load gets a short one (about 4.5s: the drop lands, the rings
// fade, the name writes itself out and flies home), so a returning visitor isn't kept
// waiting but still sees each beat rather than a blur.
// `introPlayed` stops it replaying when coming back to / inside the app
// (after logging out, say); a reload starts fresh.
const INTRO_DAY_KEY = 'deeper-intro-day';
let introPlayed = false;
// Whether this page load already showed the opening (so the signed-in
// greeting doesn't play it a second time right after logging in).
export function introPlayedThisLoad() {
  return introPlayed;
}
function introMode() {
  if (introPlayed) return null;
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  } catch {
    return null;
  }
  try {
    return localStorage.getItem(INTRO_DAY_KEY) === new Date().toDateString() ? 'short' : 'full';
  } catch {
    // Storage blocked: no way to tell a first visit, so keep it brief.
    return 'short';
  }
}
const INTRO_DOT = 16;
const INTRO_JET = 64;
const INTRO_RING = 400;
const INTRO_WORD = 'DeePer';
// Native Web Animations on transform/opacity only, so the whole opening runs
// on the compositor: React mounting the page underneath (and its data
// fetches) can't make it stutter, which framer's per-frame JS updates did.
const dropPose = (x, y, sx = 1, sy = sx) => `translate(${x}px, ${y}px) scale(${sx}, ${sy})`;
// `greeting` (signed-in users' first open of the day, see MorningGreeting):
// there's no hero to fly home to, so once the name is written a welcome
// line rises under it, holds, and everything fades out where it is.
export function IntroDrop({ full, onLand, greeting = null }) {
  const root = useRef(null);
  const bg = useRef(null);
  const glow = useRef(null);
  const dot = useRef(null);
  const jet = useRef(null);
  const mark = useRef(null);
  const greet = useRef(null);
  const rings = [useRef(null), useRef(null), useRef(null), useRef(null), useRef(null), useRef(null)];
  useEffect(() => {
    introPlayed = true;
    if (full) {
      try {
        localStorage.setItem(INTRO_DAY_KEY, new Date().toDateString());
      } catch {
        /* storage blocked */
      }
    }
    const running = [];
    const play = (el, keyframes, options) => {
      const anim = el.animate(keyframes, { fill: 'forwards', ...options });
      running.push(anim);
      return anim.finished;
    };
    // Hold the page still while it plays (the mark flies to a spot on the
    // page). Swallowing scroll input rather than setting overflow:hidden,
    // which on a screen with a scrollbar reflowed the page twice.
    const block = (e) => e.preventDefault();
    const blockOpts = { passive: false };
    // A tap, click or key skips ahead: everything up to the written-out name
    // jumps to its end and the name flies home right away. Once it's already
    // flying there's nothing left to skip.
    let skipped = false;
    let moving = false;
    const skip = () => {
      if (moving || skipped) return;
      skipped = true;
      running.forEach((anim) => anim.finish());
    };
    window.addEventListener('wheel', block, blockOpts);
    window.addEventListener('touchmove', block, blockOpts);
    window.addEventListener('pointerdown', skip);
    window.addEventListener('keydown', skip);
    const unblock = () => {
      window.removeEventListener('wheel', block, blockOpts);
      window.removeEventListener('touchmove', block, blockOpts);
      window.removeEventListener('pointerdown', skip);
      window.removeEventListener('keydown', skip);
    };
    let dead = false;
    (async () => {
      // Start once the page underneath has mounted and the main thread is
      // free: kicked off during that work, the first second of the fall got
      // swallowed and the drop jumped.
      await document.fonts?.ready;
      await new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(r, { timeout: 700 }) : setTimeout(r, 200)));
      if (dead) return;
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const half = INTRO_DOT / 2;
      const top = cy - INTRO_JET - half - 8;

      // The overlay's own wordmark is styled to match the hero's exactly
      // (size, spacing, dot), so when it flies into place and hands over to
      // the real one nothing changes size or shifts.
      const heroDot = document.querySelector('.welcome-hero .brand-mark .dot');
      const heroWord = document.querySelector('.welcome-hero .brand');
      const m = mark.current;
      const mDot = m.querySelector('.dot');
      const mWord = m.querySelector('.brand');
      if (heroDot && heroWord) {
        const ws = getComputedStyle(heroWord);
        Object.assign(mWord.style, { fontSize: ws.fontSize, lineHeight: ws.lineHeight, letterSpacing: ws.letterSpacing });
        m.style.gap = getComputedStyle(heroDot.parentElement).columnGap;
        const d = heroDot.getBoundingClientRect();
        Object.assign(mDot.style, { width: `${d.width}px`, height: `${d.height}px` });
      }
      // Each letter carries its slice of the wordmark's gradient, so the
      // letters can fade in one by one and still read as one gradient.
      const letters = [...mWord.children];
      const wordW = mWord.offsetWidth;
      letters.forEach((l) => {
        l.style.backgroundSize = `${wordW}px 100%`;
        l.style.backgroundPosition = `${-(l.offsetLeft - mWord.offsetLeft)}px 0`;
      });
      const markW = m.offsetWidth;
      const dotSize = mDot.offsetWidth;
      const dotX = mDot.offsetLeft + dotSize / 2;
      const dotY = mDot.offsetTop + mDot.offsetHeight / 2;
      // Mark positions: its dot on the centre of the screen, then the whole
      // word centred, then the dot on the hero's dot.
      const atDot = dropPose(cx - dotX, cy - dotY);
      const centred = dropPose(cx - markW / 2, cy - dotY);

      // The whole timeline is laid out up front with delays (rather than
      // waiting for each step to finish), so there are no hand-offs between
      // steps for the main thread to be late on.
      // The short version keeps the same beats, a little quicker: no column
      // kicking the drop back up, three rings, and the name follows on.
      const IMPACT = full ? 850 : 800; // the drop reaches the surface
      const KICK = IMPACT + 100; // squashed flat on the surface
      const PEAK = KICK + 450; // top of the kick (full only)
      const SETTLE = full ? PEAK + 450 : KICK + 280; // resting on the centre
      const ripplesUsed = full ? rings : rings.slice(0, 3);
      const RING_GAP = full ? 120 : 130;
      const RING_MS = full ? 1500 : 1100;
      // Water still: the last ring has faded out completely. The name waits
      // for that in both versions, so it never writes over moving water.
      const CALM = IMPACT + 40 + RING_GAP * (ripplesUsed.length - 1) + RING_MS;
      const LETTERS = CALM + (full ? 250 : 150); // then the name
      const LETTER_GAP = full ? 110 : 80;
      const LETTER_MS = full ? 600 : 560;
      const SPELLED = LETTERS + LETTER_GAP * (INTRO_WORD.length - 1) + LETTER_MS;
      const MOVE = SPELLED + (full ? 450 : 320); // hold the full name, then fly it home
      const LAND = MOVE + (full ? 1000 : 900);
      const GLOW_PEAK = full ? PEAK : SETTLE;

      // 1. The drop falls, speeding up.
      play(dot.current, [
        { transform: dropPose(cx - half, -INTRO_DOT), opacity: 1 },
        { transform: dropPose(cx - half, cy - half), opacity: 1 },
      ], { duration: IMPACT, easing: 'cubic-bezier(0.55, 0, 1, 0.55)' });
      // 2. It hits the surface like a drop of water, seen from a low angle so
      // the rings are flat ellipses: rings ripple out one after another, the
      // glow swells, the drop squashes into the surface, a little column of
      // water kicks it back up, and it drops back to rest on the centre.
      const r0 = INTRO_RING / 2;
      const reach = Math.max(window.innerWidth * 1.5, 700) / INTRO_RING;
      ripplesUsed.forEach((r, i) => {
        const timing = { duration: RING_MS, delay: IMPACT + 40 + i * RING_GAP };
        play(r.current, [{ opacity: 0 }, { opacity: 0.9, offset: 0.08 }, { opacity: 0.35, offset: 0.45 }, { opacity: 0 }], { ...timing, easing: 'linear' });
        play(r.current, [
          { transform: dropPose(cx - r0, cy - r0, 0.02, 0.006) },
          { transform: dropPose(cx - r0, cy - r0, reach, reach * 0.3) },
        ], { ...timing, easing: 'cubic-bezier(0.15, 0.55, 0.3, 1)' });
      });
      play(glow.current, [{ opacity: 0, transform: 'scale(0.25)' }, { opacity: 1, transform: 'scale(1)' }], { duration: GLOW_PEAK - IMPACT, delay: IMPACT, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
      // The glow calms with the water, leaving a soft light around the drop.
      play(glow.current, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0.35, transform: 'scale(0.7)' }], { duration: CALM - GLOW_PEAK, delay: GLOW_PEAK, easing: 'ease-in-out' });
      play(dot.current, [
        { transform: dropPose(cx - half, cy - half) },
        { transform: dropPose(cx - half, cy - half + 4, 1.9, 0.3) },
      ], { duration: KICK - IMPACT, delay: IMPACT, easing: 'ease-out' });
      if (full) {
        play(jet.current, [
          { transform: dropPose(cx - 3, cy - INTRO_JET, 1, 0), opacity: 1 },
          { transform: dropPose(cx - 3, cy - INTRO_JET, 1, 1), opacity: 1 },
        ], { duration: 400, delay: KICK, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' });
        play(dot.current, [
          { transform: dropPose(cx - half, cy - half, 0.75) },
          { transform: dropPose(cx - half, top, 0.75) },
        ], { duration: PEAK - KICK, delay: KICK, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' });
        play(jet.current, [{ transform: dropPose(cx - 3, cy - INTRO_JET, 1, 1), opacity: 1 }, { transform: dropPose(cx - 3, cy - INTRO_JET, 1, 0), opacity: 0 }], { duration: 450, delay: PEAK, easing: 'ease-in' });
        play(dot.current, [
          { transform: dropPose(cx - half, top, 0.75) },
          { transform: dropPose(cx - half, cy - half, dotSize / INTRO_DOT) },
        ], { duration: SETTLE - PEAK, delay: PEAK, easing: 'cubic-bezier(0.45, 0, 0.55, 1)' });
      } else {
        // Short: straight from the squash back to a round dot at rest.
        play(dot.current, [
          { transform: dropPose(cx - half, cy - half + 4, 1.9, 0.3) },
          { transform: dropPose(cx - half, cy - half, dotSize / INTRO_DOT) },
        ], { duration: SETTLE - KICK, delay: KICK, easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)' });
      }
      // Once it rests on the water, the solid drop slowly softens into the
      // glowing orb of the app icon: the wordmark's dot (drawn as that orb,
      // same spot) fades in as the drop fades out.
      const ORB_MS = 900;
      play(dot.current, [{ opacity: 1 }, { opacity: 0 }], { duration: ORB_MS, delay: SETTLE, easing: 'ease-in-out' });
      play(m, [{ transform: atDot, opacity: 1 }, { transform: atDot, opacity: 1 }], { duration: 1, delay: SETTLE });
      play(mDot, [{ opacity: 0 }, { opacity: 1 }], { duration: ORB_MS, delay: SETTLE, easing: 'ease-in-out', fill: 'both' });
      // 3. Once the water is still, the name writes itself out beside the
      // dot, letter by letter, while the mark eases over to stay centred.
      letters.forEach((l, i) => {
        play(l, [
          { opacity: 0, transform: 'translateY(0.3em)', filter: 'blur(8px)' },
          { opacity: 1, transform: 'none', filter: 'blur(0)' },
        ], { duration: LETTER_MS, delay: LETTERS + i * LETTER_GAP, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
      });
      const spelled = play(m, [{ transform: atDot, opacity: 1 }, { transform: centred, opacity: 1 }], { duration: SPELLED - LETTERS, delay: LETTERS, easing: 'cubic-bezier(0.45, 0, 0.25, 1)' });
      if (skipped) running.forEach((anim) => anim.finish());
      // 4. The name flies to its place in the hero as the dark lifts. Where
      // that is gets measured only now: early on, the page's own entrance
      // animation still had the hero shifted down a little.
      await spelled;
      if (dead) return;
      moving = true;
      if (greeting) {
        const g = greet.current;
        Object.assign(g.style, { top: `${cy + m.offsetHeight / 2 + 18}px` });
        await play(g, [
          { opacity: 0, transform: 'translate(-50%, 10px)', filter: 'blur(6px)' },
          { opacity: 1, transform: 'translate(-50%, 0)', filter: 'blur(0)' },
        ], { duration: 700, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
        if (dead) return;
        const out = { duration: 800, delay: skipped ? 200 : 1400, easing: 'ease-in-out' };
        play(glow.current, [{ opacity: 0.35 }, { opacity: 0 }], out);
        play(g, [{ opacity: 1 }, { opacity: 0 }], out);
        play(m, [{ opacity: 1 }, { opacity: 0 }], out);
        await play(bg.current, [{ opacity: 1 }, { opacity: 0 }], out);
        if (dead) return;
        unblock();
        onLand?.();
        if (root.current) root.current.hidden = true;
        return;
      }
      const t = heroDot?.getBoundingClientRect();
      const home = t ? dropPose(t.left + t.width / 2 - dotX, t.top + t.height / 2 - dotY) : centred;
      const fade = skipped
        ? { duration: 700, delay: 0, easing: 'ease-in-out' }
        : { duration: LAND - MOVE, delay: MOVE - SPELLED, easing: 'ease-in-out' };
      play(glow.current, [{ opacity: 0.35, transform: 'scale(0.7)' }, { opacity: 0, transform: 'scale(0.7)' }], fade);
      play(bg.current, [{ opacity: 1 }, { opacity: 0 }], fade);
      const landed = play(m, [{ transform: centred, opacity: 1 }, { transform: home, opacity: 1 }], { ...fade, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' });
      await landed;
      if (dead) return;
      unblock();
      onLand();
      // Hide the overlay only once the hero has re-rendered with its own name
      // showing (onLand's state update paints a frame or two later); hiding
      // it straight away left the name missing for a couple of frames.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (root.current) root.current.hidden = true;
    })().catch(() => {
      /* cancelled on unmount */
    });
    return () => {
      dead = true;
      running.forEach((anim) => anim.cancel());
      unblock();
    };
  }, [full, onLand]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="intro-drop" ref={root} aria-hidden="true">
      <div className="intro-drop-bg" ref={bg} />
      <div className="intro-drop-glow" ref={glow} />
      {rings.map((r, i) => (
        <span className="intro-drop-ring" ref={r} key={i} />
      ))}
      <span className="intro-drop-jet" ref={jet} />
      <span className="intro-drop-dot" ref={dot} />
      <div className="brand-mark intro-mark" ref={mark}>
        <span className="dot" />
        <span className="brand">
          {INTRO_WORD.split('').map((c, i) => (
            <span className="intro-mark-letter" key={i}>
              {c}
            </span>
          ))}
        </span>
      </div>
      {greeting && (
        <p className="intro-greet" ref={greet}>
          {greeting}
        </p>
      )}
    </div>
  );
}

// Pressing a button on the landing page sends a ripple out from under the
// finger, the same water ring the opening plays, so the page keeps one
// language. Skipped with reduced motion.
function useTapRipples() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const onDown = (e) => {
      const host = e.target.closest?.('.btn');
      if (!host || !host.closest('.welcome-hero, .landing-more')) return;
      const r = host.getBoundingClientRect();
      const size = Math.hypot(r.width, r.height) * 1.2;
      const ring = document.createElement('span');
      ring.className = 'tap-ripple';
      Object.assign(ring.style, {
        width: `${size}px`,
        height: `${size}px`,
        left: `${e.clientX - r.left - size / 2}px`,
        top: `${e.clientY - r.top - size / 2}px`,
      });
      host.appendChild(ring);
      ring.animate([{ opacity: 1 }, { opacity: 0.7, offset: 0.4 }, { opacity: 0 }], { duration: 900, easing: 'linear' });
      ring
        .animate([{ transform: 'scale(0.05)' }, { transform: 'scale(1)' }], { duration: 900, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' })
        .finished.then(() => ring.remove(), () => ring.remove());
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);
}

// On a computer the hero deck leans toward the mouse a little, as if you
// could pick it up, and settles back flat when the mouse leaves. Not on touch
// screens, and not with reduced motion.
const TILT_DEG = 8;
function useDeckTilt() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    const stack = el?.querySelector('.sample-stack');
    if (!stack) return undefined;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    let frame = 0;
    let px = 0.5;
    let py = 0.5;
    const apply = () => {
      frame = 0;
      stack.style.setProperty('--tilt-y', `${(px - 0.5) * 2 * TILT_DEG}deg`);
      stack.style.setProperty('--tilt-x', `${(0.5 - py) * 1.5 * TILT_DEG}deg`);
    };
    const onMove = (e) => {
      const r = stack.getBoundingClientRect();
      px = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
      py = Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1);
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      px = 0.5;
      py = 0.5;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, []);
  return ref;
}

// The hero sits on still water: moving the mouse leaves faint red rings
// behind it, and a tap anywhere on the hero drops one, the same ring the
// opening plays. Buttons keep their own press ripple (useTapRipples). Not
// while the opening runs, and not with reduced motion.
const WATER_STEP_PX = 90; // mouse travel between rings
const WATER_MAX_RINGS = 10;
function useHeroWater() {
  const ref = useRef(null);
  useEffect(() => {
    const layer = ref.current;
    const hero = layer?.parentElement;
    if (!hero) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const drop = (e, size, strength) => {
      if (hero.classList.contains('is-intro') || layer.childElementCount >= WATER_MAX_RINGS) return;
      const r = layer.getBoundingClientRect();
      const ring = document.createElement('span');
      ring.className = 'hero-ring';
      Object.assign(ring.style, {
        width: `${size}px`,
        height: `${size}px`,
        left: `${e.clientX - r.left - size / 2}px`,
        top: `${e.clientY - r.top - size / 2}px`,
      });
      layer.appendChild(ring);
      const ms = 1800;
      ring.animate([{ opacity: strength }, { opacity: 0 }], { duration: ms, easing: 'cubic-bezier(0.3, 0, 0.6, 1)' });
      ring
        .animate([{ transform: 'scale(0.08)' }, { transform: 'scale(1)' }], { duration: ms, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' })
        .finished.then(() => ring.remove(), () => ring.remove());
    };
    let last = null;
    let travelled = 0;
    const onMove = (e) => {
      if (e.pointerType !== 'mouse') return;
      if (last) travelled += Math.hypot(e.clientX - last.x, e.clientY - last.y);
      last = { x: e.clientX, y: e.clientY };
      if (travelled < WATER_STEP_PX) return;
      travelled = 0;
      drop(e, 200, 0.55);
    };
    const onLeave = () => {
      last = null;
      travelled = 0;
    };
    const onDown = (e) => {
      if (e.target.closest('.btn, .lang-float, .scroll-cue')) return;
      drop(e, 340, 0.9);
    };
    hero.addEventListener('pointermove', onMove);
    hero.addEventListener('pointerleave', onLeave);
    hero.addEventListener('pointerdown', onDown);
    return () => {
      hero.removeEventListener('pointermove', onMove);
      hero.removeEventListener('pointerleave', onLeave);
      hero.removeEventListener('pointerdown', onDown);
    };
  }, []);
  return ref;
}

export default function Welcome() {
  const nav = useNavigate();
  const { t, lang } = useI18n();
  const socials = socialLinks();
  // 'run' while the opening plays, 'in' as the hero builds in, then null.
  const [introKind] = useState(introMode);
  const [intro, setIntro] = useState(introKind ? 'run' : null);
  const landIntro = useCallback(() => setIntro('in'), []);
  useTapRipples();
  const deckRef = useDeckTilt();
  const waterRef = useHeroWater();
  useSmoothScroll(intro !== 'run');
  const featuresRef = useRiseWithScroll();
  const stepsRef = useRiseWithScroll();
  useHeadingSweep();
  const socialRef = useRiseWithScroll();
  const teamRef = useRiseWithScroll();
  const [liveStats, setStats] = useState(landingCache.stats ?? null);
  const mockStats = useMockStatsForPreview();
  const stats = mockStats ?? liveStats;
  const mockSupporterCount = useMockSupporterCountForPreview();
  // Donors whose transfer proof the maintainer approved (npm run approve),
  // on top of any names hard-coded in SUPPORTERS. Empty until it loads; the
  // tier simply stays hidden if the request fails.
  const approvedSupporters = useLandingData(
    'supporters',
    '/support/supporters',
    (d) => d.supporters.map((name) => ({ name })),
    [],
  );
  const launch = useLaunch();
  // Sponsor logos added from the admin dashboard, after the hard-coded ones.
  const adminSponsors = useLandingData('sponsors', '/support/sponsors', (d) => d.sponsors, []);
  const sponsors = [...SPONSORS, ...adminSponsors];
  const activeSupporters =
    mockSupporterCount > 0
      ? makeMockSupportersDevOnly(mockSupporterCount)
      : [
          ...SUPPORTERS,
          ...approvedSupporters.filter((a) => !SUPPORTERS.some((s) => s.name === a.name)),
        ];

  // Public stat — keeps retrying every 5s while the page is open, so the
  // count fills in once the server is reachable instead of sticking on "···".
  useEffect(() => {
    let cancelled = false;
    let timer = null;
    const load = () => {
      api
        .get('/stats', { auth: false })
        .then((data) => {
          landingCache.stats = data;
          if (!cancelled) setStats(data);
        })
        .catch(() => {
          if (!cancelled) timer = setTimeout(load, 5000);
        });
    };
    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <>
      <DeepWater />
      <DepthGauge />
      {intro && <IntroDrop full={introKind === 'full'} onLand={landIntro} />}
      {/* Pinned to a full viewport regardless of content, so everything
          below (about / stats / supporters) always starts past the fold —
          see .landing-more below for the sibling that follows it. */}
      <div className={`page stagger welcome-hero${intro === 'run' ? ' is-intro' : intro === 'in' ? ' intro-in' : ''}`} style={{ minHeight: '100dvh' }}>
        <div className="lang-float">
          <LangToggle />
        </div>

        <div className="spacer" />
        <div className="center fade-up hero-text">
          <div className="brand-mark" style={{ justifyContent: 'center' }}>
            <span className="dot" />
            <span className="brand">DeePer</span>
          </div>
          {/* One line on what this is, so a first-time visitor knows before
              they scroll. */}
          <p className="hero-tagline">{t('welcome.tagline')}</p>
        </div>

        <div
          ref={deckRef}
          className="deck-hero fade-up"
          style={{ margin: '36px 0', display: 'grid', placeItems: 'center' }}
        >
          <SampleCard t={t} />
        </div>

        <div className="spacer" />
        <div className="stack mt-a hero-actions">
          <button className="btn btn--primary" onClick={() => nav('/signup')}>
            {t('welcome.signup')}
          </button>
          <button className="btn btn--ghost" onClick={() => nav('/login')}>
            {t('welcome.haveAccount')}
          </button>
        </div>
        <ScrollCue label={t('welcome.scrollMore')} />
        <div ref={waterRef} className="hero-water" aria-hidden="true" />
      </div>

      <DiveStory />


      {/* Below the fold, every piece rises in on its own as it scrolls into
          view — dividers, headings, paragraphs, each feature row, each
          developer, each sponsor tier — one after another, not a whole
          section at once (same as the iOS app's WelcomeView). */}
      <div className="landing-more">

        <LaunchCountdown t={t} launch={launch} />

        <div className="landing-section" data-depth={t('welcome.about.eyebrow')}>
          <Reveal>
            <h2 className="h2">{withLogo(t('welcome.about.title'))}</h2>
          </Reveal>
          <ScrollLit className="about-lit" text={t('welcome.about.body')} />
          {/* How a round goes, in the three moves the app actually has:
              pick, swipe, take turns. */}
          <div className="how-steps" ref={stepsRef}>
            {['pick', 'swipe', 'turns'].map((k, i) => (
              <div className="how-step" key={k}>
                <span className="how-num" aria-hidden="true">
                  {i + 1}
                </span>
                <p className="how-title">{t(`welcome.how.${k}.title`)}</p>
                {/* Wrap only at the copy's spaces, not mid-phrase. */}
                <p className="how-desc">{unbreakablePhrases(t(`welcome.how.${k}.desc`))}</p>
              </div>
            ))}
          </div>
          <Reveal>
            <p className="how-facts">
              {['free', 'web', 'home', 'lang'].map((k) => (
                <span key={k}>
                  <i aria-hidden="true" />
                  {t(`welcome.how.fact.${k}`)}
                </span>
              ))}
            </p>
          </Reveal>
        </div>

        <div className="landing-section lit-section" data-depth={t('welcome.features.eyebrow')}>
          <Reveal>
            <h2 className="h2">{withLogo(t('welcome.features.title'))}</h2>
          </Reveal>
          <div className="feature-list" ref={featuresRef}>
            {FEATURES.map(({ Icon, key }) => (
              <div className="feature-row" key={key}>
                <span className="feature-ic">
                  <Icon size={20} />
                </span>
                <div className="feature-text">
                  <p className="feature-title">{t(`welcome.features.${key}.title`)}</p>
                  <p className="feature-desc">{t(`welcome.features.${key}.desc`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Numbers only once they say something: "0+ questions answered"
            read as broken. Comes back by itself as people use the app. */}
        {(stats?.user_count ?? 0) >= STATS_MIN_USERS && (
        <>

        <div className="landing-section" data-depth={t('welcome.stats.eyebrow')}>
          <Reveal>
            <p className="stat-kicker">{t('welcome.stats.eyebrow')}</p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="stat-number-wrap">
              <CountUpNumber target={stats?.user_count ?? null} />
              <Sparkles points={STAT_SPARKLES} />
            </div>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="stat-label">{t('welcome.stats.label')}</div>
          </Reveal>
          <div className="stat-grid">
            {ACTIVITY_STATS.filter(({ field }) => (stats?.[field] ?? 0) >= STATS_MIN_ACTIVITY).map(({ key, field }, i) => (
              <Reveal className="stat-cell" key={key} delay={0.25 + 0.08 * i}>
                <CountUpNumber target={stats?.[field] ?? null} className="stat-number stat-number--sm" />
                <div className="stat-label">{t(`welcome.stats.${key}`)}</div>
              </Reveal>
            ))}
          </div>
        </div>
        </>
        )}

        <ReviewsSection t={t} lang={lang} />

        {/* Where news and events get announced — right after the user count,
            so "this many people use it" leads straight into "follow along". */}
        <div className="landing-section lit-section" data-depth={t('welcome.social.eyebrow')}>
          <Reveal>
            <h2 className="h2">
              <span className="sparkle-anchor">
                {t('welcome.social.title')}
                <Sparkles points={SOCIAL_SPARKLES} />
              </span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="sub">{t('social.msg')}</p>
          </Reveal>
          <div className="social-links" ref={socialRef}>
            {socials.map(({ key, handle, url }) => {
              const Icon = SOCIAL_ICONS[key];
              const body = (
                <>
                  <span className="feature-ic">
                    <Icon size={28} />
                  </span>
                  <span className="social-link-text">
                    <span className="social-link-head">
                      <span className="feature-title">{t(`social.${key}`)}</span>
                      <span className="social-link-handle">{url ? `@${handle}` : t('social.soon')}</span>
                    </span>
                    <span className="feature-desc">{t(`social.${key}Desc`)}</span>
                  </span>
                </>
              );
              return url ? (
                <a key={key} className="social-link" href={url} target="_blank" rel="noopener noreferrer">
                  {body}
                </a>
              ) : (
                <div key={key} className="social-link">
                  {body}
                </div>
              );
            })}
          </div>
        </div>

        {/* Credits the people who built the app — distinct from Supporters
            (people who donated) below, deliberately different heading and a
            plain text list, no card/box and no carousel, so the two never
            read as the same kind of list. */}
        <div className="landing-section lit-section" data-depth={t('welcome.team.eyebrow')}>
          <Reveal>
            <h2 className="h2">{withLogo(t('welcome.team.title'))}</h2>
          </Reveal>
          <div className="dev-team-list" ref={teamRef}>
            {DEV_TEAM.map((dev) => (
              <DevTeamCard key={dev.nameTh} dev={dev} lang={lang} nav={nav} />
            ))}
          </div>
        </div>

        <div className="landing-section" data-depth={t('welcome.supporters.eyebrow')}>
          <Reveal>
            <h2 className="h2">{t('welcome.supporters.title')}</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="sub">{t('welcome.supporters.body')}</p>
          </Reveal>
          {sponsors.length > 0 && (
            <SponsorTiers t={t} sponsors={sponsors} sealed={!launch.launched} />
          )}
          {activeSupporters.length > 0 ? (
            // Lowest tier, below bronze: "ผู้สนับสนุนรายบุคคล", people who
            // donated through the site (approved proofs, plus SUPPORTERS),
            // as one auto-scrolling row of name chips — it loops
            // even with only a couple of names, since short rows repeat
            // their items into a longer set (see SupportersRow).
            <Reveal className="sponsor-tier sponsor-tier-individual">
              <p className="sponsor-tier-label sponsor-tier-label--individual">
                <span className="tier-gem" aria-hidden="true">✦</span>
                {t('welcome.supporters.tier.individual')}
                <span className="tier-gem" aria-hidden="true">✦</span>
              </p>
              <Sealed t={t} sealed={!launch.launched} index={3}>
                <SupportersMarquee items={activeSupporters} rowCount={1} />
              </Sealed>
            </Reveal>
          ) : sponsors.length > 0 ? null : (
            <Reveal className="supporters-placeholder">
              <span className="supporters-placeholder-ic">
                <IcSparkle size={20} />
              </span>
              <p className="supporters-placeholder-text">{t('welcome.supporters.placeholder')}</p>
            </Reveal>
          )}
        </div>

        {/* The bottom of the dive: the orb glows in the deep (DeepWater).
            A question to take with you, the name, an invitation in, then
            the contact lines and the page's small print. */}
        <section className="landing-end" data-depth={t('welcome.dive.bottom')}>
          <Reveal>
            <p className="end-ask">{t('welcome.end.ask')}</p>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="end-q">{t('welcome.dive.deepQ')}</p>
          </Reveal>
          <Reveal delay={0.2} className="end-brand">
            <span className="dot" />
            <span className="brand">DeePer</span>
          </Reveal>
          <Reveal delay={0.3}>
            <p className="end-tagline">{t('welcome.dive.end')}</p>
          </Reveal>
          <Reveal delay={0.4} className="end-actions">
            <button className="btn btn--primary end-cta" onClick={() => nav('/signup')}>
              {t('welcome.end.cta')}
            </button>
            <button className="btn btn--ghost" onClick={() => nav('/login')}>
              {t('welcome.haveAccount')}
            </button>
          </Reveal>
          <Reveal delay={0.5}>
            <p className="how-facts end-facts">
              {['free', 'web'].map((k) => (
                <span key={k}>
                  <i aria-hidden="true" />
                  {t(`welcome.how.fact.${k}`)}
                </span>
              ))}
            </p>
          </Reveal>
        {/* Contact lines, grouped at the foot of the page: sponsoring first
            (right after the sponsor logos), then problems / suggestions. */}
        <Reveal className="landing-report">
          <p>
            {t('sponsorForm.teaser')}{' '}
            <button className="link" type="button" onClick={() => nav('/sponsor')}>
              {t('sponsorForm.teaserCta')}
            </button>
          </p>
          <p>
            {t('report.footer')}{' '}
            <button className="link" type="button" onClick={() => nav('/report', { state: { from: '/' } })}>
              {t('report.footerCta')}
            </button>
          </p>
          <p>
            {/* A real link (not a button) so it also works as a plain
                page load and crawlers follow it. */}
            <Link className="link" to="/questions">
              {t('samples.link')}
            </Link>
            {' · '}
            <button className="link" type="button" onClick={() => nav('/privacy')}>
              {t('privacy.link')}
            </button>
          </p>
          {/* A quiet close to the page instead of just stopping. */}
          <p className="landing-copyright">© 2569 DeePer</p>
        </Reveal>
        </section>
      </div>
    </>
  );
}
