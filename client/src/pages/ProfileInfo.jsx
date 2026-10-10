import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import { useToast } from '../components/ui.jsx';
import { IcBack, IcCheck } from '../components/icons.jsx';
import { nicknameError } from '../util.js';
import FieldError, { invalidProps } from '../components/FieldError.jsx';

const GENDER_VALUES = ['', 'female', 'male', 'other', 'prefer_not'];

// Nickname, age and gender, edited on their own page opened from Profile.
export default function ProfileInfo() {
  const nav = useNavigate();
  const toast = useToast();
  const { user, setUser } = useAuth();
  const { t } = useI18n();

  const [nickname, setNickname] = useState(user?.nickname || user?.nickname_en || '');
  // Validation messages, shown under each field.
  const [nameErr, setNameErr] = useState({});
  const [age, setAge] = useState(user?.age || '');
  const [gender, setGender] = useState(user?.gender || '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const nameErr0 = nicknameError(nickname);
    // Same age rule as signup; left empty, the saved age stays as it is.
    const ageNum = Number(age);
    const ageErr = age !== '' && (!Number.isInteger(ageNum) || ageNum < 1 || ageNum > 120);
    if (nameErr0 || ageErr) {
      setNameErr({
        nickname: nameErr0 && t(nameErr0),
        age: ageErr && t('signup.ageInvalid'),
      });
      document.getElementById(nameErr0 ? 'pf-nickname' : 'pf-age')?.focus();
      return;
    }
    setBusy(true);
    try {
      const d = await api.patch('/auth/me', { nickname, age, gender });
      setUser(d.user);
      toast(
        <>
          <IcCheck size={16} /> {t('profile.saved')}
        </>,
      );
    } catch (e) {
      const code = e.data?.error_code || '';
      if (code.startsWith('AGE')) setNameErr({ age: e.message });
      else if (code.startsWith('NICKNAME')) setNameErr({ nickname: e.message });
      else toast(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page stagger">
      <button className="link back-btn" style={{ alignSelf: 'flex-start', marginBottom: 18 }} onClick={() => nav(-1)}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IcBack size={20} /> {t('common.back')}
        </span>
      </button>

      <div className="header">
        <h1 className="h1">{t('profile.myInfo')}</h1>
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
              setNameErr((cur) => ({ ...cur, nickname: undefined }));
            }}
            placeholder={t('signup.nicknamePh')}
            maxLength={40}
            {...invalidProps('nickname', nameErr)}
          />
          <FieldError id="pf-nickname-err" msg={nameErr.nickname} />
        </div>
        <div className="field">
          <label htmlFor="pf-age">{t('signup.age')}</label>
          <input
            id="pf-age"
            className="input"
            type="number"
            inputMode="numeric"
            value={age}
            onChange={(e) => {
              setAge(e.target.value);
              setNameErr((p) => ({ ...p, age: '' }));
            }}
            {...invalidProps('age', nameErr)}
          />
          <FieldError id="pf-age-err" msg={nameErr.age} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="pf-gender">{t('signup.gender')}</label>
          <select id="pf-gender" className="select" value={gender} onChange={(e) => setGender(e.target.value)}>
            {GENDER_VALUES.map((g) => (
              <option key={g} value={g}>
                {g ? t(`gender.${g}`) : t('gender.none')}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn--primary" onClick={save} disabled={busy} style={{ marginTop: 20 }}>
          {busy ? t('profile.saving') : t('profile.save')}
        </button>
      </div>
    </div>
  );
}
