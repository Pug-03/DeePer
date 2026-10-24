import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';
import { useToast } from '../components/ui.jsx';
import LangToggle from '../components/LangToggle.jsx';
import OtpInput from '../components/OtpInput.jsx';
import PasswordField from '../components/PasswordField.jsx';
import FieldError, { invalidProps } from '../components/FieldError.jsx';
import PasswordStrength from '../components/PasswordStrength.jsx';
import { pwScore } from '../utils/password.js';
import { IcBack, IcCheck } from '../components/icons.jsx';

export default function ForgotPassword() {
  const nav = useNavigate();
  const { applyAuth } = useAuth();
  const { t } = useI18n();
  const toast = useToast();

  const [step, setStep] = useState('email'); // email | otp | password
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpKey, setOtpKey] = useState(0);
  const [otpStatus, setOtpStatus] = useState('idle'); // idle | error | success
  // The last OTP error, kept under the boxes after the shake until they type
  // again — it used to vanish with the shake, after 0.7s.
  const [otpMsg, setOtpMsg] = useState('');
  const [password, setPassword] = useState('');
  const [emailErr, setEmailErr] = useState('');

  const { rules, score, valid: pwValid } = pwScore(password);

  const requestOtp = async (e) => {
    e.preventDefault();
    setErr('');
    setOtpMsg('');
    // The app's own message instead of the browser's validation bubble.
    if (!email.trim()) return setEmailErr('err.EMAIL_REQUIRED');
    setBusy(true);
    try {
      const d = await api.post('/auth/password-reset/request', { email }, { auth: false });
      setStep('otp');
      setOtp(['', '', '', '', '', '']);
      setOtpKey((k) => k + 1);
      setOtpStatus('idle');
      if (d.dev_code) toast(t('signup.devOtp', { code: d.dev_code }));
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) {
      // Incomplete: flag it (shake + red blink + message) but keep the digits
      // they've typed so far — no clear/remount, just prompt them to finish.
      setErr(t('signup.otpIncomplete'));
      setOtpMsg(t('signup.otpIncomplete'));
      setOtpStatus('error');
      setTimeout(() => {
        setOtpStatus('idle');
        setErr('');
      }, 700);
      return;
    }
    setErr('');
    setBusy(true);
    try {
      await api.post('/auth/password-reset/verify', { email, code }, { auth: false });
      setOtpStatus('success');
      // Wait for the staggered checkmarks to finish before leaving: the last
      // box starts at 3 * 70ms and its spring runs ~0.6s (~810ms total),
      // plus a beat to let it settle.
      setTimeout(() => setStep('password'), 950);
    } catch (e2) {
      setErr(e2);
      setOtpMsg(e2.message);
      setOtpStatus('error');
      setTimeout(() => {
        setOtp(['', '', '', '', '', '']);
        setOtpKey((k) => k + 1);
        setOtpStatus('idle');
        setErr('');
      }, 700);
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
      toast(
        <>
          <IcCheck size={16} /> {t('forgot.success')}
        </>,
      );
      nav('/app/home', { replace: true });
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };

  const back = () => {
    setErr('');
    setOtpStatus('idle');
    setOtpMsg('');
    if (step === 'email') nav('/login');
    else if (step === 'otp') setStep('email');
    else setStep('otp');
  };

  return (
    <div className="page">
      <div className="lang-float">
        <LangToggle />
      </div>

      <button className="link back-btn" style={{ alignSelf: 'flex-start', marginBottom: 18 }} onClick={back}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IcBack size={20} /> {t('common.back')}
        </span>
      </button>

      {err && !(step === 'otp' && otpStatus === 'error') && <ErrorBanner err={err} />}

      {step === 'email' && (
        <form className="stagger" onSubmit={requestOtp} noValidate>
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
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailErr('');
              }}
              autoFocus
              {...invalidProps('email', { email: emailErr })}
            />
            <FieldError id="pf-email-err" msg={emailErr} />
          </div>
          <button className="btn btn--primary" type="submit" disabled={busy}>
            {busy ? t('signup.sendingOtp') : t('signup.sendOtp')}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <form className="stagger" onSubmit={verifyOtp}>
          <div className="header">
            <h1 className="h1">{t('signup.otpTitle')}</h1>
            <p className="sub">
              {t('signup.otpSub')}
              <br />
              <b style={{ color: 'var(--text)' }}>{email}</b>
            </p>
          </div>
          <div className="otp-six" style={{ marginBottom: 24 }}>
            <OtpInput
              key={otpKey}
              value={otp}
              onChange={(i, v) => {
                setOtp((prev) => prev.map((d, idx) => (idx === i ? v : d)));
                setOtpMsg('');
              }}
              status={otpStatus}
              statusText={
                otpStatus === 'error'
                  ? (typeof err === 'string' ? err : err?.message)
                  : otpStatus === 'success'
                    ? t('signup.otpVerified')
                    : otpMsg || t('signup.otpHint')
              }
              statusError={!!otpMsg}
            />
          </div>
          <button
            className="btn btn--primary"
            type="submit"
            disabled={busy || otpStatus !== 'idle'}
          >
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
        <form className="stagger" onSubmit={confirmReset}>
          <div className="header">
            <h1 className="h1">{t('forgot.newPasswordTitle')}</h1>
            <p className="sub">{t('forgot.newPasswordSub')}</p>
          </div>
          <PasswordField
            label={t('forgot.newPassword')}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          >
            <PasswordStrength rules={rules} score={score} />
          </PasswordField>
          <button className="btn btn--primary" type="submit" disabled={busy || !pwValid}>
            {busy ? t('forgot.submitBusy') : t('forgot.submit')}
          </button>
        </form>
      )}
    </div>
  );
}
