import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { useI18n } from '../store/i18n.jsx';
import { api } from '../api.js';
import LangToggle from '../components/LangToggle.jsx';
import Sparkles from '../components/Sparkles.jsx';
import { IcSparkle, IcMousePointer } from '../components/icons.jsx';
import { DEV_TEAM } from '../dev-team-info.js';
import yeahPhoto from '../assets/supporters/yeah.png';
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

// Fades + rises each block in as it crosses into view (replays only once —
// unlike Saved's cards, these are a handful of large landing blocks, not a
// scrolling feed, so a repeat-on-every-pass would read as fidgety rather
// than lively).
function Reveal({ children, delay = 0, className }) {
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

// Small twinkle accent next to the stat number — separate from (and
// independent of) OnboardingTour's own tip-corner sparkles. Uses the shared
// <Sparkles/> component (see components/Sparkles.jsx); History's page-title
// accent reuses the same component with its own point set.
const STAT_SPARKLES = [
  { top: -8, right: -14, delay: 0, size: 16 },
  { bottom: -4, left: -16, delay: 1.1, size: 11 },
];

// No vetted supporter data exists yet — support_proofs (server/src/db.js) is
// self-reported and unapproved, so most entries here still need a name to
// come from you directly before being added. `avatar` is optional — falls
// back to an initials circle (see SupporterChip) if missing or it fails to
// load, same pattern as DevTeamCard.
const SUPPORTERS = [{ name: 'Yeah', avatar: yeahPhoto }];
// Below this count the marquee's loop/scroll would just be one item
// endlessly passing itself — shown as a plain static chip instead (see the
// supporters-static branch below) until there's enough for a real loop.
const MIN_MARQUEE_ITEMS = 3;

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

// Shared by both the scrolling marquee and the static (< MIN_MARQUEE_ITEMS)
// display — same photo-with-initials-fallback pattern as DevTeamCard.
// `vertical` switches to the static (< MIN_MARQUEE_ITEMS) layout: image on
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

// CSS-driven marquee (not Framer Motion) — an infinite linear loop is
// cheaper as a plain animation than as a JS-driven tween, and it's the one
// piece of motion on this page that should never pause between scroll
// passes. Paused via React state (not just CSS :hover) so touch press-and-
// hold also works — iOS Safari doesn't reliably apply :hover/:active from a
// held touch without a touchstart listener already registered on the page.
//
// Loop is seamless by construction, not by resetting scroll position: each
// row's track renders its item list twice back-to-back and animates by
// exactly one set's width (translateX(-50%) — see .supportersMarquee
// keyframes in styles.css), so the frame at the end of the loop is
// pixel-identical to the frame at the start and `infinite` restarts with no
// visible jump.
//
// Speed is a constant (px/second), not a constant duration — a fixed
// duration made rows with fewer/shorter items finish their (shorter) lap
// faster, i.e. visibly faster motion. Each row instead measures its own
// rendered content width and derives its duration from that, so every row
// moves at the same physical speed regardless of item count or name length.
const MARQUEE_PX_PER_SECOND = 40;
const MARQUEE_MIN_SECONDS = 8; // anti-jank floor for a pathologically narrow row, not a pacing target
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

function SupportersRow({ items, reverse, paused }) {
  const track = [...items, ...items];
  const trackRef = useRef(null);
  const [durationSeconds, setDurationSeconds] = useState(MARQUEE_MIN_SECONDS);

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => {
      // scrollWidth spans both duplicated sets (plus the gaps between
      // them); halve it to get one set's actual rendered width, so the
      // duration this produces always maps to the same px/second no matter
      // how many items are in this row or how wide their names render.
      const oneSetWidth = el.scrollWidth / 2;
      setDurationSeconds(Math.max(oneSetWidth / MARQUEE_PX_PER_SECOND, MARQUEE_MIN_SECONDS));
    };
    measure();
    // Re-measure if content width changes after mount (e.g. a webfont
    // swapping in and reflowing the chip text).
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items]);

  return (
    <div className="supporters-marquee">
      <div
        ref={trackRef}
        className={`supporters-track${paused ? ' is-paused' : ''}${reverse ? ' is-reverse' : ''}`}
        style={{ animationDuration: `${durationSeconds}s` }}
      >
        {track.map((s, i) => (
          <span className="supporter-chip glass" key={`${s.name}-${i}`} aria-hidden={i >= items.length}>
            <SupporterChip s={s} />
          </span>
        ))}
      </div>
    </div>
  );
}

