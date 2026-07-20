import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import { IcCheck } from '../components/icons.jsx';

const EASE = [0.16, 1, 0.3, 1];
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
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="glass glass--red"
        style={{
          width: 84,
          height: 84,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          margin: '0 auto 22px',
          color: 'var(--red-bright)',
        }}
      >
        <IcCheck size={38} />
      </motion.div>

      <motion.h1 className="h1" {...rise(0.15)}>
        {isNew
          ? t('postAuth.newTitle', { name: user.nickname })
          : t('postAuth.backTitle', { name: user.nickname })}
      </motion.h1>

      <motion.p className="sub" style={{ maxWidth: 320, marginInline: 'auto' }} {...rise(0.3)}>
        {isNew ? t('postAuth.newSub') : t('postAuth.backSub')}
      </motion.p>

      <motion.div style={{ marginTop: 36 }} {...rise(0.48)}>
        <p className="sub" style={{ marginBottom: 16 }}>
          {t('postAuth.tutAsk')}
        </p>
        <div className="stack">
          <button className="btn btn--primary" onClick={() => choose(true)}>
            {t('postAuth.tutYes')}
          </button>
          <button className="btn btn--ghost" onClick={() => choose(false)}>
            {t('postAuth.tutNo')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
