import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { setAdminToken } from '../admin/adminApi.js';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';
import GoogleButton from '../components/GoogleButton.jsx';
import LangToggle from '../components/LangToggle.jsx';
import LaunchNotice from '../components/LaunchNotice.jsx';
import PasswordField from '../components/PasswordField.jsx';
import FieldError, { invalidProps } from '../components/FieldError.jsx';
import { IcBack, IcGoogle } from '../components/icons.jsx';

export default function Login() {
  const nav = useNavigate();
  const { config, applyAuth } = useAuth();
  const { t } = useI18n();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // Messages under the fields (i18n keys) — the app's own instead of the
  // browser's white bubble, and a wrong password shows by the password box
  // instead of a banner that pushed the whole form down.
  const [fieldErr, setFieldErr] = useState({});

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    const errs = {};
    if (!email.trim()) errs.email = 'err.EMAIL_REQUIRED';
    if (!password) errs.password = 'err.PASSWORD_REQUIRED';
    setFieldErr(errs);
    if (Object.keys(errs).length) return;
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
      const code = e2.data?.error_code;
      if (code === 'LOGIN_INVALID') setFieldErr({ password: 'err.LOGIN_INVALID' });
      else if (code === 'INVALID_EMAIL') setFieldErr({ email: 'err.INVALID_EMAIL' });
      else setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = useCallback(
    async (credential) => {
      setErr('');
      try {
        const d = await api.post('/auth/google', { credential }, { auth: false });
        if (d.admin_token) {
          setAdminToken(d.admin_token);
          nav('/admin', { replace: true });
          return;
        }
        if (d.needs_profile) {
          nav('/signup', { state: { google: { credential, ...d } } });
          return;
        }
        applyAuth(d.token, d.user);
        nav('/app/welcome', { replace: true, state: { isNew: false } });
      } catch (e2) {
        setErr(e2);
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

      <ErrorBanner err={err} />

      {/* one continuous top-to-bottom cascade: title → Google → email → password → button */}
      <form className="stagger" onSubmit={submit} noValidate>
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
            onChange={(e) => {
              setEmail(e.target.value);
              setFieldErr((c) => ({ ...c, email: undefined }));
            }}
            {...invalidProps('email', fieldErr)}
          />
          <FieldError id="pf-email-err" msg={fieldErr.email} />
        </div>
        <PasswordField
          label={t('login.password')}
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setFieldErr((c) => ({ ...c, password: undefined }));
          }}
          invalid={!!fieldErr.password}
          errorId="pf-password-err"
        >
          <FieldError id="pf-password-err" msg={fieldErr.password} />
        </PasswordField>
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

      <LaunchNotice t={t} />
    </div>
  );
}
