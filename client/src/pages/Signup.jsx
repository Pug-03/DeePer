import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import { useToast } from '../components/ui.jsx';
import GoogleButton from '../components/GoogleButton.jsx';
import LangToggle from '../components/LangToggle.jsx';
import OtpInput from '../components/OtpInput.jsx';
import PasswordField from '../components/PasswordField.jsx';
import PasswordStrength from '../components/PasswordStrength.jsx';
import { pwScore } from '../utils/password.js';
import { AVATAR_MAX_BYTES, AVATAR_TYPES } from '../utils/avatar.js';
import { IcBack, IcCamera, IcGoogle, IcMail } from '../components/icons.jsx';

const GENDER_VALUES = ['female', 'male', 'other', 'prefer_not'];

function ProfileFields({
  nickname,
  setNickname,
  age,
  setAge,
  gender,
  setGender,
  avatarPreview,
  onPickAvatar,
  onAvatarChange,
  avatarInputRef,
}) {
  const { t } = useI18n();
  return (
    <>
      <div className="center" style={{ marginBottom: 18 }}>
        <button
          type="button"
          className="avatar-picker"
          onClick={onPickAvatar}
          style={avatarPreview ? { backgroundImage: `url(${avatarPreview})` } : undefined}
          aria-label={t('signup.addPhoto')}
        >
          {!avatarPreview && <IcCamera size={24} />}
        </button>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={onAvatarChange}
        />
        <p className="faint" style={{ marginTop: 8, fontSize: 13 }}>
          {t('signup.addPhoto')}
        </p>
      </div>
      <div className="field">
        <label>{t('signup.nickname')}</label>
        <input
          className="input"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder={t('signup.nicknamePh')}
          maxLength={40}
          required
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
          required
        />
      </div>
      <div className="field">
        <label>{t('signup.gender')}</label>
        <select
          className="select"
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          required
        >
          <option value="" disabled>
            {t('signup.genderPh')}
          </option>
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
  const { config, applyAuth, setUser } = useAuth();
  const { t } = useI18n();
  const toast = useToast();

  const [step, setStep] = useState('method'); // method | email | otp | profile | gprofile
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [email, setEmail] = useState('');
  const emailRef = useRef(null);
  const [otp, setOtp] = useState(['', '', '', '']);
  const [otpKey, setOtpKey] = useState(0);
  const [otpStatus, setOtpStatus] = useState('idle'); // idle | error | success

  const [nickname, setNickname] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [password, setPassword] = useState('');

  const [gCredential, setGCredential] = useState(null);

  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const avatarInputRef = useRef(null);

  const onPickAvatar = () => avatarInputRef.current?.click();

  const onAvatarChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) return toast(t('err.AVATAR_TYPE_INVALID'));
    if (file.size > AVATAR_MAX_BYTES) return toast(t('err.AVATAR_TOO_LARGE'));
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  // Best-effort: the account already exists by this point, so a failed
  // avatar upload shouldn't block finishing signup.
  const uploadAvatarIfAny = async () => {
    if (!avatarFile) return;
    try {
      const form = new FormData();
      form.append('avatar', avatarFile);
      const d = await api.upload('/auth/me/avatar', form);
      setUser(d.user);
    } catch {
      /* ignore — user can set a photo later from their profile */
    }
  };

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
      setOtpStatus('idle');
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
    if (code.length !== 4) {
      // Incomplete: flag it (shake + red blink + message) but keep the digits
      // they've typed so far — no clear/remount, just prompt them to finish.
      setErr(t('signup.otpIncomplete'));
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
      await api.post('/auth/otp/verify', { email, code }, { auth: false });
      setOtpStatus('success');
      // Wait for the staggered checkmarks to finish before leaving: the last
      // box starts at 3 * 180ms and its spring runs ~0.6s (~1140ms total),
      // plus a beat to let it settle.
      setTimeout(() => setStep('profile'), 1300);
    } catch (e2) {
      setErr(e2.message);
      setOtpStatus('error');
      setTimeout(() => {
        setOtp(['', '', '', '']);
        setOtpKey((k) => k + 1);
        setOtpStatus('idle');
        setErr('');
      }, 700);
    } finally {
      setBusy(false);
    }
  };

  const registerEmail = async (e) => {
    e.preventDefault();
    setErr('');
    if (!nickname.trim()) return setErr(t('signup.needNickname'));
    if (!age) return setErr(t('signup.needAge'));
    if (!gender) return setErr(t('signup.needGender'));
    if (!pwValid) return setErr(t('signup.pwNotValid'));
    setBusy(true);
    try {
      const d = await api.post(
        '/auth/register',
        { email, code: otp.join(''), nickname, age, gender, password },
        { auth: false },
      );
      applyAuth(d.token, d.user);
      await uploadAvatarIfAny();
      nav('/app/welcome', { replace: true, state: { isNew: true } });
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
        nav('/app/welcome', { replace: true, state: { isNew: false } });
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
    if (!age) return setErr(t('signup.needAge'));
    if (!gender) return setErr(t('signup.needGender'));
    setBusy(true);
    try {
      const d = await api.post(
        '/auth/google',
        { credential: gCredential, nickname, age, gender },
        { auth: false },
      );
      applyAuth(d.token, d.user);
      await uploadAvatarIfAny();
      nav('/app/welcome', { replace: true, state: { isNew: true } });
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const back = () => {
    setErr('');
    setOtpStatus('idle');
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

      {err && !(step === 'otp' && otpStatus === 'error') && <div className="err-inline">{err}</div>}

      {/* Step: choose method */}
      {step === 'method' && (
        <div className="stagger">
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
        <form className="stagger" onSubmit={requestOtp}>
          <div className="header">
            <h1 className="h1">{t('signup.emailTitle')}</h1>
            <p className="sub">{t('signup.emailSub')}</p>
          </div>
          {/* Focus only once the entrance animation settles: autoFocus during
              the staggerRise transform would drag the text caret up from below
              with the field. */}
          <div className="field" onAnimationEnd={() => emailRef.current?.focus()}>
            <label>{t('login.email')}</label>
            <input
              ref={emailRef}
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
          <button className="btn btn--primary" type="submit" disabled={busy}>
            {busy ? t('signup.sendingOtp') : t('signup.sendOtp')}
          </button>
        </form>
      )}

      {/* Step: OTP */}
      {step === 'otp' && (
        <form className="stagger" onSubmit={verifyOtp}>
          <div className="header">
            <p className="eyebrow">{t('signup.otpEyebrow')}</p>
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
              status={otpStatus}
              statusText={
                otpStatus === 'error' ? err : otpStatus === 'success' ? t('signup.otpVerified') : t('signup.otpHint')
              }
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

      {/* Step: profile + password (email flow) */}
      {step === 'profile' && (
        <form className="stagger" onSubmit={registerEmail}>
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
            avatarPreview={avatarPreview}
            onPickAvatar={onPickAvatar}
            onAvatarChange={onAvatarChange}
            avatarInputRef={avatarInputRef}
          />
          <PasswordField
            label={t('signup.setPassword')}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          >
            <PasswordStrength rules={rules} score={score} />
          </PasswordField>
          <button className="btn btn--primary" type="submit" disabled={busy || !pwValid}>
            {busy ? t('signup.submitBusy') : t('signup.submit')}
          </button>
        </form>
      )}

      {/* Step: Google profile completion */}
      {step === 'gprofile' && (
        <form className="stagger" onSubmit={registerGoogle}>
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
            avatarPreview={avatarPreview}
            onPickAvatar={onPickAvatar}
            onAvatarChange={onAvatarChange}
            avatarInputRef={avatarInputRef}
          />
          <button className="btn btn--primary" type="submit" disabled={busy}>
            {busy ? t('signup.submitBusy') : t('signup.start')}
          </button>
        </form>
      )}
    </div>
  );
}
