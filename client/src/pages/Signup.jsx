import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { setAdminToken } from '../admin/adminApi.js';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import { useToast } from '../components/ui.jsx';
import GoogleButton from '../components/GoogleButton.jsx';
import LangToggle from '../components/LangToggle.jsx';
import LaunchNotice from '../components/LaunchNotice.jsx';
import OtpInput from '../components/OtpInput.jsx';
import PasswordField from '../components/PasswordField.jsx';
import PasswordStrength from '../components/PasswordStrength.jsx';
import { pwScore } from '../utils/password.js';
import { AVATAR_MAX_BYTES, AVATAR_TYPES } from '../utils/avatar.js';
import { IcBack, IcCamera, IcGoogle, IcMail } from '../components/icons.jsx';
import { nicknameError } from '../util.js';
import FieldError, { invalidProps } from '../components/FieldError.jsx';
import { PrivacySheet } from '../components/PrivacyPolicy.jsx';

const GENDER_VALUES = ['female', 'male', 'other', 'prefer_not'];

function ProfileFields({
  nickname,
  setNickname,
  age,
  setAge,
  gender,
  setGender,
  errors,
  clearError,
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
      {/* One nickname, in any language. */}
      <div className="field">
        <label htmlFor="pf-nickname">{t('signup.nickname')}</label>
        <input
          id="pf-nickname"
          className="input"
          value={nickname}
          onChange={(e) => {
            setNickname(e.target.value);
            clearError('nickname');
          }}
          placeholder={t('signup.nicknamePh')}
          maxLength={40}
          {...invalidProps('nickname', errors)}
        />
        <FieldError id="pf-nickname-err" msg={errors.nickname} />
      </div>
      <div className="field">
        <label>{t('signup.age')}</label>
        <input
          id="pf-age"
          className="input"
          type="number"
          inputMode="numeric"
          value={age}
          onChange={(e) => {
            setAge(e.target.value);
            clearError('age');
          }}
          placeholder={t('signup.agePh')}
          min={1}
          max={90}
          {...invalidProps('age', errors)}
        />
        <FieldError id="pf-age-err" msg={errors.age} />
      </div>
      <div className="field">
        <label>{t('signup.gender')}</label>
        <select
          id="pf-gender"
          className="select"
          value={gender}
          onChange={(e) => {
            setGender(e.target.value);
            clearError('gender');
          }}
          {...invalidProps('gender', errors)}
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
        <FieldError id="pf-gender-err" msg={errors.gender} />
      </div>
    </>
  );
}

// PDPA consent tick, on the signup flow's own consent step (ConsentStep).
function ConsentCheck({ checked, onChange, error, onReadMore, readMoreLabel }) {
  const { t } = useI18n();
  return (
    <div className="field consent-field">
      <label className={`consent-check${error ? ' consent-check--error' : ''}`}>
        <input
          id="pf-consent"
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          {...invalidProps('consent', error ? { consent: error } : {})}
        />
        <span className="consent-box" aria-hidden="true" />
        <span className="consent-text">
          {t('privacy.consent')}{' '}
          <button type="button" className="link consent-more" onClick={onReadMore}>
            {readMoreLabel || t('privacy.readMore')}
          </button>
        </span>
      </label>
      <FieldError id="pf-consent-err" msg={error} />
    </div>
  );
}

