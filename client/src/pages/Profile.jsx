import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import { useToast } from '../components/ui.jsx';
import LangToggle from '../components/LangToggle.jsx';
import PasswordField from '../components/PasswordField.jsx';
import { IcCheck, IcTrash } from '../components/icons.jsx';

const GENDER_VALUES = ['', 'female', 'male', 'other', 'prefer_not'];
const COLORS = ['#f43f5e', '#fb923c', '#eab308', '#34d399', '#38bdf8', '#a78bfa', '#f472b6'];

export default function Profile() {
  const nav = useNavigate();
  const toast = useToast();
  const { user, setUser, logout } = useAuth();
  const { t } = useI18n();

  const [nickname, setNickname] = useState(user?.nickname || '');
  const [age, setAge] = useState(user?.age || '');
  const [gender, setGender] = useState(user?.gender || '');
  const [partnerName, setPartnerName] = useState(user?.partner_name || t('answer.partnerDefault'));
  const [partnerColor, setPartnerColor] = useState(user?.partner_color || '#f43f5e');
  const [busy, setBusy] = useState(false);

  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteErr, setDeleteErr] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

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

  const doLogout = () => {
    logout();
    nav('/', { replace: true });
  };

  const openDelete = () => {
    setDeletePassword('');
    setDeleteErr('');
    setShowDelete(true);
  };

  const confirmDelete = async (e) => {
    e.preventDefault();
    setDeleteErr('');
    setDeleteBusy(true);
    try {
      await api.del('/auth/me', { body: { password: deletePassword } });
      logout();
      nav('/', { replace: true });
    } catch (e2) {
      setDeleteErr(e2.message);
    } finally {
      setDeleteBusy(false);
    }
  };

  const initial = (user?.nickname || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="page page--tab">
      <div className="center" style={{ marginBottom: 22 }}>
        <div className="avatar" style={{ margin: '0 auto 12px' }}>
          {initial}
        </div>
        <h1 className="h2">{user?.nickname}</h1>
        <p className="faint">
          {user?.email || t('common.googleAccount')} {user?.via_google ? '· Google' : ''}
        </p>
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

      <div className="stack">
        <button className="btn btn--primary" onClick={save} disabled={busy}>
          {busy ? t('profile.saving') : t('profile.save')}
        </button>
        <button className="btn btn--ghost" onClick={doLogout}>
          {t('profile.logout')}
        </button>
      </div>

      <div className="glass" style={{ padding: 18, marginTop: 18, borderColor: 'rgba(239, 68, 68, 0.3)' }}>
        <h2 className="h2" style={{ marginBottom: 6, fontSize: 17 }}>
          {t('profile.dangerZone')}
        </h2>
        <p className="faint" style={{ marginBottom: 14 }}>
          {t('profile.deleteMsg')}
        </p>
        <button className="btn btn--danger" onClick={openDelete}>
          <IcTrash size={18} /> {t('profile.deleteAccount')}
        </button>
      </div>

      {showDelete && (
        <div className="modal-overlay fade-in" onClick={() => !deleteBusy && setShowDelete(false)}>
          <form
            className="modal glass glass--red pop-in"
            onClick={(e) => e.stopPropagation()}
            onSubmit={confirmDelete}
          >
            <div className="modal-icon">
              <IcTrash size={32} />
            </div>
            <h3 className="modal-title">{t('profile.deleteTitle')}</h3>
            <p className="modal-msg">{t('profile.deleteMsg')}</p>

            {user?.has_password && (
              <PasswordField
                label={t('login.password')}
                autoComplete="current-password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                autoFocus
                required
              />
            )}
            {deleteErr && <div className="err-inline">{deleteErr}</div>}

            <div className="modal-actions" style={{ marginTop: deleteErr ? 14 : 6 }}>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setShowDelete(false)}
                disabled={deleteBusy}
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="btn btn--danger"
                disabled={deleteBusy || (user?.has_password && !deletePassword)}
              >
                {deleteBusy ? t('profile.deleting') : t('profile.deleteConfirm')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
