import { useNavigate } from 'react-router-dom';
import { useI18n } from '../store/i18n.jsx';
import LangToggle from '../components/LangToggle.jsx';

export default function Welcome() {
  const nav = useNavigate();
  const { t } = useI18n();
  return (
    <div className="page stagger">
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
  );
}