// The last step before the account is created (after the profile, and the
// password for email signups): a short summary of what happens to their
// data, the full policy one tap away ("read more" pops it up), and a required
// tick before the button that actually signs them up.
function ConsentStep({ consent, onConsent, error, onContinue, busy, submitLabel, progress }) {
  const { t } = useI18n();
  const [sheet, setSheet] = useState(false);
  const points = ['collect', 'use', 'never', 'rights'];
  return (
    <form
      className="stagger"
      onSubmit={(e) => {
        e.preventDefault();
        onContinue();
      }}
      noValidate
    >
      <div className="header">
        {progress}
        <h1 className="h1">{t('privacy.stepTitle')}</h1>
        <p className="sub">{t('privacy.stepSub')}</p>
      </div>
      <div className="glass consent-card">
        <ul className="consent-points">
          {points.map((k) => (
            <li key={k}>
              <span className="consent-point-title">{t(`privacy.point.${k}.title`)}</span>
              <span className="consent-point-desc">{t(`privacy.point.${k}.desc`)}</span>
            </li>
          ))}
        </ul>
      </div>
      <ConsentCheck
        checked={consent}
        onChange={onConsent}
        error={error}
        onReadMore={() => setSheet(true)}
      />
      <PrivacySheet
        open={sheet}
        onClose={() => setSheet(false)}
        onAccept={() => {
          onConsent(true);
          setSheet(false);
        }}
      />
      <button className="btn btn--primary" type="submit" disabled={busy}>
        {busy ? t('signup.submitBusy') : submitLabel}
      </button>
    </form>
  );
}

// "Step 2 of 3" above each signup step after the email is verified.
function StepProgress({ n, of }) {
  const { t } = useI18n();
  return (
    <div className="signup-progress" aria-label={t('signup.stepOf', { n, of })}>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className={i < n ? 'on' : ''} />
      ))}
      <em>{t('signup.stepOf', { n, of })}</em>
    </div>
  );
}

// Server error codes that belong to one profile field — shown under that
// field instead of in the banner at the top of the form.
const FIELD_OF_ERROR = {
  NICKNAME_REQUIRED: 'nickname',
  NICKNAME_TOO_LONG: 'nickname',
  AGE_REQUIRED: 'age',
  GENDER_REQUIRED: 'gender',
  PRIVACY_REQUIRED: 'consent',
  PASSWORD_WEAK: 'password',
};
// Which step to go back to so the person can fix a field the server refused.
const STEP_OF_FIELD = { nickname: 'profile', age: 'profile', gender: 'profile', password: 'password', consent: 'consent' };
const FIELD_ORDER = ['nickname', 'age', 'gender', 'consent'];

