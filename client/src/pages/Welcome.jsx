import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { useI18n } from '../store/i18n.jsx';
import { api } from '../api.js';
import LangToggle from '../components/LangToggle.jsx';
import { IcSparkle } from '../components/icons.jsx';

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
function SupportersMarquee({ items }) {
  const [paused, setPaused] = useState(false);
  const track = [...items, ...items];

  return (
    <div
      className="supporters-marquee"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
      onTouchCancel={() => setPaused(false)}
    >
      <div className={`supporters-track${paused ? ' is-paused' : ''}`}>
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

export default function Welcome() {
  const nav = useNavigate();
  const { t } = useI18n();
  const [userCount, setUserCount] = useState(null);

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
        <Reveal className="glass landing-card">
          <p className="eyebrow">{t('welcome.about.eyebrow')}</p>
          <h2 className="h2">{t('welcome.about.title')}</h2>
          <p className="sub" style={{ marginTop: 8 }}>
            {t('welcome.about.body')}
          </p>
        </Reveal>

        <div className="landing-divider" />

        <Reveal className="stat-card" delay={0.08}>
          <p className="eyebrow">{t('welcome.stats.eyebrow')}</p>
          <div className="stat-number">{userCount != null ? `${userCount}+` : '···'}</div>
          <div className="stat-label">{t('welcome.stats.label')}</div>
        </Reveal>

        <div className="landing-divider" />

        <Reveal className="glass landing-card" delay={0.16}>
          <div className="support-head">
            <span className="support-head-ic">
              <IcSparkle size={18} />
            </span>
            <span className="support-head-title">{t('welcome.supporters.title')}</span>
          </div>
          <p className="sub" style={{ marginBottom: 16 }}>
            {t('welcome.supporters.body')}
          </p>
          {SUPPORTERS.length >= MIN_MARQUEE_ITEMS ? (
            <SupportersMarquee items={SUPPORTERS} />
          ) : (
            <div className="supporters-placeholder">
              <span className="supporters-placeholder-ic">
                <IcSparkle size={20} />
              </span>
              <p className="supporters-placeholder-text">{t('welcome.supporters.placeholder')}</p>
            </div>
          )}
        </Reveal>
      </div>
    </>
  );
}
