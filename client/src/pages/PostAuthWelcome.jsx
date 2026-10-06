import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import CheckBadge, { rise } from '../components/CheckBadge.jsx';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import { useTutorial } from '../store/tutorial.jsx';
import { displayName } from '../util.js';
import { IcInstagram, IcTikTok } from '../components/icons.jsx';
import { socialLinks } from '../social-info.js';

const SOCIAL_ICONS = { instagram: IcInstagram, tiktok: IcTikTok };

export default function PostAuthWelcome() {
  const nav = useNavigate();
  const tutorial = useTutorial();
  const loc = useLocation();
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const isNew = !!loc.state?.isNew;

  if (!user) return <Navigate to="/app/home" replace />;

  const choose = (wantTutorial) => {
    // Starting the tour here (not flagging it for Home) means Home opens
    // already dimmed under the tour instead of flashing in plain first.
    localStorage.removeItem('dt_tutorial_pending');
    if (wantTutorial) tutorial.start();
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

      {/* Small follow-us nudge; a channel without a handle yet shows dimmed
          and isn't clickable. */}
      <motion.div className="postauth-social" {...rise(1.83)}>
        <span>{t('postAuth.follow')}</span>
        {socialLinks().map(({ key, url }) => {
          const Icon = SOCIAL_ICONS[key];
          return url ? (
            <a
              key={key}
              className="postauth-social-link"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t(`social.${key}`)}
            >
              <Icon size={17} />
            </a>
          ) : (
            <span
              key={key}
              className="postauth-social-link postauth-social-link--soon"
              title={`${t(`social.${key}`)} · ${t('social.soon')}`}
            >
              <Icon size={17} />
            </span>
          );
        })}
      </motion.div>
    </div>
  );
}
