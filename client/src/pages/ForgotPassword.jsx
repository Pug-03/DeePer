import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import { useToast } from '../components/ui.jsx';
import LangToggle from '../components/LangToggle.jsx';
import OtpInput from '../components/OtpInput.jsx';
import PasswordStrength from '../components/PasswordStrength.jsx';
import { pwScore } from '../utils/password.js';
import { IcBack } from '../components/icons.jsx';

export default function ForgotPassword() {
  const nav = useNavigate();
  const { applyAuth } = useAuth();
  const { t } = useI18n();
  const toast = useToast();

  const [step, setStep] = useState('email'); // email | otp | password
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [otpKey, setOtpKey] = useState(0);
  const [password, setPassword] = useState('');

  const { rules, score, valid: pwValid } = pwScore(password);

  const requestOtp = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const d = await api.post('/auth/password-reset/request', { email }, { auth: false });
      setStep('otp');
      setOtp(['', '', '', '']);
      setOtpKey((k) => k + 1);
      if (d.dev_code) toast(t('signup.devOtp', { code: d.dev_code }));
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== 4) return;
    setErr('');
    setBusy(true);
    try {
      await api.post('/auth/password-reset/verify', { email, code }, { auth: false });
      setStep('password');
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmReset = async (e) => {
    e.preventDefault();
    setErr('');
    if (!pwValid) return setErr(t('signup.pwNotValid'));
    setBusy(true);
    try {
      const d = await api.post(
        '/auth/password-reset/confirm',
        { email, code: otp.join(''), password },
        { auth: false },
      );
      applyAuth(d.token, d.user);
      toast(t('forgot.success'));
      nav('/app/home', { replace: true });
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const back = () => {
    setErr('');
    if (step === 'email') nav('/login');
    else if (step === 'otp') setStep('email');
    else setStep('otp');
  };

  return (
    <div className="page">
      <div className="lang-float">
        <LangToggle />
      </div>

      <button className="link" style={{ alignSelf: 'flex-start', marginBottom: 18 }} onClick={back}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IcBack size={18} /> {t('common.back')}
        </span>
      </button>

      {err && <div className="err-inline">{err}</div>}

      {step === 'email' && (
        <form className="fade-up" onSubmit={requestOtp}>
          <div className="header">
            <h1 className="h1">{t('forgot.title')}</h1>
            <p className="sub">{t('forgot.emailSub')}</p>
          </div>
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
              autoFocus
            />
          </div>
          <button className="btn btn--primary" type="submit" disabled={busy}>
            {busy ? t('signup.sendingOtp') : t('signup.sendOtp')}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <form className="fade-up" onSubmit={verifyOtp}>
          <div className="header">
            <h1 className="h1">{t('signup.otpTitle')}</h1>
            <p className="sub">
              {t('signup.otpSub')}
              <br />
              <b style={{ color: 'var(--text)' }}>{email}</b>
            </p>
          </div>
          <div style={{ marginBottom: 24 }}>
            <OtpInput
              key={otpKey}
              value={otp}
              onChange={(i, v) => setOtp((prev) => prev.map((d, idx) => (idx === i ? v : d)))}
            />
          </div>
          <button className="btn btn--primary" type="submit" disabled={busy || otp.join('').length !== 4}>
            {busy ? t('signup.verifying') : t('signup.verify')}
          </button>
          <button
            type="button"
            className="link center"
            style={{ marginTop: 16, width: '100%' }}
            onClick={requestOtp}
          >
            {t('signup.resend')}
          </button>
        </form>
      )}

      {step === 'password' && (
        <form className="fade-up" onSubmit={confirmReset}>
          <div className="header">
            <h1 className="h1">{t('forgot.newPasswordTitle')}</h1>
            <p className="sub">{t('forgot.newPasswordSub')}</p>
          </div>
          <div className="field">
            <label>{t('forgot.newPassword')}</label>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            <PasswordStrength rules={rules} score={score} />
          </div>
          <button className="btn btn--primary" type="submit" disabled={busy || !pwValid}>
            {busy ? t('forgot.submitBusy') : t('forgot.submit')}
          </button>
        </form>
      )}
    </div>
  );
}
