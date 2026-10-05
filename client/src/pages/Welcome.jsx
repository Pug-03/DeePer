import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useInView, useReducedMotion, animate } from 'framer-motion';
import { useI18n } from '../store/i18n.jsx';
import { api } from '../api.js';
import LangToggle from '../components/LangToggle.jsx';
import Sparkles from '../components/Sparkles.jsx';
import {
  IcSparkle,
  IcMousePointer,
  IcCards,
  IcUser,
  IcShare,
  IcHistory,
  IcFileText,
  IcInstagram,
  IcTikTok,
} from '../components/icons.jsx';
import { DEV_TEAM } from '../dev-team-info.js';
import { SPONSORS, SPONSOR_TIERS, SUPPORTERS } from '../sponsors-info.js';
import { socialLinks } from '../social-info.js';
// `import.meta.env.DEV` below is a compile-time constant, so Vite's
// production build dead-code-eliminates the branch that reads this import —
// this fixture (and its placeholder strings) never reaches the shipped
// bundle. See client/src/dev/mockSupporters.js for the full explanation.
import { makeMockSupportersDevOnly } from '../dev/mockSupporters.js';

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
function Reveal({ children = null, delay = 0, className }) {
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.3, once: true });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 26 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 26 }}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

// The landing user count: "···" until the stat loads, then counts up from 0
// on a gentle ease-out the first time it scrolls into view, and pops when it
// lands — same timing as the iOS app's CountUpNumber (WelcomeView.swift).
function CountUpNumber({ target }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduceMotion = useReducedMotion();
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
      className="stat-number"
      // Landing pop: swell out, then spring back to size.
      animate={landed ? { scale: [1, 1.22, 1] } : { scale: 1 }}
      transition={{ duration: 0.66, times: [0, 0.25, 1], ease: ['easeOut', [0.34, 1.56, 0.64, 1]] }}
    >
      {target == null ? '···' : `${value}+`}
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
// rather than six near-identical JSX blocks.
const FEATURES = [
  { Icon: IcCards, key: 'deck' },
  { Icon: IcUser, key: 'partner' },
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

    const oneSet = () => el.scrollWidth / 2;
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
      frame = requestAnimationFrame(tick);
    };
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
// Official launch: 11.11.2569 at 11:11 Bangkok time. Pinned to +07:00 so
// every visitor counts down to the same instant whatever their timezone.
const LAUNCH_AT = new Date('2026-11-11T11:11:00+07:00').getTime();
const COUNTDOWN_UNITS = ['days', 'hours', 'minutes', 'seconds'];

function splitRemaining(ms) {
  const s = Math.floor(ms / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor(s / 3600) % 24,
    minutes: Math.floor(s / 60) % 60,
    seconds: s % 60,
  };
}

// Ticks once a second until launch, then returns null so the section
// disappears on its own — no follow-up deploy needed to take it down.
function useLaunchCountdown() {
  const [now, setNow] = useState(() => Date.now());
  const done = now >= LAUNCH_AT;
  useEffect(() => {
    if (done) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [done]);
  return done ? null : splitRemaining(LAUNCH_AT - now);
}

function LaunchCountdown({ t }) {
  const remaining = useLaunchCountdown();
  if (!remaining) return null;
  return (
    <>
      <div className="landing-section">
        <Reveal>
          <p className="eyebrow">{t('welcome.launch.eyebrow')}</p>
          <h2 className="h2">{t('welcome.launch.title')}</h2>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="countdown" role="timer" aria-live="off">
            {COUNTDOWN_UNITS.map((unit) => (
              <div className="countdown-cell" key={unit}>
                <span className="countdown-num">
                  {String(remaining[unit]).padStart(2, '0')}
                </span>
                <span className="countdown-unit">{t(`welcome.launch.${unit}`)}</span>
              </div>
            ))}
          </div>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="stat-label">{t('welcome.launch.when')}</p>
        </Reveal>
      </div>

      <Reveal className="landing-divider" />
    </>
  );
}

function SponsorTiers({ t, sponsors }) {
  const byTier = SPONSOR_TIERS.map((tier) => [tier, sponsors.filter((s) => s.tier === tier)]);
  return (
    <div className="sponsor-tiers">
      {byTier.map(([tier, items]) => {
        if (items.length === 0) return null;
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
            <div className="sponsor-wall">{items.map(renderSponsorLogo)}</div>
          </Reveal>
        );
      })}
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

  return (
    <div className="dev-team-entry">
      <div className="dev-team-row">
        {showPhoto ? (
          <img
            className="dev-team-avatar-img"
            src={dev.avatar}
            alt={name}
            style={{ objectPosition: dev.avatarPosition || 'center' }}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span className="supporter-avatar dev-team-avatar-fallback">{initials(name)}</span>
        )}
        <div className="dev-team-text">
          {dev.awardsHref ? (
            <button
              type="button"
              className="dev-team-name dev-team-name-clickable"
              onClick={() => nav(dev.awardsHref)}
            >
              {name}
              <IcMousePointer size={17} className="dev-team-name-icon" />
            </button>
          ) : (
            <p className="dev-team-name">{name}</p>
          )}
          <p className="dev-team-role">{role}</p>
        </div>
      </div>
      {dev.link && (
        <a className="link dev-team-link" href={dev.link} target="_blank" rel="noreferrer">
          {dev.link.replace(/^https?:\/\//, '')}
        </a>
      )}
    </div>
  );
}

export default function Welcome() {
  const nav = useNavigate();
  const { t, lang } = useI18n();
  const socials = socialLinks();
  const [userCount, setUserCount] = useState(null);
  const mockSupporterCount = useMockSupporterCountForPreview();
  // Donors whose transfer proof the maintainer approved (npm run approve),
  // on top of any names hard-coded in SUPPORTERS. Empty until it loads; the
  // tier simply stays hidden if the request fails.
  const [approvedSupporters, setApprovedSupporters] = useState([]);
  useEffect(() => {
    let cancelled = false;
    api
      .get('/support/supporters', { auth: false })
      .then((d) => {
        if (!cancelled) setApprovedSupporters(d.supporters.map((name) => ({ name })));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  // Sponsor logos added from the admin dashboard, after the hard-coded ones.
  const [adminSponsors, setAdminSponsors] = useState([]);
  useEffect(() => {
    let cancelled = false;
    api
      .get('/support/sponsors', { auth: false })
      .then((d) => {
        if (!cancelled) setAdminSponsors(d.sponsors);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
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
          if (!cancelled) setUserCount(data.user_count);
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
      {/* Pinned to a full viewport regardless of content, so everything
          below (about / stats / supporters) always starts past the fold —
          see .landing-more below for the sibling that follows it. */}
      <div className="page stagger" style={{ minHeight: '100dvh' }}>
        <div className="lang-float">
          <LangToggle />
        </div>

        <div className="spacer" />
        <div className="center fade-up">
          <div className="brand-mark" style={{ justifyContent: 'center' }}>
            <span className="dot" />
            <span className="brand">DeePer</span>
          </div>
        </div>

        <div
          className="deck-hero fade-up"
          style={{ margin: '36px 0', display: 'grid', placeItems: 'center' }}
        >
          <div
            className="glass glass--red"
            style={{
              width: 260,
              height: 300,
              display: 'grid',
              placeItems: 'center',
              padding: 28,
              textAlign: 'center',
              transform: 'rotate(-4deg)',
            }}
          >
            <p style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.5, textWrap: 'balance' }}>
              {t('welcome.sample')}
            </p>
          </div>
        </div>

        <div className="spacer" />
        <div className="stack mt-a">
          <button className="btn btn--primary" onClick={() => nav('/signup')}>
            {t('welcome.signup')}
          </button>
          <button className="btn btn--ghost" onClick={() => nav('/login')}>
            {t('welcome.haveAccount')}
          </button>
        </div>
      </div>

      {/* Below the fold, every piece rises in on its own as it scrolls into
          view — dividers, headings, paragraphs, each feature row, each
          developer, each sponsor tier — one after another, not a whole
          section at once (same as the iOS app's WelcomeView). */}
      <div className="landing-more">
        <Reveal className="landing-divider" />

        <LaunchCountdown t={t} />

        <div className="landing-section">
          <Reveal>
            <p className="eyebrow">{t('welcome.about.eyebrow')}</p>
            <h2 className="h2">{t('welcome.about.title')}</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="sub">{t('welcome.about.body')}</p>
          </Reveal>
        </div>

        <Reveal className="landing-divider" />

        <div className="landing-section">
          <Reveal>
            <p className="eyebrow">{t('welcome.features.eyebrow')}</p>
            <h2 className="h2">{t('welcome.features.title')}</h2>
          </Reveal>
          <div className="feature-list">
            {FEATURES.map(({ Icon, key }, i) => (
              <Reveal className="feature-row" key={key} delay={0.08 * i}>
                <span className="feature-ic">
                  <Icon size={18} />
                </span>
                <div className="feature-text">
                  <p className="feature-title">{t(`welcome.features.${key}.title`)}</p>
                  <p className="feature-desc">{t(`welcome.features.${key}.desc`)}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal className="landing-divider" />

        <div className="landing-section">
          <Reveal>
            <p className="eyebrow">{t('welcome.stats.eyebrow')}</p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="stat-number-wrap">
              <CountUpNumber target={userCount} />
              <Sparkles points={STAT_SPARKLES} />
            </div>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="stat-label">{t('welcome.stats.label')}</div>
          </Reveal>
        </div>

        <Reveal className="landing-divider" />

        {/* Where news and events get announced — right after the user count,
            so "this many people use it" leads straight into "follow along". */}
        <div className="landing-section">
          <Reveal>
            <p className="eyebrow">{t('welcome.social.eyebrow')}</p>
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
          <div className="social-links">
            {socials.map(({ key, handle, url }, i) => {
              const Icon = SOCIAL_ICONS[key];
              const body = (
                <>
                  <span className="feature-ic">
                    <Icon size={19} />
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
              return (
                <Reveal key={key} delay={0.08 * i}>
                  {url ? (
                    <a className="social-link glass" href={url} target="_blank" rel="noopener noreferrer">
                      {body}
                    </a>
                  ) : (
                    <div className="social-link glass">{body}</div>
                  )}
                </Reveal>
              );
            })}
          </div>
        </div>

        <Reveal className="landing-divider" />

        {/* Credits the people who built the app — distinct from Supporters
            (people who donated) below, deliberately different heading and a
            plain text list, no card/box and no carousel, so the two never
            read as the same kind of list. */}
        <div className="landing-section">
          <Reveal>
            <p className="eyebrow">{t('welcome.team.eyebrow')}</p>
            <h2 className="h2">{t('welcome.team.title')}</h2>
          </Reveal>
          <div className="dev-team-list">
            {DEV_TEAM.map((dev, i) => (
              <Reveal key={dev.nameTh} delay={0.1 * i}>
                <DevTeamCard dev={dev} lang={lang} nav={nav} />
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal className="landing-divider" />

        <div className="landing-section">
          <Reveal>
            <p className="eyebrow">{t('welcome.supporters.eyebrow')}</p>
            <h2 className="h2">{t('welcome.supporters.title')}</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="sub">{t('welcome.supporters.body')}</p>
          </Reveal>
          {sponsors.length > 0 && <SponsorTiers t={t} sponsors={sponsors} />}
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
              <SupportersMarquee items={activeSupporters} rowCount={1} />
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

        <Reveal className="landing-divider" />

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
        </Reveal>
      </div>
    </>
  );
}
