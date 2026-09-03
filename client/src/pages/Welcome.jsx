import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../store/i18n.jsx';
import { api } from '../api.js';
import LangToggle from '../components/LangToggle.jsx';
import { IcUser, IcSparkle } from '../components/icons.jsx';

export default function Welcome() {
  const nav = useNavigate();
  const { t } = useI18n();
  const [userCount, setUserCount] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/stats', { auth: false })
      .then((data) => {
        if (!cancelled) setUserCount(data.user_count);
      })
      .catch(() => {
        /* public stat, fine to just stay hidden if it fails */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {/* Pinned to a full viewport regardless of content, so everything
          below (about / stats / supporters) always starts past the fold —
          see .landing-more below for the sibling that follows it. */}
      <div className="page stagger" style={{ minHeight: '100dvh' }}>
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

      <div className="landing-more">
        <div className="glass landing-card">
          <h2 className="h2">{t('welcome.about.title')}</h2>
          <p className="sub" style={{ marginTop: 8 }}>
            {t('welcome.about.body')}
          </p>
        </div>

        <div className="glass landing-card stat-card">
          <div className="support-head-ic" style={{ margin: '0 auto 12px' }}>
            <IcUser size={18} />
          </div>
          <div className="stat-number">{userCount != null ? `${userCount}+` : '···'}</div>
          <div className="stat-label">{t('welcome.stats.label')}</div>
        </div>

        <div className="glass landing-card">
          <div className="support-head">
            <span className="support-head-ic">
              <IcSparkle size={18} />
            </span>
            <span className="support-head-title">{t('welcome.supporters.title')}</span>
          </div>
          <p className="sub" style={{ marginBottom: 16 }}>
            {t('welcome.supporters.body')}
          </p>
          <div className="supporters-placeholder">
            <span className="supporters-placeholder-ic">
              <IcSparkle size={20} />
            </span>
            <p className="supporters-placeholder-text">{t('welcome.supporters.placeholder')}</p>
          </div>
        </div>
      </div>
    </>
  );
}
