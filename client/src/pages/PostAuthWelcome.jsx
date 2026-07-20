import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import { IcBook } from '../components/icons.jsx';

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
});

export default function PostAuthWelcome() {
  const nav = useNavigate();
  const loc = useLocation();
  const { user } = useAuth();
  const { t } = useI18n();
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
          ? t('postAuth.newTitle', { name: user.nickname })
          : t('postAuth.backTitle', { name: user.nickname })}
      </motion.h1>

      <motion.p className="sub" style={{ maxWidth: 320, marginInline: 'auto' }} {...rise(1.2)}>
        {isNew ? t('postAuth.newSub') : t('postAuth.backSub')}
      </motion.p>

      <motion.div style={{ marginTop: 36 }} {...rise(1.38)}>
        <p className="sub" style={{ marginBottom: 16 }}>
          {t('postAuth.tutAsk')}
        </p>
        <div className="stack">
          <button className="btn btn--primary" onClick={() => choose(true)}>
            {t('postAuth.tutYes')} <IcBook size={18} />
          </button>
          <button className="btn btn--ghost" onClick={() => choose(false)}>
            {t('postAuth.tutNo')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