export default function Signup() {
  const nav = useNavigate();
  const loc = useLocation();
  const { config, applyAuth, setUser } = useAuth();
  const { t } = useI18n();
  const toast = useToast();

  const [step, setStep] = useState('method'); // method | email | otp | profile | password | consent | gprofile
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [email, setEmail] = useState('');
  const emailRef = useRef(null);
  const [otp, setOtp] = useState(['', '', '', '']);
  const [otpKey, setOtpKey] = useState(0);
  const [otpStatus, setOtpStatus] = useState('idle'); // idle | error | success
  // The last OTP error, kept under the boxes after the shake until they type
  // again — it used to vanish with the shake, after 0.7s.
  const [otpMsg, setOtpMsg] = useState('');

  const [nickname, setNickname] = useState('');
  // Google's suggested name prefills the nickname.
  const applySuggestedNickname = (name) => {
    if (name) setNickname(name);
  };
  // Per-field validation messages for the profile step, shown under each
  // field (see ProfileFields) rather than as one banner above the form.
  const [fieldErr, setFieldErr] = useState({});
  const [consent, setConsent] = useState(false);
  // Which signup this is once the email (or Google) is confirmed: 'email'
  // runs profile → password → consent, 'google' runs profile → consent.
  const [flow, setFlow] = useState('email');
  const profileStep = flow === 'google' ? 'gprofile' : 'profile';
  const [password2, setPassword2] = useState('');
  const pickConsent = (v) => {
    setConsent(v);
    if (v) setFieldErr((cur) => (cur.consent ? { ...cur, consent: undefined } : cur));
  };
  const clearFieldErr = useCallback(
    (field) => setFieldErr((cur) => (cur[field] ? { ...cur, [field]: undefined } : cur)),
    [],
  );
  // Shows the given field errors and brings the first one into view.
  const showFieldErrors = (errs) => {
    setFieldErr(errs);
    const first = FIELD_ORDER.find((f) => errs[f]);
    if (first) {
      const el = document.getElementById(`pf-${first}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus({ preventScroll: true });
    }
  };
  // Checks every profile field at once; returns {} when all are valid.
  const profileErrors = () => {
    const errs = {};
    const nameErr = nicknameError(nickname);
    const ageNum = Number(age);
    if (nameErr) errs.nickname = t(nameErr);
    if (!age) errs.age = t('signup.needAge');
    else if (!Number.isInteger(ageNum) || ageNum < 1 || ageNum > 90) errs.age = t('signup.ageInvalid');
    if (!gender) errs.gender = t('signup.needGender');
    return errs;
  };
  // A rejected submit: field errors go under their field, anything else
  // to the banner at the top.
  const showSubmitError = (e2) => {
    const field = FIELD_OF_ERROR[e2.data?.error_code];
    if (field) {
      // Back to the step holding that field, with the message under it.
      const to = STEP_OF_FIELD[field];
      setStep(to === 'profile' ? profileStep : to);
      if (field === 'consent') setConsent(false);
      setTimeout(() => showFieldErrors({ [field]: e2.message }), 0);
    }
    else setErr(e2.message);
  };
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
      applySuggestedNickname(g.suggested_nickname);
      setFlow('google');
      setStep('gprofile');
    }
  }, [loc.state]); // eslint-disable-line react-hooks/exhaustive-deps

  const { rules, score, valid: pwValid } = pwScore(password);

  const requestOtp = async (e) => {
    e.preventDefault();
    setErr('');
    setOtpMsg('');
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
      await api.post('/auth/otp/verify', { email, code }, { auth: false });
      setOtpStatus('success');
      // Wait for the staggered checkmarks to finish before leaving: the last
      // box starts at 3 * 180ms and its spring runs ~0.6s (~1140ms total),
      // plus a beat to let it settle.
      setTimeout(() => {
        setFlow('email');
        setStep('profile');
      }, 1300);
    } catch (e2) {
      setErr(e2.message);
      setOtpMsg(e2.message);
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

  // Profile → next step (password for email signups, consent for Google).
  const submitProfile = (e) => {
    e.preventDefault();
    setErr('');
    const errs = profileErrors();
    if (Object.keys(errs).length) return showFieldErrors(errs);
    setStep(flow === 'google' ? 'consent' : 'password');
  };
  const pwMismatch = password2 !== '' && password2 !== password;
  const submitPassword = (e) => {
    e.preventDefault();
    setErr('');
    if (!pwValid) return setFieldErr({ password: t('signup.pwNotValid') });
    if (password2 !== password) return setFieldErr({ password2: t('signup.pwMismatch') });
    setStep('consent');
  };
  // Consent accepted → create the account.
  const submitConsent = () => {
    if (!consent) {
      setFieldErr((cur) => ({ ...cur, consent: t('privacy.needConsent') }));
      document.getElementById('pf-consent')?.focus();
      return;
    }
    if (flow === 'google') registerGoogle();
    else registerEmail();
  };

  const registerEmail = async () => {
    setErr('');
    setBusy(true);
    try {
      const d = await api.post(
        '/auth/register',
        { email, code: otp.join(''), nickname, age, gender, password, accept_privacy: consent },
        { auth: false },
      );
      applyAuth(d.token, d.user);
      await uploadAvatarIfAny();
      nav('/app/welcome', { replace: true, state: { isNew: true } });
    } catch (e2) {
      showSubmitError(e2);
    } finally {
      setBusy(false);
    }
  };

  const onGoogleCredential = useCallback(
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
          setGCredential(credential);
          applySuggestedNickname(d.suggested_nickname);
          setFlow('google');
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

  const registerGoogle = async () => {
    setErr('');
    setBusy(true);
    try {
      const d = await api.post(
        '/auth/google',
        { credential: gCredential, nickname, age, gender, accept_privacy: consent },
        { auth: false },
      );
      applyAuth(d.token, d.user);
      await uploadAvatarIfAny();
      nav('/app/welcome', { replace: true, state: { isNew: true } });
    } catch (e2) {
      showSubmitError(e2);
    } finally {
      setBusy(false);
    }
  };

  const back = () => {
    setErr('');
    setOtpStatus('idle');
    setOtpMsg('');
    if (step === 'method') nav('/');
    else if (step === 'otp') setStep('email');
    else if (step === 'profile') setStep('otp');
    else if (step === 'gprofile') setStep('method');
    else if (step === 'password') setStep('profile');
    else if (step === 'consent') setStep(flow === 'google' ? 'gprofile' : 'password');
    else setStep('method');
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
              onChange={(i, v) => {
                setOtp((prev) => prev.map((d, idx) => (idx === i ? v : d)));
                setOtpMsg('');
              }}
              status={otpStatus}
              statusText={
                otpStatus === 'error'
                  ? err
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

      {/* Step: profile + password (email flow) */}

      {step === 'profile' && (
        <form className="stagger" onSubmit={submitProfile} noValidate>
          <div className="header">
            <StepProgress n={1} of={3} />
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
            errors={fieldErr}
            clearError={clearFieldErr}
            avatarPreview={avatarPreview}
            onPickAvatar={onPickAvatar}
            onAvatarChange={onAvatarChange}
            avatarInputRef={avatarInputRef}
          />
          <button className="btn btn--primary" type="submit">
            {t('signup.next')}
          </button>
        </form>
      )}

      {/* Step: password, typed twice (email flow) */}
      {step === 'password' && (
        <form className="stagger" onSubmit={submitPassword} noValidate>
          <div className="header">
            <StepProgress n={2} of={3} />
            <h1 className="h1">{t('signup.passwordTitle')}</h1>
            <p className="sub">{t('signup.passwordSub')}</p>
          </div>
          <PasswordField
            label={t('signup.setPassword')}
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearFieldErr('password');
            }}
          >
            <FieldError id="pf-password-err" msg={fieldErr.password} />
          </PasswordField>
          <PasswordField
            label={t('signup.confirmPassword')}
            autoComplete="new-password"
            value={password2}
            onChange={(e) => {
              setPassword2(e.target.value);
              clearFieldErr('password2');
            }}
          >
            <FieldError
              id="pf-password2-err"
              msg={fieldErr.password2 || (pwMismatch ? t('signup.pwMismatch') : '')}
            />
          </PasswordField>
          {/* Strength bars and the rule checklist after both boxes, so the
              two password fields sit together. */}
          <div className="signup-pw-strength">
            <PasswordStrength rules={rules} score={score} />
          </div>
          <button className="btn btn--primary" type="submit" disabled={!pwValid || password2 !== password}>
            {t('signup.next')}
          </button>
        </form>
      )}

      {/* Step: privacy policy (PDPA) consent — last, then the account is made */}
      {step === 'consent' && (
        <ConsentStep
          consent={consent}
          onConsent={pickConsent}
          error={fieldErr.consent}
          onContinue={submitConsent}
          busy={busy}
          submitLabel={flow === 'google' ? t('privacy.acceptStart') : t('privacy.acceptSignup')}
          progress={flow === 'google' ? <StepProgress n={2} of={2} /> : <StepProgress n={3} of={3} />}
        />
      )}

      {/* Step: Google profile completion */}
      {step === 'gprofile' && (
        <form className="stagger" onSubmit={submitProfile} noValidate>
          <div className="header">
            <StepProgress n={1} of={2} />
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
            errors={fieldErr}
            clearError={clearFieldErr}
            avatarPreview={avatarPreview}
            onPickAvatar={onPickAvatar}
            onAvatarChange={onAvatarChange}
            avatarInputRef={avatarInputRef}
          />
          <button className="btn btn--primary" type="submit">
            {t('signup.next')}
          </button>
        </form>
      )}

      {/* Keyed by step: each step's form plays its own stagger-in, so the
          notice remounts with it and rises in last, below the new form.
          Only on the steps before the email is verified — once someone is
          filling in their profile, the launch countdown is just noise. */}
      {['method', 'email', 'otp'].includes(step) && <LaunchNotice key={step} t={t} />}

    </div>
  );
}
