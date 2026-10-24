import { useState, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { setAdminToken } from '../admin/adminApi.js';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';
import { useToast } from '../components/ui.jsx';
import GoogleButton from '../components/GoogleButton.jsx';
import LangToggle from '../components/LangToggle.jsx';
import LaunchNotice from '../components/LaunchNotice.jsx';
import OtpInput from '../components/OtpInput.jsx';
import PasswordField from '../components/PasswordField.jsx';
import PasswordStrength from '../components/PasswordStrength.jsx';
import { pwScore } from '../utils/password.js';
import { AVATAR_MAX_BYTES, AVATAR_TYPES } from '../utils/avatar.js';
import { shrinkImage, AVATAR_SIDE } from '../utils/shrinkImage.js';
import { IcBack, IcCamera, IcGoogle, IcMail } from '../components/icons.jsx';
import { nicknameError } from '../util.js';
import FieldError, { invalidProps } from '../components/FieldError.jsx';
import { PrivacySheet } from '../components/PrivacyPolicy.jsx';
import GenderPicker from '../components/GenderPicker.jsx';

// Where someone heard of DeePer, asked when they request to join the test.
const TESTER_SOURCES = ['instagram', 'tiktok', 'friend', 'google', 'other'];

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
      {/* Age and gender share a row, same as the My-information page. */}
      <div className="info-row signup-info-row">
        <div className="field info-age-field">
          <label htmlFor="pf-age">{t('signup.age')}</label>
          <input
            id="pf-age"
            className="input info-age"
            type="number"
            inputMode="numeric"
            value={age}
            onChange={(e) => {
              setAge(e.target.value);
              clearError('age');
            }}
            min={1}
            max={90}
            {...invalidProps('age', errors)}
          />
          <FieldError id="pf-age-err" msg={errors.age} />
        </div>
        <GenderPicker
          value={gender}
          onPick={(g) => {
            setGender(g);
            clearError('gender');
          }}
          errors={errors}
        />
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
  // Before launch signing up needs an invite code (server/src/signupGate.js):
  // the method choice only shows once it's been checked, and it rides along
  // on every signup request.
  // Typed into six OTP-style boxes; a wrong code shakes and clears them, and
  // too many wrong ones lock the boxes for a while (the server decides how
  // long and counts down from its retry_after).
  const [inviteDigits, setInviteDigits] = useState(['', '', '', '', '', '']);
  const [inviteKey, setInviteKey] = useState(0);
  const [inviteStatus, setInviteStatus] = useState('idle');
  const [inviteMsg, setInviteMsg] = useState('');
  const [inviteLockedUntil, setInviteLockedUntil] = useState(0);
  const [lockLeft, setLockLeft] = useState(0);
  const [inviteOk, setInviteOk] = useState(false);
  const inviteCode = inviteDigits.join('');

  // No code yet: ask to join the test instead. The admin emails the code.
  const [req, setReq] = useState({ nickname: '', email: '', source: '', source_other: '' });
  const [reqErr, setReqErr] = useState({});
  const setReqField = (k, v) => {
    setReq((cur) => ({ ...cur, [k]: v }));
    setReqErr((cur) => ({ ...cur, [k]: undefined }));
  };
  const submitTesterRequest = async (e) => {
    e.preventDefault();
    setErr('');
    const errs = {};
    if (!req.nickname.trim()) errs.nickname = 'err.NICKNAME_REQUIRED';
    if (!req.email.trim()) errs.email = 'err.EMAIL_REQUIRED';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.email.trim())) errs.email = 'err.INVALID_EMAIL';
    if (!req.source) errs.source = 'err.TESTER_SOURCE_REQUIRED';
    if (Object.keys(errs).length) return setReqErr(errs);
    setBusy(true);
    try {
      await api.post('/tester-requests', req, { auth: false });
      setStep('requested');
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  };
  const needInvite = config.invite_required && !inviteOk;

  useEffect(() => {
    if (!inviteLockedUntil) return undefined;
    const tick = () => {
      const left = Math.ceil((inviteLockedUntil - Date.now()) / 1000);
      if (left <= 0) {
        setInviteLockedUntil(0);
        setLockLeft(0);
        setInviteMsg('');
        setInviteKey((k) => k + 1);
      } else setLockLeft(left);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [inviteLockedUntil]);

  const checkInvite = async (digits = inviteDigits) => {
    const code = digits.join('');
    if (code.length !== 6 || busy || inviteLockedUntil) return;
    setBusy(true);
    try {
      await api.post('/auth/invite/check', { invite_code: code }, { auth: false });
      setInviteStatus('success');
      setInviteMsg('');
      // Let the six checkmarks play (last starts at 5 × 70 ms) before moving on.
      setTimeout(() => setInviteOk(true), 1000);
    } catch (e2) {
      const d = e2.data || {};
      if (d.error_code === 'INVITE_LOCKED') {
        setInviteDigits(['', '', '', '', '', '']);
        setInviteLockedUntil(Date.now() + (d.retry_after || 30) * 1000);
        setInviteStatus('idle');
        return;
      }
      setInviteMsg(
        d.tries_left ? `${e2.message} · ${t('signup.inviteTriesLeft', { n: d.tries_left })}` : e2.message,
      );
      setInviteStatus('error');
      setTimeout(() => {
        setInviteDigits(['', '', '', '', '', '']);
        setInviteKey((k) => k + 1);
        setInviteStatus('idle');
      }, 700);
    } finally {
      setBusy(false);
    }
  };
  const emailRef = useRef(null);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
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
    // i18n keys, translated by FieldError (so they follow a language switch).
    if (nameErr) errs.nickname = nameErr;
    if (!age) errs.age = 'signup.needAge';
    else if (!Number.isInteger(ageNum) || ageNum < 1 || ageNum > 90) errs.age = 'signup.ageInvalid';
    if (!gender) errs.gender = 'signup.needGender';
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
    else setErr(e2);
  };
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [password, setPassword] = useState('');

  const [gCredential, setGCredential] = useState(null);

  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  // Frees the preview's memory when it's replaced or the page closes.
  useEffect(() => () => avatarPreview && URL.revokeObjectURL(avatarPreview), [avatarPreview]);
  const avatarInputRef = useRef(null);

  const onPickAvatar = () => avatarInputRef.current?.click();

  const onAvatarChange = async (e) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    if (!AVATAR_TYPES.includes(picked.type)) return toast(t('err.AVATAR_TYPE_INVALID'));
    const file = await shrinkImage(picked, AVATAR_SIDE);
    if (file.size > AVATAR_MAX_BYTES) return toast(t('err.AVATAR_TOO_LARGE'));
    setAvatarFile(file);
    // Free the previous preview's memory before making the next one.
    setAvatarPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });
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
      const d = await api.post('/auth/otp/request', { email, invite_code: inviteCode }, { auth: false });
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
      await api.post('/auth/otp/verify', { email, code }, { auth: false });
      setOtpStatus('success');
      // Wait for the staggered checkmarks to finish before leaving: the last
      // box starts at 3 * 70ms and its spring runs ~0.6s (~810ms total),
      // plus a beat to let it settle.
      setTimeout(() => {
        setFlow('email');
        setStep('profile');
      }, 950);
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

  // Profile → password. Google signups set one too, so every account can
  // also sign in with email + password.
  const submitProfile = (e) => {
    e.preventDefault();
    setErr('');
    const errs = profileErrors();
    if (Object.keys(errs).length) return showFieldErrors(errs);
    setStep('password');
  };
  const pwMismatch = password2 !== '' && password2 !== password;
  const submitPassword = (e) => {
    e.preventDefault();
    setErr('');
    if (!pwValid) return setFieldErr({ password: 'signup.pwNotValid' });
    if (password2 !== password) return setFieldErr({ password2: 'signup.pwMismatch' });
    setStep('consent');
  };
  // Consent accepted → create the account.
  const submitConsent = () => {
    if (!consent) {
      setFieldErr((cur) => ({ ...cur, consent: 'privacy.needConsent' }));
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
        { email, code: otp.join(''), nickname, age, gender, password, accept_privacy: consent, invite_code: inviteCode },
        { auth: false },
      );
      applyAuth(d.token, d.user);
      // Straight to the welcome page in the same tick as signing in: while
      // a photo upload was awaited first, the signed-in user tripped
      // GuestOnly on this page, which flashed Home before Welcome. The
      // photo now uploads in the background and appears once it lands.
      nav('/app/welcome', { replace: true, state: { isNew: true } });
      uploadAvatarIfAny();
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
        const d = await api.post('/auth/google', { credential, invite_code: inviteCode }, { auth: false });
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
        setErr(e2);
      }
    },
    [applyAuth, nav, inviteCode],
  );

  const registerGoogle = async () => {
    setErr('');
    setBusy(true);
    try {
      const d = await api.post(
        '/auth/google',
        { credential: gCredential, nickname, age, gender, password, accept_privacy: consent, invite_code: inviteCode },
        { auth: false },
      );
      applyAuth(d.token, d.user);
      // Straight to the welcome page in the same tick as signing in: while
      // a photo upload was awaited first, the signed-in user tripped
      // GuestOnly on this page, which flashed Home before Welcome. The
      // photo now uploads in the background and appears once it lands.
      nav('/app/welcome', { replace: true, state: { isNew: true } });
      uploadAvatarIfAny();
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
    else if (step === 'request' || step === 'requested') setStep('method');
    else if (step === 'otp') setStep('email');
    else if (step === 'profile') setStep('otp');
    else if (step === 'gprofile') setStep('method');
    else if (step === 'password') setStep(flow === 'google' ? 'gprofile' : 'profile');
    else if (step === 'consent') setStep('password');
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

      {err && !(step === 'otp' && otpStatus === 'error') && <ErrorBanner err={err} />}

      {/* Step: choose method */}
      {/* Each step fades out before the next one staggers in, instead of
          cutting to a near-empty frame in between. */}
      <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={`${step}${needInvite ? '-invite' : ''}`}
        className="signup-step"
        exit={{ opacity: 0, y: -6, transition: { duration: 0.16, ease: 'easeIn' } }}
      >
      {step === 'method' && needInvite && (
        <form
          className="stagger"
          onSubmit={(e) => {
            e.preventDefault();
            checkInvite();
          }}
        >
          <div className="header">
            <h1 className="h1">{t('signup.title')}</h1>
            <p className="sub">{t('signup.inviteSub')}</p>
          </div>
          <div className="otp-six" style={{ marginBottom: 24 }}>
            <OtpInput
              key={inviteKey}
              value={inviteDigits}
              onChange={(i, v) => {
                const next = inviteDigits.map((d, idx) => (idx === i ? v : d));
                setInviteDigits(next);
                setInviteMsg('');
                // Checked as soon as the sixth digit goes in.
                if (next.every(Boolean)) checkInvite(next);
              }}
              onFill={(next) => {
                setInviteDigits(next);
                setInviteMsg('');
                if (next.every(Boolean)) checkInvite(next);
              }}
              status={inviteLockedUntil ? 'locked' : inviteStatus}
              statusText={
                inviteLockedUntil
                  ? t('signup.inviteLocked', { s: lockLeft })
                  : inviteMsg || (inviteStatus === 'success' ? t('signup.inviteOk') : t('signup.inviteHint'))
              }
              statusError={!!inviteMsg || !!inviteLockedUntil}
            />
          </div>
          <button
            className="btn btn--primary"
            type="submit"
            disabled={busy || inviteCode.length !== 6 || !!inviteLockedUntil || inviteStatus !== 'idle'}
          >
            {t('signup.inviteSubmit')}
          </button>
          <p className="faint center" style={{ marginTop: 18, fontSize: 14 }}>
            {t('tester.noCode')}{' '}
            <button
              className="link"
              type="button"
              onClick={() => {
                setErr('');
                setStep('request');
              }}
            >
              {t('tester.ask')}
            </button>
          </p>
        </form>
      )}

      {/* Step: ask to join the pre-launch test (no invite code yet) */}
      {step === 'request' && (
        <form className="stagger" onSubmit={submitTesterRequest} noValidate>
          <div className="header">
            <h1 className="h1">{t('tester.title')}</h1>
            <p className="sub">{t('tester.sub')}</p>
          </div>
          <div className="field">
            <label htmlFor="tr-nickname">{t('signup.nickname')}</label>
            <input
              id="tr-nickname"
              className="input"
              value={req.nickname}
              onChange={(e) => setReqField('nickname', e.target.value)}
              placeholder={t('signup.nicknamePh')}
              maxLength={40}
              {...invalidProps('nickname', reqErr)}
            />
            <FieldError id="tr-nickname-err" msg={reqErr.nickname} />
          </div>
          <div className="field">
            <label htmlFor="tr-email">{t('login.email')}</label>
            <input
              id="tr-email"
              className="input"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={req.email}
              onChange={(e) => setReqField('email', e.target.value)}
              {...invalidProps('email', reqErr)}
            />
            <FieldError id="tr-email-err" msg={reqErr.email} />
          </div>
          <div className="field">
            <label id="tr-source-label">{t('tester.source')}</label>
            <div className="filter-row tester-sources" role="radiogroup" aria-labelledby="tr-source-label">
              {TESTER_SOURCES.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={req.source === s}
                  className={`pill ${req.source === s ? 'active' : ''}`}
                  onClick={() => setReqField('source', s)}
                >
                  {t(`tester.source.${s}`)}
                </button>
              ))}
            </div>
            {req.source === 'other' && (
              <input
                className="input"
                value={req.source_other}
                onChange={(e) => setReqField('source_other', e.target.value)}
                placeholder={t('tester.sourceOtherPh')}
                maxLength={100}
              />
            )}
            <FieldError id="tr-source-err" msg={reqErr.source} />
          </div>
          <button className="btn btn--primary" type="submit" disabled={busy}>
            {t('tester.submit')}
          </button>
        </form>
      )}

      {step === 'requested' && (
        <div className="stagger">
          <div className="header">
            <h1 className="h1">{t('tester.doneTitle')}</h1>
            <p className="sub">{t('tester.doneSub', { email: req.email.trim() })}</p>
          </div>
          <button className="btn btn--primary" type="button" onClick={() => nav('/')}>
            {t('common.back')}
          </button>
        </div>
      )}

      {step === 'method' && !needInvite && (
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
            invalid={!!fieldErr.password2 || pwMismatch}
            errorId="pf-password2-err"
          >
            <FieldError
              id="pf-password2-err"
              msg={fieldErr.password2 || (pwMismatch ? 'signup.pwMismatch' : '')}
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
          progress={<StepProgress n={3} of={3} />}
        />
      )}

      {/* Step: Google profile completion */}
      {step === 'gprofile' && (
        <form className="stagger" onSubmit={submitProfile} noValidate>
          <div className="header">
            <StepProgress n={1} of={3} />
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

      </motion.div>
      </AnimatePresence>

      {/* Keyed by step: each step's form plays its own stagger-in, so the
          notice remounts with it and rises in last, below the new form.
          Only on the steps before the email is verified — once someone is
          filling in their profile, the launch countdown is just noise. */}
      {['method', 'email', 'otp'].includes(step) && <LaunchNotice key={step} t={t} />}

    </div>
  );
}
