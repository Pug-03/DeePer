import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import { useToast } from '../components/ui.jsx';
import GoogleButton from '../components/GoogleButton.jsx';
import LangToggle from '../components/LangToggle.jsx';
import OtpInput from '../components/OtpInput.jsx';
import PasswordStrength from '../components/PasswordStrength.jsx';
import { pwScore } from '../utils/password.js';
import { IcBack, IcGoogle, IcMail } from '../components/icons.jsx';

const GENDER_VALUES = ['female', 'male', 'other', 'prefer_not'];

function ProfileFields({ nickname, setNickname, age, setAge, gender, setGender }) {
  const { t } = useI18n();
  return (
    <>
      <div className="field">
        <label>{t('signup.nickname')}</label>
        <input
          className="input"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder={t('signup.nicknamePh')}
          maxLength={40}
        />
      </div>
      <div className="field">
        <label>{t('signup.age')}</label>
        <input
          className="input"
          type="number"
          inputMode="numeric"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          placeholder={t('signup.agePh')}
          min={1}
          max={120}
        />
      </div>
      <div className="field">
        <label>{t('signup.gender')}</label>
        <select className="select" value={gender} onChange={(e) => setGender(e.target.value)}>
          <option value="">{t('signup.genderPh')}</option>
          {GENDER_VALUES.map((g) => (
            <option key={g} value={g}>
              {t(`gender.${g}`)}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

export default function Signup() {
  const nav = useNavigate();
  const loc = useLocation();
  const { config, applyAuth } = useAuth();
  const { t } = useI18n();
  const toast = useToast();

  const [step, setStep] = useState('method'); // method | email | otp | profile | gprofile
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [otpKey, setOtpKey] = useState(0);

  const [nickname, setNickname] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [password, setPassword] = useState('');

  const [gCredential, setGCredential] = useState(null);

  useEffect(() => {
    const g = loc.state?.google;
    if (g?.credential) {
      setGCredential(g.credential);
      if (g.suggested_nickname) setNickname(g.suggested_nickname);
      setStep('gprofile');
    }
  }, [loc.state]);

  const { rules, score, valid: pwValid } = pwScore(password);

  const requestOtp = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const d = await api.post('/auth/otp/request', { email }, { auth: false });
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
      await api.post('/auth/otp/verify', { email, code }, { auth: false });
      setStep('profile');
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const registerEmail = async (e) => {
    e.preventDefault();
    setErr('');
    if (!nickname.trim()) return setErr(t('signup.needNickname'));
    if (!pwValid) return setErr(t('signup.pwNotValid'));
    setBusy(true);
    try {
      const d = await api.post(
        '/auth/register',
        { email, code: otp.join(''), nickname, age, gender, password },
        { auth: false },
      );
      applyAuth(d.token, d.user);
      nav('/app/home', { replace: true });
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const onGoogleCredential = useCallback(
    async (credential) => {
      setErr('');
      try {
        const d = await api.post('/auth/google', { credential }, { auth: false });
        if (d.needs_profile) {
          setGCredential(credential);
          if (d.suggested_nickname) setNickname(d.suggested_nickname);
          setStep('gprofile');
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

  const registerGoogle = async (e) => {
    e.preventDefault();
    setErr('');
    if (!nickname.trim()) return setErr(t('signup.needNickname'));
    setBusy(true);
    try {
      const d = await api.post(
        '/auth/google',
        { credential: gCredential, nickname, age, gender },
        { auth: false },
      );
      applyAuth(d.token, d.user);
      nav('/app/home', { replace: true });
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const back = () => {
    setErr('');
    if (step === 'method') nav('/');
    else if (step === 'otp') setStep('email');
    else if (step === 'profile') setStep('otp');
    else if (step === 'gprofile') setStep('method');
    else setStep('method');
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

      {/* Step: choose method */}
      {step === 'method' && (
        <div className="fade-up">
          <div className="header">
            <h1 className="h1">{t('signup.title')}</h1>
            <p className="sub">{t('signup.sub')}</p>
          </div>

          {config.google_enabled ? (
            <div style={{ marginBottom: 14 }}>
              <GoogleButton
                clientId={config.google_client_id}
                onCredential={onGoogleCredential}
                label={t('google.signupLabel')}
                sub={t('google.signupSub')}
              />
            </div>
          ) : (
            <button className="method-btn" style={{ marginBottom: 14 }} disabled>
              <span className="m-ic">
                <IcGoogle />
              </span>
              <span>
                <div className="m-title">{t('google.signupLabel')}</div>
                <div className="m-sub">{t('google.disabledSub')}</div>
              </span>
            </button>
          )}

          <button className="method-btn" onClick={() => setStep('email')}>
            <span className="m-ic">
              <IcMail size={22} />
            </span>
            <span>
              <div className="m-title">{t('signup.emailMethod')}</div>
              <div className="m-sub">{t('signup.emailMethodSub')}</div>
            </span>
          </button>

          <p className="google-note" style={{ marginTop: 18 }}>
            {t('signup.googleNote')}
          </p>
        </div>
      )}

      {/* Step: email entry */}
      {step === 'email' && (
        <form className="fade-up" onSubmit={requestOtp}>
          <div className="header">
            <h1 className="h1">{t('signup.emailTitle')}</h1>
            <p className="sub">{t('signup.emailSub')}</p>
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

      {/* Step: OTP */}
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

      {/* Step: profile + password (email flow) */}
      {step === 'profile' && (
        <form className="fade-up" onSubmit={registerEmail}>
          <div className="header">
            <h1 className="h1">{t('signup.profileTitle')}</h1>
            <p className="sub">{t('signup.profileSub')}</p>
          </div>
          <ProfileFields
            nickname={nickname}
            setNickname={setNickname}
            age={age}
            setAge={setAge}
            gender={gender}
            setGender={setGender}
          />
          <div className="field">
            <label>{t('signup.setPassword')}</label>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <PasswordStrength rules={rules} score={score} />
          </div>
          <button className="btn btn--primary" type="submit" disabled={busy || !pwValid}>
            {busy ? t('signup.submitBusy') : t('signup.submit')}
          </button>
        </form>
      )}

      {/* Step: Google profile completion */}
      {step === 'gprofile' && (
        <form className="fade-up" onSubmit={registerGoogle}>
          <div className="header">
            <h1 className="h1">{t('signup.profileTitle')}</h1>
            <p className="sub">{t('signup.gprofileSub')}</p>
          </div>
          <ProfileFields
            nickname={nickname}
            setNickname={setNickname}
            age={age}
            setAge={setAge}
            gender={gender}
            setGender={setGender}
          />
          <button className="btn btn--primary" type="submit" disabled={busy}>
            {busy ? t('signup.submitBusy') : t('signup.start')}
          </button>
        </form>
      )}
    </div>
  );
}
