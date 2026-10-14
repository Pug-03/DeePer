import { useNavigate, useLocation } from 'react-router-dom';
import { useI18n } from '../store/i18n.jsx';
import { IcBack, IcInstagram, IcTikTok, IcSparkle, IcCards, IcChat } from '../components/icons.jsx';
import { socialLinks } from '../social-info.js';

const ICONS = { instagram: IcInstagram, tiktok: IcTikTok };

export default function Social() {
  const nav = useNavigate();
  const location = useLocation();
  // Opened straight from a link or after a reload there's no app page to
  // go back to, so fall back to the page this one is opened from.
  const goBack = () => (location.key !== 'default' ? nav(-1) : nav('/app/profile', { replace: true }));
  const { t } = useI18n();

  const channels = socialLinks();
  const perks = [
    { Icon: IcSparkle, text: t('social.perkNews') },
    { Icon: IcCards, text: t('social.perkEvents') },
    { Icon: IcChat, text: t('social.perkCommunity') },
  ];

  return (
    <div className="page stagger">
      <button className="link back-btn" style={{ alignSelf: 'flex-start', marginBottom: 18 }} onClick={goBack}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IcBack size={20} /> {t('common.back')}
        </span>
      </button>

      <div className="center header">
        <h1 className="h1">{t('social.title')}</h1>
        <p className="sub">{t('social.msg')}</p>
      </div>

      <div className="glass support-card">
        <ul className="social-perks">
          {perks.map(({ Icon, text }) => (
            <li key={text}>
              <span className="support-head-ic">
                <Icon size={18} />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      {channels.map(({ key, handle, url }, i) => {
        const Icon = ICONS[key];
        return (
          <div key={key} className="glass support-card">
            <div className="support-head">
              <span className="support-head-ic">
                <Icon size={18} />
              </span>
              <span className="support-head-title">{t(`social.${key}`)}</span>
            </div>
            {url && <p className="social-handle">@{handle}</p>}
            <p className="support-proof-desc">{t(`social.${key}Desc`)}</p>
            {url ? (
              // One filled button on the page; the rest outlined.
              <a className={`btn ${i === 0 ? 'btn--primary' : 'btn--ghost'}`} href={url} target="_blank" rel="noopener noreferrer">
                {t('social.follow', { name: t(`social.${key}`) })}
              </a>
            ) : (
              <button className="btn btn--primary" type="button" disabled>
                {t('social.soon')}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
