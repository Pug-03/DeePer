import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import { displayName } from '../util.js';

const EASE = [0.16, 1, 0.3, 1];
const CIRCLE_DURATION = 0.9;
const CHECK_DELAY = 0.75;
const CHECK_DURATION = 0.5;

function CheckBadge() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="glass glass--red"
      style={{
        width: 128,
        height: 128,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        margin: '0 auto 24px',
        color: 'var(--red-bright)',
      }}
    >
      <svg width={92} height={92} viewBox="0 0 84 84" fill="none">
        <motion.circle
          cx="42"
          cy="42"
          r="34"
          stroke="currentColor"
          strokeWidth={4}
          strokeLinecap="round"
          transform="rotate(-90 42 42)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: CIRCLE_DURATION, ease: 'easeInOut' }}
        />
        {/* checkmark strokes bottom-vertex last, reading as a rise from bottom to top */}
        <motion.path
          d="M25 44 37 56 60 27"
          stroke="currentColor"
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: CHECK_DURATION, delay: CHECK_DELAY, ease: 'easeInOut' }}
        />
      </svg>
    </motion.div>
  );
}

const rise = (delay) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: EASE },
  // A no-op onUpdate forces this off Framer's hardware-accelerated (WAAPI)
  // animation path onto its main-thread one — WAAPI hands off to a plain
  // inline style right as a delayed opacity+transform tween completes, and
  // that handoff drops one frame back to the pre-animation value, flashing.
  onUpdate: () => {},
});

export default function PostAuthWelcome() {
  const nav = useNavigate();
  const loc = useLocation();
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const isNew = !!loc.state?.isNew;

  if (!user) return <Navigate to="/app/home" replace />;

  const choose = (wantTutorial) => {
    if (wantTutorial) localStorage.setItem('dt_tutorial_pending', '1');
    else localStorage.removeItem('dt_tutorial_pending');
    nav('/app/home', { replace: true });
  };

  return (
    <div className="page center" style={{ justifyContent: 'center', flex: 1 }}>
      <CheckBadge />

      <motion.h1 className="h1" {...rise(1.05)}>
        {isNew
          ? t('postAuth.newTitle', { name: displayName(user, lang) })
          : t('postAuth.backTitle', { name: displayName(user, lang) })}
      </motion.h1>

      <motion.p className="sub" style={{ maxWidth: 320, marginInline: 'auto' }} {...rise(1.2)}>
        {isNew ? t('postAuth.newSub') : t('postAuth.backSub')}
      </motion.p>

      <div style={{ marginTop: 36 }}>
        <motion.p className="sub" style={{ marginBottom: 16 }} {...rise(1.38)}>
          {t('postAuth.tutAsk')}
        </motion.p>
        <div className="stack">
          {/* Rise-in animates opacity/transform on a plain wrapper, not the
              button itself — .btn has its own CSS transition on those same
              properties (for the press/disabled states) that would otherwise
              race Framer Motion's per-frame animation and make it stutter. */}
          <motion.div {...rise(1.53)}>
            <button className="btn btn--primary" onClick={() => choose(true)}>
              {t('postAuth.tutYes')}
            </button>
          </motion.div>
          <motion.div {...rise(1.68)}>
            <button className="btn btn--ghost" onClick={() => choose(false)}>
              {t('postAuth.tutNo')}
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
