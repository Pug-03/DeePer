import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import { useToast } from '../components/ui.jsx';
import GoogleButton from '../components/GoogleButton.jsx';
import LangToggle from '../components/LangToggle.jsx';
import { IcBack, IcGoogle } from '../components/icons.jsx';

export default function Login() {
  const nav = useNavigate();
  const { config, applyAuth } = useAuth();
  const { t } = useI18n();
  const toast = useToast();

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
      applyAuth(d.token, d.user);
      nav('/app/home', { replace: true });
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
        nav('/app/home', { replace: true });
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

      <button className="link" style={{ alignSelf: 'flex-start', marginBottom: 18 }} onClick={() => nav('/')}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IcBack size={18} /> {t('common.back')}
        </span>
      </button>

      <div className="header">
        <h1 className="h1">{t('login.title')}</h1>
        <p className="sub">{t('login.sub')}</p>
      </div>

      {err && <div className="err-inline">{err}</div>}

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
          <button className="method-btn" disabled>
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

      <form onSubmit={submit}>
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
        <div className="field">
          <label>{t('login.password')}</label>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="row-between" style={{ marginBottom: 20 }}>
          <span />
          <button type="button" className="link" onClick={() => toast(t('login.forgotToast'))}>
            {t('login.forgot')}
          </button>
        </div>
        <button className="btn btn--primary" type="submit" disabled={busy}>
          {busy ? t('login.submitBusy') : t('login.submit')}
        </button>
      </form>

      <p className="sub center" style={{ marginTop: 22 }}>
        {t('login.noAccount')}{' '}
        <button className="link" onClick={() => nav('/signup')}>
          {t('welcome.signup')}
        </button>
      </p>
    </div>
  );
}