// One shared pause state for all rows — hovering/touching anywhere in the
// group pauses every row together, which reads cleaner than each row
// independently starting and stopping as the pointer crosses between them.
function SupportersMarquee({ items }) {
  const [paused, setPaused] = useState(false);
  const rows = splitIntoRows(items, MARQUEE_ROWS);

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
        <SupportersRow key={i} items={row} reverse={i % 2 === 1} paused={paused} />
      ))}
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
  const [userCount, setUserCount] = useState(null);
  const mockSupporterCount = useMockSupporterCountForPreview();
  const activeSupporters =
    mockSupporterCount > 0 ? makeMockSupportersDevOnly(mockSupporterCount) : SUPPORTERS;

  useEffect(() => {
    let cancelled = false;
    api
      .get('/stats', { auth: false })
      .then((data) => {
        if (!cancelled) setUserCount(data.user_count);
      })
      .catch(() => {
        /* public stat, fine to just stay hidden if it fails */
      });
    return () => {
      cancelled = true;
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

      <div className="landing-more">
        <div className="landing-divider" />

        <Reveal className="landing-section">
          <p className="eyebrow">{t('welcome.about.eyebrow')}</p>
          <h2 className="h2">{t('welcome.about.title')}</h2>
          <p className="sub">{t('welcome.about.body')}</p>
        </Reveal>

        <div className="landing-divider" />

        <Reveal className="landing-section" delay={0.06}>
          <p className="eyebrow">{t('welcome.stats.eyebrow')}</p>
          <div className="stat-number-wrap">
            <div className="stat-number">{userCount != null ? `${userCount}+` : '···'}</div>
            <Sparkles points={STAT_SPARKLES} />
          </div>
          <div className="stat-label">{t('welcome.stats.label')}</div>
        </Reveal>

        <div className="landing-divider" />

        {/* Credits the people who built the app — distinct from Supporters
            (people who donated) below, deliberately different heading and a
            plain text list, no card/box and no carousel, so the two never
            read as the same kind of list. */}
        <Reveal className="landing-section" delay={0.12}>
          <p className="eyebrow">{t('welcome.team.eyebrow')}</p>
          <h2 className="h2">{t('welcome.team.title')}</h2>
          <div className="dev-team-list">
            {DEV_TEAM.map((dev) => (
              <DevTeamCard key={dev.nameTh} dev={dev} lang={lang} nav={nav} />
            ))}
          </div>
        </Reveal>

        <div className="landing-divider" />

        <Reveal className="landing-section" delay={0.18}>
          <p className="eyebrow">{t('welcome.supporters.eyebrow')}</p>
          <h2 className="h2">{t('welcome.supporters.title')}</h2>
          <p className="sub">{t('welcome.supporters.body')}</p>
          {activeSupporters.length >= MIN_MARQUEE_ITEMS ? (
            <SupportersMarquee items={activeSupporters} />
          ) : activeSupporters.length > 0 ? (
            // 1-2 real supporters isn't enough for a loop to feel like one
            // (it'd just be the same chip endlessly re-passing itself) —
            // shown stacked (image on top, name below) instead of forcing
            // the marquee, no pill wrapper, matching the plain-list look
            // the rest of this page already uses (About, dev team, etc).
            <div className="supporters-static">
              {activeSupporters.map((s) => (
                <div className="supporter-static-item" key={s.name}>
                  <SupporterChip s={s} vertical />
                </div>
              ))}
            </div>
          ) : (
            <div className="supporters-placeholder">
              <span className="supporters-placeholder-ic">
                <IcSparkle size={20} />
              </span>
              <p className="supporters-placeholder-text">{t('welcome.supporters.placeholder')}</p>
            </div>
          )}
        </Reveal>

        <div className="landing-divider" />
      </div>
    </>
  );
}
