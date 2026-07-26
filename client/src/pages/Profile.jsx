import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import { useToast, useConfirm } from '../components/ui.jsx';
import LangToggle from '../components/LangToggle.jsx';
import { IcCamera, IcCheck, IcSettings, IcTrash } from '../components/icons.jsx';
import { AVATAR_MAX_BYTES, AVATAR_TYPES } from '../utils/avatar.js';

const GENDER_VALUES = ['', 'female', 'male', 'other', 'prefer_not'];
const COLORS = ['#f43f5e', '#fb923c', '#eab308', '#34d399', '#38bdf8', '#a78bfa', '#f472b6'];

export default function Profile() {
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { user, setUser } = useAuth();
  const { t } = useI18n();

  const [nickname, setNickname] = useState(user?.nickname || '');
  const [age, setAge] = useState(user?.age || '');
  const [gender, setGender] = useState(user?.gender || '');
  const [partnerName, setPartnerName] = useState(user?.partner_name || t('answer.partnerDefault'));
  const [partnerColor, setPartnerColor] = useState(user?.partner_color || '#f43f5e');
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const fileInputRef = useRef(null);

  const save = async () => {
    setBusy(true);
    try {
      const d = await api.patch('/auth/me', {
        nickname,
        age,
        gender,
        partner_name: partnerName,
        partner_color: partnerColor,
      });
      setUser(d.user);
      toast(
        <>
          <IcCheck size={16} /> {t('profile.saved')}
        </>,
      );
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };

  const pickAvatar = () => fileInputRef.current?.click();

  const onAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) {
      toast(t('err.AVATAR_TYPE_INVALID'));
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast(t('err.AVATAR_TOO_LARGE'));
      return;
    }
    setAvatarBusy(true);
    try {
      const form = new FormData();
      form.append('avatar', file);
      const d = await api.upload('/auth/me/avatar', form);
      setUser(d.user);
    } catch (err) {
      toast(err.message);
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    const ok = await confirm({ message: t('confirm.avatarMsg') });
    if (!ok) return;
    setAvatarBusy(true);
    try {
      const d = await api.del('/auth/me/avatar');
      setUser(d.user);
    } catch (err) {
      toast(err.message);
    } finally {
      setAvatarBusy(false);
    }
  };

  const initial = (user?.nickname || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="page page--tab stagger">
      <div className="profile-header" style={{ marginBottom: 22 }}>
        <div className="avatar-edit avatar-edit--lg">
          <div
            className="avatar avatar--lg"
            style={
              user?.avatar_url
                ? { backgroundImage: `url(${user.avatar_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                : undefined
            }
          >
            {!user?.avatar_url && initial}
          </div>
          <button
            type="button"
            className="avatar-edit__btn"
            onClick={pickAvatar}
            disabled={avatarBusy}
            aria-label={t('profile.changePhoto')}
          >
            <IcCamera size={16} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={onAvatarChange}
          />
        </div>
        <div className="profile-header-info">
          <h1 className="h2">{user?.nickname}</h1>
          <p className="faint" style={{ margin: '4px 0 0' }}>
            {user?.email || t('common.googleAccount')} {user?.via_google ? '· Google' : ''}
          </p>
          {user?.avatar_url && (
            <button className="link-btn" style={{ marginTop: 8 }} onClick={removeAvatar} disabled={avatarBusy}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <IcTrash size={13} /> {t('profile.removePhoto')}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Language */}
      <div className="glass" style={{ padding: 18, marginBottom: 14 }}>
        <div className="row-between">
          <h2 className="h2" style={{ fontSize: 17 }}>
            {t('profile.language')}
          </h2>
          <LangToggle />
        </div>
      </div>

      <div className="glass" style={{ padding: 18, marginBottom: 14, textAlign: 'center' }}>
        <p className="faint" style={{ margin: '0 0 12px' }}>
          {t('support.teaser')}
        </p>
        <button className="btn btn--primary" onClick={() => nav('/app/profile/support')}>
          {t('support.cta')}
        </button>
      </div>

      <div className="glass" style={{ padding: 18, marginBottom: 14 }}>
        <h2 className="h2" style={{ marginBottom: 14, fontSize: 17 }}>
          {t('profile.myInfo')}
        </h2>
        <div className="field">
          <label>{t('signup.nickname')}</label>
          <input className="input" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={40} />
        </div>
        <div className="field">
          <label>{t('signup.age')}</label>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>{t('signup.gender')}</label>
          <select className="select" value={gender} onChange={(e) => setGender(e.target.value)}>
            {GENDER_VALUES.map((g) => (
              <option key={g} value={g}>
                {g ? t(`gender.${g}`) : t('gender.none')}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="glass" style={{ padding: 18, marginBottom: 18 }}>
        <h2 className="h2" style={{ marginBottom: 6, fontSize: 17 }}>
          {t('profile.partnerSection')}
        </h2>
        <p className="faint" style={{ marginBottom: 14 }}>
          {t('profile.partnerHint')}
        </p>
        <div className="field">
          <label>{t('answer.partnerName')}</label>
          <input
            className="input"
            value={partnerName}
            onChange={(e) => setPartnerName(e.target.value)}
            maxLength={30}
          />
        </div>
        <label style={{ fontSize: 14, color: 'var(--text-dim)', paddingLeft: 4 }}>
          {t('answer.color')}
        </label>
        <div className="color-swatches" style={{ marginTop: 8 }}>
          {COLORS.map((c) => (
            <button
              key={c}
              className={`swatch ${partnerColor === c ? 'sel' : ''}`}
              style={{ background: c }}
              onClick={() => setPartnerColor(c)}
              aria-label={c}
            />
          ))}
        </div>
      </div>

      <button className="btn btn--primary" onClick={save} disabled={busy} style={{ marginBottom: 14 }}>
        {busy ? t('profile.saving') : t('profile.save')}
      </button>

      <button className="btn btn--ghost" onClick={() => nav('/app/profile/settings')}>
        <IcSettings size={18} /> {t('profile.accountSettings')}
      </button>
    </div>
  );
}
