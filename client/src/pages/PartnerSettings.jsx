import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import { useToast } from '../components/ui.jsx';
import { IcBack, IcCamera, IcCheck, IcTrash } from '../components/icons.jsx';
import { AVATAR_MAX_BYTES, AVATAR_TYPES } from '../utils/avatar.js';
import { PARTNER_ICONS } from '../utils/partnerIcons.js';
import PartnerAvatar from '../components/PartnerAvatar.jsx';
import { CATS } from '../util.js';

const COLORS = ['#f43f5e', '#fb923c', '#eab308', '#34d399', '#38bdf8', '#a78bfa', '#f472b6'];

// The other person in each category (name, picture or icon, colour), edited
// on its own page opened from Profile.
export default function PartnerSettings() {
  const nav = useNavigate();
  const toast = useToast();
  const { user, setUser } = useAuth();
  const { t } = useI18n();

  const [activeCat, setActiveCat] = useState(CATS[0]);
  const [partnerName, setPartnerName] = useState('');
  const [partnerColor, setPartnerColor] = useState('#f43f5e');
  const [partnerBusy, setPartnerBusy] = useState(false);
  const [partnerAvatarBusy, setPartnerAvatarBusy] = useState(false);
  const partnerFileInputRef = useRef(null);

  // Each category has its own partner — reload the name/color draft
  // whenever the selected tab (or the underlying user data) changes.
  useEffect(() => {
    const p = user?.partners?.[activeCat];
    setPartnerName(p?.name || '');
    setPartnerColor(p?.color || '#f43f5e');
  }, [activeCat, user]);

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

  return (
    <div className="page stagger">
      <button className="link back-btn" style={{ alignSelf: 'flex-start', marginBottom: 18 }} onClick={() => nav(-1)}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IcBack size={20} /> {t('common.back')}
        </span>
      </button>

      <div className="header">
        <h1 className="h1">{t('profile.partnerSection')}</h1>
        <p className="sub">{t('profile.partnerHint')}</p>
      </div>

      <div className="glass" style={{ padding: 18 }}>
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
          <label htmlFor="pt-name">{t('answer.partnerName')}</label>
          <input
            id="pt-name"
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

        <button className="btn btn--primary" onClick={savePartner} disabled={partnerBusy}>
          {partnerBusy ? t('profile.saving') : t('profile.save')}
        </button>
      </div>
    </div>
  );
}
