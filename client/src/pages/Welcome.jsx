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

// Shared by both the scrolling marquee and the static display — same
// photo-with-initials-fallback pattern as DevTeamCard.
// `vertical` switches to the static layout: image on
// top, name below, and object-fit: contain in a slightly bigger square
// instead of the marquee chip's tight cropped circle — a logo (not
// necessarily a square headshot) reads cleanly there, where the marquee's
// small circle was cropping/squishing it.
function SupporterChip({ s, vertical }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showPhoto = s.avatar && !imgFailed;
  return (
    <>
      {showPhoto ? (
        <img
          className={vertical ? 'supporter-avatar-static' : 'supporter-avatar-img'}
          src={s.avatar}
          alt={s.name}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className={`supporter-avatar${vertical ? ' supporter-avatar-static' : ''}`}>
          {initials(s.name)}
        </span>
      )}
      <span className="supporter-name">{s.name}</span>
    </>
  );
}

// JS-driven marquee: each row is a real horizontal scroller (overflow-x)
// whose scrollLeft is advanced every animation frame, so people can also
// swipe / trackpad-scroll / mouse-drag through it themselves. Any manual
// interaction pauses the auto-scroll, which resumes shortly after the last
// one. Paused via React state (not just CSS :hover) so touch press-and-hold
// also works.
//
// Loop is seamless: each row's track renders its item list twice back-to-
// back, and whenever the scroll position passes one set's width (half the
// scrollWidth) it jumps back by exactly that width — the frame on either
// side of the jump is pixel-identical. The same wrap applies to manual
// scrolling, so dragging never hits an end.
//
// Speed is a constant px/second, so every row moves at the same physical
// speed regardless of item count or name length.
const MARQUEE_PX_PER_SECOND = 40;
const MARQUEE_RESUME_MS = 1500; // idle time after a manual scroll before auto-scroll picks back up
// Mouse-drag fling: releasing mid-drag keeps the row gliding at the release
// speed, decaying by this rate (1/s) until it drops under the stop speed —
// touch already gets native momentum from overflow-x.
const MARQUEE_FLING_DECAY = 3;
const MARQUEE_FLING_MIN_PX_PER_SECOND = 20;
const MARQUEE_FLING_STALE_MS = 80; // pause this long before release = no fling
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

const renderSupporterChip = (s, i, hidden) => (
  <span className="supporter-chip glass" key={`${s.name}-${i}`} aria-hidden={hidden}>
    <SupporterChip s={s} />
  </span>
);

