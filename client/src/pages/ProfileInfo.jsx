import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../api.js';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import { useToast } from '../components/ui.jsx';
import { IcBack, IcCamera, IcTrash } from '../components/icons.jsx';
import { displayName, nicknameError } from '../util.js';
import FieldError, { invalidProps } from '../components/FieldError.jsx';
import SaveButton, { useSavedFlash } from '../components/SaveButton.jsx';
import { useElasticIndicator } from '../utils/elasticIndicator.js';
import { useAvatarEdit } from '../utils/useAvatarEdit.js';

// Same choices as signup; gender is required there, so there's no "none".
const GENDER_VALUES = ['female', 'male', 'other', 'prefer_not'];

// Nickname, age and gender, edited on their own page opened from Profile.
export default function ProfileInfo() {
  const nav = useNavigate();
  const location = useLocation();
  // Opened straight from a link or after a reload there's no app page to
  // go back to, so fall back to the page this one is opened from.
  const goBack = () => (location.key !== 'default' ? nav(-1) : nav('/app/profile', { replace: true }));
  const toast = useToast();
  const { user, setUser } = useAuth();
  const { t, lang } = useI18n();

  const savedName = user?.nickname || user?.nickname_en || '';
  const savedAge = user?.age != null ? String(user.age) : '';
  const savedGender = GENDER_VALUES.includes(user?.gender) ? user.gender : '';

  const [nickname, setNickname] = useState(savedName);
  // Validation messages, shown under each field.
  const [errs, setErrs] = useState({});
  const [age, setAge] = useState(savedAge);
  const [gender, setGender] = useState(savedGender);
  const [busy, setBusy] = useState(false);
  // Brief tick on the button after a save.
  const saved = useSavedFlash();

  // Nothing to save until something actually differs from what's stored.
  const dirty = nickname.trim() !== savedName || age.trim() !== savedAge || gender !== savedGender;

  const pickGender = (g) => {
    setGender(g);
    setErrs((cur) => ({ ...cur, gender: undefined }));
  };
  const genderInd = useElasticIndicator(gender, pickGender);

  const save = async () => {
    const nameErr = nicknameError(nickname);
    // Same age rule as signup: required, a whole number 1–90.
    const ageNum = Number(age);
    const ageErr =
      age.trim() === ''
        ? t('err.AGE_REQUIRED')
        : !Number.isInteger(ageNum) || ageNum < 1 || ageNum > 90
          ? t('signup.ageInvalid')
          : null;
    const genderErr = gender ? null : t('err.GENDER_REQUIRED');
    if (nameErr || ageErr || genderErr) {
      setErrs({
        nickname: nameErr && t(nameErr),
        age: ageErr,
        gender: genderErr,
      });
      document.getElementById(nameErr ? 'pf-nickname' : ageErr ? 'pf-age' : 'pf-gender')?.focus();
      return;
    }
    setBusy(true);
    try {
      const d = await api.patch('/auth/me', { nickname, age: ageNum, gender });
      setUser(d.user);
      setNickname((n) => n.trim());
      // The button itself turns into "saved" with a tick; no toast on top.
      saved.flash();
    } catch (e) {
      const code = e.data?.error_code || '';
      if (code.startsWith('AGE')) setErrs({ age: e.message });
      else if (code.startsWith('NICKNAME')) setErrs({ nickname: e.message });
      else if (code.startsWith('GENDER')) setErrs({ gender: e.message });
      else toast(e.message);
    } finally {
      setBusy(false);
    }
  };

  const initial = (displayName(user, lang) || '?').trim().charAt(0).toUpperCase();
  const avatar = useAvatarEdit();

  return (
    <div className="page stagger">
      <button className="link back-btn" style={{ alignSelf: 'flex-start', marginBottom: 18 }} onClick={goBack}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IcBack size={20} /> {t('common.back')}
        </span>
      </button>

      <div className="header">
        <h1 className="h1">{t('profile.myInfo')}</h1>
        <p className="sub">{t('profile.myInfoHint')}</p>
      </div>

      {/* Photo laid out like the Profile page's header; this page is where
          it's changed or removed. */}
      <div className="profile-header" style={{ marginBottom: 22 }}>
        <div className="avatar-edit avatar-edit--lg">
          <div
            className="avatar avatar--lg"
            style={
              user?.avatar_url
                ? {
                    backgroundImage: `url("${user.avatar_url}")`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : undefined
            }
          >
            {!user?.avatar_url && initial}
          </div>
          <button
            type="button"
            className="avatar-edit__btn"
            onClick={avatar.pick}
            disabled={avatar.busy}
            aria-label={t('profile.changePhoto')}
          >
            <IcCamera size={16} />
          </button>
          <input
            ref={avatar.inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={avatar.onFileChange}
          />
        </div>
        <div className="profile-header-info">
          <h2 className="h2">{displayName(user, lang)}</h2>
          <p className="faint" style={{ margin: '4px 0 0' }}>
            {user?.email || t('common.googleAccount')} {user?.via_google ? '· Google' : ''}
          </p>
          {user?.avatar_url && (
            <button className="link-btn" style={{ marginTop: 8 }} onClick={avatar.remove} disabled={avatar.busy}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <IcTrash size={13} /> {t('profile.removePhoto')}
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="glass" style={{ padding: 18 }}>
        <div className="field">
          <label htmlFor="pf-nickname">{t('signup.nickname')}</label>
          <input
            id="pf-nickname"
            className="input"
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              setErrs((cur) => ({ ...cur, nickname: undefined }));
            }}
            placeholder={t('signup.nicknamePh')}
            maxLength={40}
            {...invalidProps('nickname', errs)}
          />
          <FieldError id="pf-nickname-err" msg={errs.nickname} />
        </div>
        {/* Age and gender share a row: the age box only needs room for a
            number, and on its own row it left the card looking empty. */}
        <div className="info-row">
          <div className="field info-age-field">
            <label htmlFor="pf-age">{t('signup.age')}</label>
            <input
              id="pf-age"
              className="input info-age"
              type="number"
              inputMode="numeric"
              min={1}
              max={90}
              value={age}
              onChange={(e) => {
                setAge(e.target.value);
                setErrs((cur) => ({ ...cur, age: undefined }));
              }}
              {...invalidProps('age', errs)}
            />
            <FieldError id="pf-age-err" msg={errs.age} />
          </div>
          <div className="field info-gender-field">
            <label id="pf-gender-label">{t('signup.gender')}</label>
            {/* Every option on show at once, with the same sliding capsule as
              the question-depth picker on Profile — clearer than a select,
              which here read as just another text box. */}
            <div
              id="pf-gender"
              ref={genderInd.rowRef}
              className="lang-seg level-seg"
              role="radiogroup"
              aria-labelledby="pf-gender-label"
              tabIndex={-1}
              {...invalidProps('gender', errs)}
              {...genderInd.dragHandlers}
            >
              <motion.span className="level-seg-bg" style={{ ...genderInd.style, opacity: gender ? 1 : 0 }} />
              {GENDER_VALUES.map((g) => {
                const isActive = gender === g;
                return (
                  <button
                    key={g}
                    ref={genderInd.itemRef(g)}
                    data-pick={g}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    className={isActive ? 'active' : ''}
                    onClick={() => pickGender(g)}
                  >
                    <motion.span
                      key={isActive ? 'on' : 'off'}
                      className="pill-label"
                      initial={isActive ? { scale: 0.82 } : false}
                      animate={{ scale: 1 }}
                      transition={{
                        type: 'spring',
                        stiffness: 380,
                        damping: 14,
                      }}
                    >
                      {t(`gender.${g}`)}
                    </motion.span>
                  </button>
                );
              })}
            </div>
            <FieldError id="pf-gender-err" msg={errs.gender} />
          </div>
        </div>
        <SaveButton
          onClick={save}
          busy={busy}
          done={saved.done}
          disabled={!dirty}
          label={t('profile.save')}
          busyLabel={t('profile.saving')}
          doneLabel={t('profile.saved')}
          style={{ marginTop: 20 }}
        />
      </div>
    </div>
  );
}
