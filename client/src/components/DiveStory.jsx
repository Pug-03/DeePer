import { useEffect, useRef } from 'react';
import { useI18n } from '../store/i18n.jsx';

// Right under the landing hero, the first stretch of the dive (the water
// itself is DeepWater, behind the whole page): the screen holds still
// (sticky) while the scroll brings up one line at a time, saying what DeePer
// is for and passing the app's three question levels on the way down. Each
// line's opacity/blur/offset is written straight from the scroll each frame,
// no React re-render. Markers for the depth gauge sit along the section.

// When each line is on screen, as fractions of this section's scroll.
const BEATS = [
  { key: 'surface', at: [0, 0.17] },
  { key: 'b1', at: [0.15, 0.34] },
  { key: 'b2', at: [0.37, 0.54] },
  { key: 'open', at: [0.57, 0.7] },
  { key: 'mid', at: [0.71, 0.84] },
  { key: 'deep', at: [0.85, 1.2] },
];
// The small talk at the surface rises past one bubble at a time: each
// starts below the middle of the screen and floats up and out, the next
// following a little later. Nearer ones are bigger and sharper.
const BUBBLES = [
  { key: 'small1', x: '28%', start: 0, scale: 1.12, blur: 0 },
  { key: 'small2', x: '70%', start: 0.018, scale: 0.92, blur: 0.6 },
  { key: 'small4', x: '46%', start: 0.036, scale: 1, blur: 0 },
  { key: 'small3', x: '72%', start: 0.054, scale: 0.84, blur: 1.2 },
  { key: 'small5', x: '26%', start: 0.072, scale: 0.96, blur: 0.4 },
];
const BUBBLE_RUN = 0.08; // how much of the section one bubble takes to rise past
const FADE = 0.04; // how much of the section a line takes to come in or go out
// Gauge stops, at the middle of their level's line.
const MARKS = [
  { key: 'surface', at: 0.02 },
  { key: 'open', at: 0.63 },
  { key: 'mid', at: 0.77 },
  { key: 'deep', at: 0.91 },
];

const smooth = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

// How deep a level goes, drawn beside its name: one orb with rings
// spreading out from it, like the opening's drop landing — one ring for
// light, two for medium, three for deep.
function LevelMark({ depth }) {
  return (
    <span className="lv-ripple" aria-hidden="true">
      {Array.from({ length: depth + 1 }, (_, r) => (
        <i key={r} style={{ animationDelay: `${r * 0.6}s`, '--r': r }} />
      ))}
      <b />
    </span>
  );
}

export default function DiveStory() {
  const { t } = useI18n();
  const root = useRef(null);
  const beats = useRef([]);

  useEffect(() => {
    const section = root.current;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Blur is costly to animate on phones; there the lines just fade and
    // glide.
    const soft = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    let target = 0;
    let at = 0;
    let frame = 0;
    // The section's place on the page, read only when the layout changes.
    let top = 0;
    let run = 1;
    const place = () => {
      top = section.getBoundingClientRect().top + window.scrollY;
      run = Math.max(1, section.offsetHeight - window.innerHeight);
    };
    const measure = () => {
      target = Math.min(Math.max((window.scrollY - top) / run, 0), 1);
    };
    const paint = (p) => {
      const vh = window.innerHeight;
      beats.current.forEach((el, i) => {
        if (!el) return;
        if (BEATS[i].key === 'surface') {
          el.style.opacity = '1';
          el.style.visibility = p < BEATS[i].at[1] ? 'visible' : 'hidden';
          el.querySelectorAll('.dive-surface span').forEach((b, j) => {
            const k = (p - BUBBLES[j].start) / BUBBLE_RUN;
            const o = smooth(0, 0.18, k) * (1 - smooth(0.7, 1, k));
            const y = (0.55 - k) * vh * 1.15;
            b.style.opacity = o.toFixed(3);
            b.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0) scale(${BUBBLES[j].scale})`;
          });
          return;
        }
        const [a, b] = BEATS[i].at;
        const inP = a === 0 ? 1 : smooth(a, a + FADE, p);
        const outP = smooth(b - FADE, b, p);
        const o = inP * (1 - outP);
        el.style.opacity = o.toFixed(3);
        el.style.visibility = o < 0.005 ? 'hidden' : 'visible';
        el.style.transform = `translate3d(0, ${((1 - inP) * 34 - outP * 34).toFixed(1)}px, 0)`;
        if (soft) el.style.filter = o > 0.98 ? 'none' : `blur(${((1 - o) * 8).toFixed(1)}px)`;
      });
    };
    const tick = () => {
      frame = 0;
      // Ease toward the scroll position so the words glide instead of
      // jumping with each wheel notch.
      at += (target - at) * (reduce ? 1 : 0.3);
      if (Math.abs(target - at) < 0.0005) at = target;
      paint(at);
      if (at !== target) frame = requestAnimationFrame(tick);
    };
    const onScroll = () => {
      measure();
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const relayout = () => {
      place();
      onScroll();
    };
    const ro = new ResizeObserver(relayout);
    ro.observe(document.querySelector('.app-shell') || document.body);
    window.addEventListener('scroll', onScroll, { passive: true });
    place();
    measure();
    at = target;
    paint(at);
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  // A question level's label: its name beside a ripple showing how deep the
  // level goes (see LevelMark).
  const level = (k) => (
    <>
      <span className="dive-level">
        <LevelMark depth={['open', 'mid', 'deep'].indexOf(k)} />
        {t(`home.level.${k}`)}
      </span>
      <p className="dive-q">{t(`welcome.dive.${k}Q`)}</p>
    </>
  );
  const content = {
    surface: (
      <div className="dive-surface">
        {BUBBLES.map((b) => (
          <span key={b.key} style={{ left: b.x, filter: b.blur ? `blur(${b.blur}px)` : undefined }}>
            {t(`welcome.dive.${b.key}`)}
          </span>
        ))}
      </div>
    ),
    b1: (
      <p className="dive-line">
        {t('welcome.dive.b1a')}
        <br />
        <span className="dive-soft">{t('welcome.dive.b1b')}</span>
      </p>
    ),
    b2: (
      <p className="dive-line">
        {t('welcome.dive.b2a')}
        <br />
        <em>{t('welcome.dive.b2b')}</em>
      </p>
    ),
    open: level('open'),
    mid: level('mid'),
    deep: level('deep'),
  };

  return (
    <section className="dive" ref={root} aria-label={t('welcome.dive.label')}>
      {MARKS.map((m) => (
        <span
          key={m.key}
          className="dive-mark"
          style={{ '--at': m.at }}
          data-depth={m.key === 'surface' ? t('welcome.dive.surface') : t(`home.level.${m.key}`)}
        />
      ))}
      <div className="dive-stage">
        {BEATS.map((b, i) => (
          <div key={b.key} className={`dive-beat dive-beat--${b.key}`} ref={(el) => (beats.current[i] = el)}>
            {content[b.key]}
          </div>
        ))}
      </div>
    </section>
  );
}
