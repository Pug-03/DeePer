import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { setAdminToken } from '../admin/adminApi.js';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import GoogleButton from '../components/GoogleButton.jsx';
import LangToggle from '../components/LangToggle.jsx';
import PasswordField from '../components/PasswordField.jsx';
import { IcBack, IcGoogle } from '../components/icons.jsx';

export default function Login() {
  const nav = useNavigate();
  const { config, applyAuth } = useAuth();
  const { t } = useI18n();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const d = await api.post('/auth/login', { email, password }, { auth: false });
      if (d.admin_token) {
        setAdminToken(d.admin_token);
        nav('/admin', { replace: true });
        return;
      }
      applyAuth(d.token, d.user);
      nav('/app/welcome', { replace: true, state: { isNew: false } });
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = useCallback(
    async (credential) => {
      setErr('');
      try {
        const d = await api.post('/auth/google', { credential }, { auth: false });
        if (d.needs_profile) {
          nav('/signup', { state: { google: { credential, ...d } } });
          return;
        }
        applyAuth(d.token, d.user);
        nav('/app/welcome', { replace: true, state: { isNew: false } });
      } catch (e2) {
        setErr(e2.message);
      }
    },
    [applyAuth, nav],
  );

  return (
    <div className="page">
      <div className="lang-float">
        <LangToggle />
      </div>

      <button className="link back-btn" style={{ alignSelf: 'flex-start', marginBottom: 18 }} onClick={() => nav('/')}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IcBack size={20} /> {t('common.back')}
        </span>
      </button>

      {err && <div className="err-inline">{err}</div>}

      {/* one continuous top-to-bottom cascade: title → Google → email → password → button */}
      <form className="stagger" onSubmit={submit}>
        <div className="header">
          <h1 className="h1">{t('login.title')}</h1>
          <p className="sub">{t('login.sub')}</p>
        </div>

        {config.google_enabled ? (
          <>
            <GoogleButton
              clientId={config.google_client_id}
              onCredential={onGoogle}
              label={t('google.loginLabel')}
              sub={t('google.loginSub')}
            />
            <div className="divider">{t('common.or')}</div>
          </>
        ) : (
          <>
            <button type="button" className="method-btn" disabled>
              <span className="m-ic">
                <IcGoogle />
              </span>
              <span>
                <div className="m-title">{t('google.disabledTitle')}</div>
                <div className="m-sub">{t('google.disabledSub')}</div>
              </span>
            </button>
            <div className="divider">{t('login.orEmail')}</div>
          </>
        )}

        <div className="field">
          <label>{t('login.email')}</label>
          <input
            className="input"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <PasswordField
          label={t('login.password')}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <div className="row-between" style={{ marginBottom: 20 }}>
          <span />
          <button type="button" className="link" onClick={() => nav('/forgot-password')}>
            {t('login.forgot')}
          </button>
        </div>
        <button className="btn btn--primary" type="submit" disabled={busy}>
          {busy ? t('login.submitBusy') : t('login.submit')}
        </button>

        <p className="sub center" style={{ marginTop: 22 }}>
          {t('login.noAccount')}{' '}
          <button type="button" className="link" onClick={() => nav('/signup')}>
            {t('welcome.signup')}
          </button>
        </p>
      </form>
    </div>
  );
}
