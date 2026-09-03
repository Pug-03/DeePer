import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { useI18n } from '../store/i18n.jsx';
import { api } from '../api.js';
import LangToggle from '../components/LangToggle.jsx';
import { IcSparkle } from '../components/icons.jsx';
// `import.meta.env.DEV` below is a compile-time constant, so Vite's
// production build dead-code-eliminates the branch that reads this import —
// this fixture (and its placeholder strings) never reaches the shipped
// bundle. See client/src/dev/mockSupporters.js for the full explanation.
import { makeMockSupportersDevOnly } from '../dev/mockSupporters.js';

// Same easing the rest of the app's motion uses (page-load stagger, Saved's
// scroll-pop, HomeTutorial, PostAuthWelcome) — kept identical here so the
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

// No vetted supporter data exists yet — support_proofs (server/src/db.js) is
// self-reported and unapproved, so it isn't safe to surface publicly as-is.
// Once there's a reviewed list, drop entries in here as { name }; the
// carousel switches on automatically at MIN_MARQUEE_ITEMS and falls back to
// the static placeholder below it until then.
const SUPPORTERS = [];
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
const MARQUEE_SECONDS_PER_ITEM = 2.4;
const MARQUEE_MIN_SECONDS = 14;
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
  // Duration scales with this row's own item count so the read pace per
  // item stays the same slow, easy-to-read speed regardless of how many
  // rows the items got split into, or how uneven that split ended up.
  const durationSeconds = Math.max(items.length * MARQUEE_SECONDS_PER_ITEM, MARQUEE_MIN_SECONDS);

  return (
    <div className="supporters-marquee">
      <div
        className={`supporters-track${paused ? ' is-paused' : ''}${reverse ? ' is-reverse' : ''}`}
        style={{ animationDuration: `${durationSeconds}s` }}
      >
        {track.map((s, i) => (
          <span className="supporter-chip glass" key={`${s.name}-${i}`} aria-hidden={i >= items.length}>
            <span className="supporter-avatar">{initials(s.name)}</span>
            <span className="supporter-name">{s.name}</span>
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

export default function Welcome() {
  const nav = useNavigate();
  const { t } = useI18n();
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

        <Reveal className="landing-section" delay={0.08}>
          <p className="eyebrow">{t('welcome.stats.eyebrow')}</p>
          <div className="stat-number">{userCount != null ? `${userCount}+` : '···'}</div>
          <div className="stat-label">{t('welcome.stats.label')}</div>
        </Reveal>

        <div className="landing-divider" />

        <Reveal className="landing-section" delay={0.16}>
          <p className="eyebrow">{t('welcome.supporters.eyebrow')}</p>
          <h2 className="h2">{t('welcome.supporters.title')}</h2>
          <p className="sub">{t('welcome.supporters.body')}</p>
          {activeSupporters.length >= MIN_MARQUEE_ITEMS ? (
            <SupportersMarquee items={activeSupporters} />
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
