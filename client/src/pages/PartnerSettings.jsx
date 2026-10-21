import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import { useToast, useConfirm } from '../components/ui.jsx';
import { IcBack, IcCamera, IcTrash } from '../components/icons.jsx';
import SaveButton, { useSavedFlash } from '../components/SaveButton.jsx';
import { AVATAR_MAX_BYTES, AVATAR_TYPES } from '../utils/avatar.js';
import { shrinkImage, AVATAR_SIDE } from '../utils/shrinkImage.js';
import { PARTNER_ICONS } from '../utils/partnerIcons.js';
import PartnerAvatar from '../components/PartnerAvatar.jsx';
import { CATS } from '../util.js';
import { useElasticIndicator } from '../utils/elasticIndicator.js';

const COLORS = ['#f43f5e', '#fb923c', '#eab308', '#34d399', '#38bdf8', '#a78bfa', '#f472b6'];

// The other person in each category (name, picture or icon, colour), edited
// on its own page opened from Profile.
export default function PartnerSettings() {
  const nav = useNavigate();
  const location = useLocation();
  // Opened straight from a link or after a reload there's no app page to
  // go back to, so fall back to the page this one is opened from.
  const goBack = () => (location.key !== 'default' ? nav(-1) : nav('/app/profile', { replace: true }));
  const toast = useToast();
  const { user, setUser } = useAuth();
  const { t } = useI18n();

  const confirm = useConfirm();
  const [activeCat, setActiveCat] = useState(CATS[0]);
  // Unsaved name/colour edits, kept per category. Only what's been typed
  // or picked lives here; anything else reads from the saved partner. So
  // switching tabs, or picking an icon/photo (which saves right away and
  // refreshes the user), never wipes an edit that hasn't been saved yet.
  const [drafts, setDrafts] = useState({});
  const [partnerBusy, setPartnerBusy] = useState(false);
  const [partnerAvatarBusy, setPartnerAvatarBusy] = useState(false);
  const partnerFileInputRef = useRef(null);

  const saved = (c) => ({
    // The stored Thai default shows as an empty box with the default as its
    // placeholder, so it reads right in either language.
    name: user?.partners?.[c]?.name === 'อีกฝ่าย' ? '' : user?.partners?.[c]?.name || '',
    color: user?.partners?.[c]?.color || '#a78bfa',
  });
  const current = (c) => ({ ...saved(c), ...drafts[c] });
  const isDirty = (c) => {
    const s0 = saved(c);
    const cur = current(c);
    return cur.name.trim() !== s0.name || cur.color !== s0.color;
  };
  const { name: partnerName, color: partnerColor } = current(activeCat);
  const setDraft = (patch) => setDrafts((d) => ({ ...d, [activeCat]: { ...d[activeCat], ...patch } }));
  const setPartnerName = (name) => setDraft({ name });
  const setPartnerColor = (color) => setDraft({ color });

  const catInd = useElasticIndicator(activeCat, setActiveCat);
  // Brief tick on the save button instead of a toast.
  const savedFlash = useSavedFlash();

  const savePartner = async () => {
    setPartnerBusy(true);
    const cat = activeCat;
    try {
      const d = await api.patch(`/auth/me/partner/${cat}`, {
        name: partnerName,
        color: partnerColor,
      });
      setUser(d.user);
      setDrafts(({ [cat]: _done, ...rest }) => rest);
      savedFlash.flash();
    } catch (e) {
      toast(e.message);
    } finally {
      setPartnerBusy(false);
    }
  };

  const pickPartnerAvatar = () => partnerFileInputRef.current?.click();

  const onPartnerAvatarChange = async (e) => {
    // The tab the photo was picked on, before the shrink below gives time to
    // switch tabs (it used to upload to whichever tab was open by then).
    const cat = activeCat;
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    if (!AVATAR_TYPES.includes(picked.type)) {
      toast(t('err.AVATAR_TYPE_INVALID'));
      return;
    }
    const file = await shrinkImage(picked, AVATAR_SIDE);
    if (file.size > AVATAR_MAX_BYTES) {
      toast(t('err.AVATAR_TOO_LARGE'));
      return;
    }
    setPartnerAvatarBusy(true);
    try {
      const form = new FormData();
      form.append('avatar', file);
      const d = await api.upload(`/auth/me/partner/${cat}/avatar`, form);
      setUser(d.user);
    } catch (err) {
      toast(err.message);
    } finally {
      setPartnerAvatarBusy(false);
    }
  };

  const removePartnerAvatar = async () => {
    const ok = await confirm({ message: t('confirm.partnerAvatarMsg') });
    if (!ok) return;
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
      <button className="link back-btn" style={{ alignSelf: 'flex-start', marginBottom: 18 }} onClick={goBack}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IcBack size={20} /> {t('common.back')}
        </span>
      </button>

      <div className="header">
        <h1 className="h1">{t('profile.partnerSection')}</h1>
        <p className="sub">{t('profile.partnerHint')}</p>
      </div>

      <div className="glass" style={{ padding: 18 }}>
        <div
          className="filter-row filter-row--elastic filter-row--fill"
          style={{ marginBottom: 16 }}
          ref={catInd.rowRef}
          {...catInd.dragHandlers}
        >
          <motion.span className="filter-row-bg" style={catInd.style} />
          {CATS.map((c) => {
            const isActive = activeCat === c;
            return (
              <button
                key={c}
                ref={catInd.itemRef(c)}
                data-pick={c}
                type="button"
                className={`pill ${isActive ? 'active' : ''}`}
                onClick={() => setActiveCat(c)}
              >
                <motion.span
                  key={isActive ? 'on' : 'off'}
                  className="pill-label"
                  initial={isActive ? { scale: 0.82 } : false}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 14 }}
                >
                  {t(`cat.${c}`)}
                  {/* Edits on this tab that haven't been saved yet. */}
                  {isDirty(c) && (
                    <span className="pill-dot" role="img" aria-label={t('profile.unsavedSwitch')} />
                  )}
                </motion.span>
              </button>
            );
          })}
        </div>
        <div className="field">
          <label htmlFor="pt-name">{t('answer.partnerName')}</label>
          <input
            id="pt-name"
            className="input"
            value={partnerName}
            placeholder={t('answer.partnerDefault')}
            onChange={(e) => setPartnerName(e.target.value)}
            maxLength={30}
          />
        </div>
        <label style={{ fontSize: 14, color: 'var(--text-dim)', paddingLeft: 4 }}>
          {t('profile.partnerPicture')}
        </label>
        <p className="faint" style={{ margin: '4px 0 10px', paddingLeft: 4 }}>
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
        <div className="icon-swatches" style={{ marginBottom: 18 }}>
          {PARTNER_ICONS.map(({ id, Icon }) => (
            <button
              key={id}
              type="button"
              className={`swatch ${user?.partners?.[activeCat]?.icon === id ? 'sel' : ''}`}
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
              type="button"
              className={`swatch ${partnerColor === c ? 'sel' : ''}`}
              style={{ background: c }}
              onClick={() => setPartnerColor(c)}
              aria-label={c}
            />
          ))}
        </div>

        <SaveButton
          onClick={savePartner}
          busy={partnerBusy}
          done={savedFlash.done}
          disabled={!isDirty(activeCat)}
          label={t('profile.save')}
          busyLabel={t('profile.saving')}
          doneLabel={t('profile.saved')}
        />
      </div>
    </div>
  );
}
