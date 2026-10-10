import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import { useToast, useConfirm } from '../components/ui.jsx';
import {
  IcAlertCircle,
  IcBack,
  IcCamera,
  IcChat,
  IcCheck,
  IcInstagram,
  IcPlayCircle,
  IcSettings,
  IcTranslate,
  IcTrash,
} from '../components/icons.jsx';
import { Heart } from 'lucide-react';
import { AVATAR_MAX_BYTES, AVATAR_TYPES } from '../utils/avatar.js';
import { PARTNER_ICONS } from '../utils/partnerIcons.js';
import PartnerAvatar from '../components/PartnerAvatar.jsx';
import { useTutorial } from '../store/tutorial.jsx';
import { CATS, displayName, nicknameThError, nicknameEnError } from '../util.js';
import FieldError, { invalidProps } from '../components/FieldError.jsx';

const GENDER_VALUES = ['', 'female', 'male', 'other', 'prefer_not'];
const COLORS = ['#f43f5e', '#fb923c', '#eab308', '#34d399', '#38bdf8', '#a78bfa', '#f472b6'];

export default function Profile() {
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const tutorial = useTutorial();
  const { user, setUser } = useAuth();
  const { t, lang, setLang } = useI18n();

  const [nickname, setNickname] = useState(user?.nickname || '');
  const [nicknameEn, setNicknameEn] = useState(user?.nickname_en || '');
  // Name validation messages, shown under each name field.
  const [nameErr, setNameErr] = useState({});
  const [age, setAge] = useState(user?.age || '');
  const [gender, setGender] = useState(user?.gender || '');
  const [activeCat, setActiveCat] = useState(CATS[0]);
  const [partnerName, setPartnerName] = useState('');
  const [partnerColor, setPartnerColor] = useState('#f43f5e');
  const [busy, setBusy] = useState(false);
  const [partnerBusy, setPartnerBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [partnerAvatarBusy, setPartnerAvatarBusy] = useState(false);
  const fileInputRef = useRef(null);
  const partnerFileInputRef = useRef(null);

  // Each category has its own partner — reload the name/color draft
  // whenever the selected tab (or the underlying user data) changes.
  useEffect(() => {
    const p = user?.partners?.[activeCat];
    setPartnerName(p?.name || '');
    setPartnerColor(p?.color || '#f43f5e');
  }, [activeCat, user]);

  const save = async () => {
    const thErr = nicknameThError(nickname);
    const enErr = nicknameEnError(nicknameEn);
    // Same age rule as signup; left empty, the saved age stays as it is.
    const ageNum = Number(age);
    const ageErr = age !== '' && (!Number.isInteger(ageNum) || ageNum < 1 || ageNum > 120);
    if (thErr || enErr || ageErr) {
      setNameErr({
        nickname: thErr && t(thErr),
        nicknameEn: enErr && t(enErr),
        age: ageErr && t('signup.ageInvalid'),
      });
      document.getElementById(thErr ? 'pf-nickname' : enErr ? 'pf-nicknameEn' : 'pf-age')?.focus();
      return;
    }
    setBusy(true);
    try {
      const d = await api.patch('/auth/me', { nickname, nickname_en: nicknameEn, age, gender });
      setUser(d.user);
      toast(
        <>
          <IcCheck size={16} /> {t('profile.saved')}
        </>,
      );
    } catch (e) {
      const code = e.data?.error_code || '';
      if (code.startsWith('AGE')) setNameErr({ age: e.message });
      else if (code.startsWith('NICKNAME_EN')) setNameErr({ nicknameEn: e.message });
      else if (code.startsWith('NICKNAME')) setNameErr({ nickname: e.message });
      else toast(e.message);
    } finally {
      setBusy(false);
    }
  };

  const savePartner = async () => {
    setPartnerBusy(true);
    try {
      const d = await api.patch(`/auth/me/partner/${activeCat}`, {
        name: partnerName,
        color: partnerColor,
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
      setPartnerBusy(false);
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

  const pickPartnerAvatar = () => partnerFileInputRef.current?.click();

  const onPartnerAvatarChange = async (e) => {
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
    setPartnerAvatarBusy(true);
    try {
      const form = new FormData();
      form.append('avatar', file);
      const d = await api.upload(`/auth/me/partner/${activeCat}/avatar`, form);
      setUser(d.user);
    } catch (err) {
      toast(err.message);
    } finally {
      setPartnerAvatarBusy(false);
    }
  };

  const removePartnerAvatar = async () => {
    setPartnerAvatarBusy(true);
    try {
      const d = await api.del(`/auth/me/partner/${activeCat}/avatar`);
      setUser(d.user);
    } catch (err) {
      toast(err.message);
    } finally {
      setPartnerAvatarBusy(false);
    }
  };

  const pickPartnerIcon = async (id) => {
    setPartnerAvatarBusy(true);
    try {
      const d = await api.patch(`/auth/me/partner/${activeCat}`, { icon: id });
      setUser(d.user);
    } catch (err) {
      toast(err.message);
    } finally {
      setPartnerAvatarBusy(false);
    }
  };

  const replayTutorial = async () => {
    const ok = await confirm({
      icon: <IcPlayCircle size={36} />,
      title: t('profile.tutorialConfirmTitle'),
      message: t('profile.tutorialConfirmMessage'),
      confirmText: t('profile.tutorialStart'),
      danger: false,
      pulse: false,
    });
    if (!ok) return;
    // Start the tour right away (its overlay dims the screen as the confirm
    // dialog closes) instead of flagging it for Home to start once loaded —
    // that showed the plain home page first, then dimmed it, in two jumps.
    tutorial.start();
    // Switch pages once the screen has mostly dimmed, so the swap (and the
    // jump back to the top) happens out of sight.
    setTimeout(() => nav('/app/home'), 280);
  };

  const initial = (displayName(user, lang) || '?').trim().charAt(0).toUpperCase();

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
          <h1 className="h2">{displayName(user, lang)}</h1>
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

      <div className="glass" style={{ padding: 18, marginBottom: 14 }}>
        <h2 className="h2" style={{ marginBottom: 14, fontSize: 17 }}>
          {t('profile.myInfo')}
        </h2>
        <div className="field">
          <label>{t('signup.nicknameTh')}</label>
          <input
            id="pf-nickname"
            className="input"
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value);
              setNameErr((cur) => ({ ...cur, nickname: undefined }));
            }}
            placeholder={t('signup.nicknameThPh')}
            maxLength={40}
            lang="th"
            {...invalidProps('nickname', nameErr)}
          />
          <FieldError id="pf-nickname-err" msg={nameErr.nickname} />
        </div>
        <div className="field">
          <label>{t('signup.nicknameEn')}</label>
          <input
            id="pf-nicknameEn"
            className="input"
            value={nicknameEn}
            onChange={(e) => {
              setNicknameEn(e.target.value);
              setNameErr((cur) => ({ ...cur, nicknameEn: undefined }));
            }}
            placeholder={t('signup.nicknameEnPh')}
            maxLength={40}
            lang="en"
            autoCapitalize="words"
            {...invalidProps('nicknameEn', nameErr)}
          />
          <FieldError id="pf-nicknameEn-err" msg={nameErr.nicknameEn} />
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
              setNameErr((p) => ({ ...p, age: '' }));
            }}
            {...invalidProps('age', nameErr)}
          />
          <FieldError id="pf-age-err" msg={nameErr.age} />
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
        <button className="btn btn--primary btn--sm" onClick={save} disabled={busy} style={{ marginTop: 18 }}>
          {busy ? t('profile.saving') : t('profile.save')}
        </button>
      </div>

      <div className="glass" style={{ padding: 18, marginBottom: 14 }}>
        <h2 className="h2" style={{ marginBottom: 6, fontSize: 17 }}>
          {t('profile.partnerSection')}
        </h2>
        <p className="faint" style={{ marginBottom: 14 }}>
          {t('profile.partnerHint')}
        </p>
        <div className="filter-row" style={{ marginBottom: 16 }}>
          {CATS.map((c) => (
            <button
              key={c}
              type="button"
              className={`pill ${activeCat === c ? 'active' : ''}`}
              onClick={() => setActiveCat(c)}
            >
              {t(`cat.${c}`)}
            </button>
          ))}
        </div>
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
          {t('profile.partnerPicture')}
        </label>
        <p className="faint" style={{ margin: '4px 0 10px' }}>
          {t('profile.partnerPictureHint')}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <div className="avatar-edit">
            <PartnerAvatar
              avatarUrl={user?.partners?.[activeCat]?.avatar_url}
              icon={user?.partners?.[activeCat]?.icon}
              color={partnerColor}
            />
            <button
              type="button"
              className="avatar-edit__btn"
              onClick={pickPartnerAvatar}
              disabled={partnerAvatarBusy}
              aria-label={t('profile.changePhoto')}
            >
              <IcCamera size={14} />
            </button>
            <input
              ref={partnerFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={onPartnerAvatarChange}
            />
          </div>
          {user?.partners?.[activeCat]?.avatar_url && (
            <button className="link-btn" onClick={removePartnerAvatar} disabled={partnerAvatarBusy}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <IcTrash size={13} /> {t('profile.partnerPictureRemove')}
              </span>
            </button>
          )}
        </div>
        <div className="color-swatches" style={{ marginBottom: 18 }}>
          {PARTNER_ICONS.map(({ id, Icon }) => (
            <button
              key={id}
              type="button"
              className={`swatch ${user?.partners?.[activeCat]?.icon === id ? 'sel' : ''}`}
              style={{ background: 'var(--glass)', display: 'grid', placeItems: 'center', color: 'var(--text-dim)' }}
              onClick={() => pickPartnerIcon(id)}
              disabled={partnerAvatarBusy}
              aria-label={id}
            >
              <Icon size={18} />
            </button>
          ))}
        </div>

        <label style={{ fontSize: 14, color: 'var(--text-dim)', paddingLeft: 4 }}>
          {t('answer.color')}
        </label>
        <div className="color-swatches color-swatches--row" style={{ marginTop: 8, marginBottom: 18 }}>
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

        <button className="btn btn--primary btn--sm" onClick={savePartner} disabled={partnerBusy}>
          {partnerBusy ? t('profile.saving') : t('profile.save')}
        </button>
      </div>

      {/* Settings and the DeePer links as two short lists of rows — the
          longer pitches for each live on the page the row opens. */}
      <div className="glass profile-list">
        <h2 className="profile-list-title">{t('profile.settingsGroup')}</h2>
        <div className="profile-row profile-row--static">
          <span className="profile-row-ic">
            <IcTranslate size={17} />
          </span>
          <span className="profile-row-label">{t('profile.language')}</span>
          {/* Both languages on show, the current one lit — clearer here than
              the lone translate icon used on the other pages. */}
          <div className="lang-seg" role="group" aria-label={t('profile.language')}>
            {[
              ['th', 'ไทย'],
              ['en', 'EN'],
            ].map(([code, label]) => (
              <button
                key={code}
                type="button"
                className={lang === code ? 'active' : ''}
                aria-pressed={lang === code}
                onClick={() => setLang(code)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <ProfileRow Icon={IcPlayCircle} label={t('profile.appTutorial')} onClick={replayTutorial} />
        <ProfileRow
          Icon={IcSettings}
          label={t('profile.accountSettings')}
          onClick={() => nav('/app/profile/settings')}
        />
      </div>

      <div className="glass profile-list">
        <h2 className="profile-list-title">DeePer</h2>
        <ProfileRow Icon={IcInstagram} label={t('social.cta')} onClick={() => nav('/app/profile/social')} />
        <ProfileRow Icon={Heart} label={t('support.cta')} accent onClick={() => nav('/app/profile/support')} />
        <ProfileRow Icon={IcChat} label={t('review.cta')} onClick={() => nav('/app/profile/review')} />
        <ProfileRow
          Icon={IcAlertCircle}
          label={t('report.cta')}
          onClick={() => nav('/report', { state: { from: '/app/profile' } })}
        />
      </div>
    </div>
  );
}

// One tappable row in a profile list: icon chip, label, chevron.
function ProfileRow({ Icon, label, onClick, accent = false }) {
  return (
    <button type="button" className={`profile-row${accent ? ' profile-row--accent' : ''}`} onClick={onClick}>
      <span className="profile-row-ic">
        <Icon size={17} />
      </span>
      <span className="profile-row-label">{label}</span>
      <IcBack size={18} className="profile-row-chev" />
    </button>
  );
}
