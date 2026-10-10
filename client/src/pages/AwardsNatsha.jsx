import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useI18n } from '../store/i18n.jsx';
import { ContactReveal, ContactLink } from '../components/ContactReveal.jsx';
import DevProfile from '../components/DevProfile.jsx';
import { IcBack, IcMail, IcSparkle } from '../components/icons.jsx';

const CONTACT_EMAIL = 'natsha.nampan@gmail.com';

// No real achievements to list yet — see Awards.jsx for the same page
// structure with a filled-in list. Honest empty state instead of
// placeholder/fake entries; fill this in the same way once she has some.
export default function AwardsNatsha() {
  const nav = useNavigate();
  // Back returns to the landing page where the visitor left it (scroll
  // kept by ScrollToTop); opened directly, it just goes home.
  const location = useLocation();
  const { t } = useI18n();
  // Contact comes in last, once the empty-state note has risen in.
  const [shown, setShown] = useState(false);

  return (
    <div className="page stagger profile-page">
      <button
        className="link back-btn"
        style={{ alignSelf: 'flex-start', marginBottom: 18 }}
        onClick={() => (location.key !== 'default' ? nav(-1) : nav('/'))}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IcBack size={20} /> {t('common.back')}
        </span>
      </button>

      <DevProfile href="/awards/natsha" />

      <div className="header" style={{ marginBottom: 20 }}>
        <h2 className="h1">{t('awards.title')}</h2>
      </div>

      <div className="supporters-placeholder" onAnimationEnd={() => setShown(true)}>
        <span className="supporters-placeholder-ic">
          <IcSparkle size={20} />
        </span>
        <p className="supporters-placeholder-text">{t('awards.empty')}</p>
      </div>

      <ContactReveal title={t('awards.contactTitle')} ready={shown}>
        <ContactLink href={`mailto:${CONTACT_EMAIL}`}>
          <IcMail size={18} /> {CONTACT_EMAIL}
        </ContactLink>
      </ContactReveal>
    </div>
  );
}
