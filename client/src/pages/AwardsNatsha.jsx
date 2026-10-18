import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useI18n } from '../store/i18n.jsx';
import { ContactReveal, ContactLink } from '../components/ContactReveal.jsx';
import DevProfile from '../components/DevProfile.jsx';
import { IcBack, IcMail } from '../components/icons.jsx';

const CONTACT_EMAIL = 'natsha.nampan@gmail.com';

// Real, fixed content, same shape and rendering as Awards.jsx's list.
const AWARDS = [
  {
    name: 'U-Hackathon 2026',
    result: 'Participant',
  },
];

export default function AwardsNatsha() {
  const nav = useNavigate();
  // Back returns to the landing page where the visitor left it (scroll
  // kept by ScrollToTop); opened directly, it just goes home.
  const location = useLocation();
  const { t } = useI18n();
  // Contact comes in last, once the last entry has risen in.
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

      <div className="award-list stagger">
        {AWARDS.map((a, i) => (
          <div
            className="award-entry"
            key={a.name}
            // After the profile header has played in (see .dev-profile).
            style={{ animationDelay: `${0.95 + i * 0.12}s` }}
            onAnimationEnd={i === AWARDS.length - 1 ? () => setShown(true) : undefined}
          >
            <p className="award-name">{a.name}</p>
            <p className="award-result">{a.result}</p>
          </div>
        ))}
      </div>

      <ContactReveal title={t('awards.contactTitle')} ready={shown}>
        <ContactLink href={`mailto:${CONTACT_EMAIL}`}>
          <IcMail size={18} /> {CONTACT_EMAIL}
        </ContactLink>
      </ContactReveal>
    </div>
  );
}
