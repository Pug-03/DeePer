import { useNavigate, useLocation } from 'react-router-dom';
import { useI18n } from '../store/i18n.jsx';
import { IcBack } from '../components/icons.jsx';
import { PrivacyPolicyBody } from '../components/PrivacyPolicy.jsx';
import { PRIVACY_POLICY } from '../utils/privacyPolicy.js';

// The privacy policy on its own page — linked from the landing page footer
// and Profile, open to guests and signed-in users alike.
export default function Privacy() {
  const nav = useNavigate();
  const location = useLocation();
  // Opened straight from a link there's no app page to go back to.
  const goBack = () => (location.key !== 'default' ? nav(-1) : nav('/', { replace: true }));
  const { t, lang } = useI18n();
  const p = PRIVACY_POLICY[lang] || PRIVACY_POLICY.th;
  return (
    <div className="page stagger">
      <button className="link back-btn" style={{ alignSelf: 'flex-start', marginBottom: 18 }} onClick={goBack}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IcBack size={20} /> {t('common.back')}
        </span>
      </button>
      <div className="header">
        <h1 className="h1">{p.title}</h1>
      </div>
      <div className="glass privacy-card">
        <PrivacyPolicyBody />
      </div>
    </div>
  );
}
