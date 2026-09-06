import { useNavigate } from 'react-router-dom';
import { useI18n } from '../store/i18n.jsx';
import { IcBack, IcMail, IcGithub, IcSparkle } from '../components/icons.jsx';

const CONTACT_EMAIL = 'ftxz12789@gmail.com';
const CONTACT_GITHUB = 'https://github.com/Pug-03';

// No real achievements to list yet — see Awards.jsx for the same page
// structure with a filled-in list. Honest empty state instead of
// placeholder/fake entries; fill this in the same way once she has some.
export default function AwardsNatsha() {
  const nav = useNavigate();
  const { t } = useI18n();

  return (
    <div className="page stagger">
      <button
        className="link"
        style={{ alignSelf: 'flex-start', marginBottom: 18 }}
        onClick={() => nav('/')}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IcBack size={18} /> {t('common.back')}
        </span>
      </button>

      <div className="header" style={{ marginBottom: 20 }}>
        <h1 className="h1">{t('awards.title')}</h1>
      </div>

      <div className="supporters-placeholder">
        <span className="supporters-placeholder-ic">
          <IcSparkle size={20} />
        </span>
        <p className="supporters-placeholder-text">{t('awards.empty')}</p>
      </div>

      <div className="award-contact">
        <p className="eyebrow">{t('awards.contactTitle')}</p>
        <a className="link award-contact-row" href={`mailto:${CONTACT_EMAIL}`}>
          <IcMail size={18} /> {CONTACT_EMAIL}
        </a>
        <a
          className="link award-contact-row"
          href={CONTACT_GITHUB}
          target="_blank"
          rel="noopener noreferrer"
        >
          <IcGithub size={18} /> {CONTACT_GITHUB.replace(/^https?:\/\//, '')}
        </a>
      </div>
    </div>
  );
}