function SupportersRow({ items, reverse, paused, renderItem = renderSupporterChip }) {
  let set = items;
  while (set.length < MARQUEE_MIN_SET_ITEMS) set = [...set, ...items];
  const track = [...set, ...set];
  const scrollerRef = useRef(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  // Scroll position lives in a ref so it survives the effect re-running;
  // null = not placed yet.
  const posRef = useRef(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Float position kept here, not read back from scrollLeft, since some
    // browsers round scrollLeft to whole pixels and 40px/s at 60fps is
    // well under one pixel per frame.
    let pos = posRef.current ?? 0;
    let userActiveUntil = 0;
    let lastTime = 0;
    let frame = 0;
    let drag = null;
    let fling = 0; // px/s, signed along scrollLeft

    const oneSet = () => el.scrollWidth / 2;
    const wrap = (x) => {
      const half = oneSet();
      if (half <= 0) return x;
      return ((x % half) + half) % half;
    };
    // First mount only: start reversed rows mid-set so they have room to
    // move left too. Later runs keep wherever the row already was.
    if (posRef.current === null) pos = reverse ? oneSet() / 2 : 0;
    el.scrollLeft = pos;

    const markUserActive = () => {
      userActiveUntil = performance.now() + MARQUEE_RESUME_MS;
    };

    const tick = (now) => {
      const dt = lastTime ? (now - lastTime) / 1000 : 0;
      lastTime = now;
      if (fling && !drag) {
        pos = wrap(pos + fling * dt);
        el.scrollLeft = pos;
        fling *= Math.exp(-MARQUEE_FLING_DECAY * dt);
        if (Math.abs(fling) < MARQUEE_FLING_MIN_PX_PER_SECOND) fling = 0;
        markUserActive();
      } else if (!reduceMotion && !pausedRef.current && !drag && now > userActiveUntil) {
        pos = wrap(pos + (reverse ? -1 : 1) * MARQUEE_PX_PER_SECOND * dt);
        el.scrollLeft = pos;
      }
      posRef.current = pos;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    // Manual scroll (touch swipe, trackpad, scrollbar): adopt its position
    // and wrap so it never reaches either end.
    const onScroll = () => {
      // Our own writes land within a pixel of pos; skip those unless a
      // person is mid-interaction (slow swipes also move < 1px per event).
      if (Math.abs(el.scrollLeft - pos) < 1 && performance.now() > userActiveUntil) return;
      markUserActive();
      const wrapped = wrap(el.scrollLeft);
      if (Math.abs(wrapped - el.scrollLeft) >= 1) el.scrollLeft = wrapped;
      pos = wrapped;
    };

    // Mouse drag — touch already scrolls natively via overflow-x.
    const onPointerDown = (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      drag = { x: e.clientX, start: pos, lastX: e.clientX, lastT: e.timeStamp, v: 0 };
      fling = 0;
      el.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e) => {
      if (!drag) return;
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
      if (!drag) return;
      const stale = e.timeStamp - drag.lastT > MARQUEE_FLING_STALE_MS;
      if (!reduceMotion && !stale) fling = drag.v;
      drag = null;
      markUserActive();
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('touchstart', markUserActive, { passive: true });
    el.addEventListener('wheel', markUserActive, { passive: true });
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('touchstart', markUserActive);
      el.removeEventListener('wheel', markUserActive);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
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

// One shared pause state for all rows — hovering/touching anywhere in the
// group pauses every row together, which reads cleaner than each row
// independently starting and stopping as the pointer crosses between them.
function SupportersMarquee({ items, renderItem, rowCount = MARQUEE_ROWS }) {
  const [paused, setPaused] = useState(false);
  // Memoized so hovering (which re-renders via setPaused) hands each row the
  // same array — a new one would restart the row's scroll effect and make
  // it jump.
  const rows = useMemo(() => splitIntoRows(items, rowCount), [items, rowCount]);

  return (
    <div
      className="supporters-marquee-group"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
      onTouchCancel={() => setPaused(false)}
    >
      {rows.map((row, i) => (
        <SupportersRow
          key={i}
          items={row}
          reverse={i % 2 === 1}
          paused={paused}
          renderItem={renderItem}
        />
      ))}
    </div>
  );
}

// Organization logos — no tile/background: the logo files themselves are
// transparent and pre-recolored for the dark page (see sponsors-info.js).
const renderSponsorLogo = (s, i) => (
  <span className="sponsor-logo" key={`${s.name}-${i}`}>
    <img src={s.logo} alt={s.name} />
  </span>
);

// Sponsors grouped by tier, largest logos first. Each tier uses a static
// centered wall so every logo stays visible.
// Built once so each tier's list keeps the same identity across renders.
const SPONSORS_BY_TIER = SPONSOR_TIERS.map((tier) => [tier, SPONSORS.filter((s) => s.tier === tier)]);

function SponsorTiers({ t }) {
  return (
    <div className="sponsor-tiers">
      {SPONSORS_BY_TIER.map(([tier, items]) => {
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
            <h2 className="h2">{t('welcome.social.title')}</h2>
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
          {SPONSORS.length > 0 && <SponsorTiers t={t} />}
          {activeSupporters.length > 0 ? (
            // Lowest tier, below bronze: "เพื่อนของ DeePer", people who
            // donated through the site (approved proofs, plus SUPPORTERS),
            // as one auto-scrolling row of name chips — it loops
            // even with only a couple of names, since short rows repeat
            // their items into a longer set (see SupportersRow).
            <Reveal className="sponsor-tier sponsor-tier-individual">
              <p className="sponsor-tier-label">{t('welcome.supporters.tier.individual')}</p>
              <SupportersMarquee items={activeSupporters} rowCount={1} />
            </Reveal>
          ) : SPONSORS.length > 0 ? null : (
            <Reveal className="supporters-placeholder">
              <span className="supporters-placeholder-ic">
                <IcSparkle size={20} />
              </span>
              <p className="supporters-placeholder-text">{t('welcome.supporters.placeholder')}</p>
            </Reveal>
          )}
        </div>

        <Reveal className="landing-divider" />
      </div>
    </>
  );
}
