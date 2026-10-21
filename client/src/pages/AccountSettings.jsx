import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import PasswordField from '../components/PasswordField.jsx';
import PasswordStrength from '../components/PasswordStrength.jsx';
import FieldError from '../components/FieldError.jsx';
import { IcBack, IcTrash, IcHistory } from '../components/icons.jsx';
import { LogOut } from 'lucide-react';
import SaveButton, { useSavedFlash } from '../components/SaveButton.jsx';
import { pwScore } from '../utils/password.js';

export default function AccountSettings() {
  const nav = useNavigate();
  const location = useLocation();
  // Opened straight from a link or after a reload there's no app page to
  // go back to, so fall back to the page this one is opened from.
  const goBack = () => (location.key !== 'default' ? nav(-1) : nav('/app/profile', { replace: true }));
  const { user, setUser, logout, signOut } = useAuth();
  const { t } = useI18n();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  // Typed twice, same as at signup, so a typo can't lock someone out.
  const [newPassword2, setNewPassword2] = useState('');
  const pwMismatch = newPassword2 !== '' && newPassword2 !== newPassword;
  const [pwErr, setPwErr] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  // Brief tick on the button instead of a toast.
  const pwSaved = useSavedFlash();
  const { rules: newPwRules, score: newPwScore, valid: newPwValid } = pwScore(newPassword);

  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteErr, setDeleteErr] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  const savePassword = async (e) => {
    e.preventDefault();
    setPwErr('');
    setPwBusy(true);
    try {
      const d = await api.post('/auth/me/password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setUser(d.user);
      setCurrentPassword('');
      setNewPassword('');
      setNewPassword2('');
      pwSaved.flash();
    } catch (e2) {
      setPwErr(e2.message);
    } finally {
      setPwBusy(false);
    }
  };

  const doLogout = async () => {
    await signOut();
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

  return (
    <div className="page stagger">
      <button className="link back-btn" style={{ alignSelf: 'flex-start', marginBottom: 18 }} onClick={goBack}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IcBack size={20} /> {t('common.back')}
        </span>
      </button>

      <div className="header">
        <h1 className="h1">{t('profile.settingsTitle')}</h1>
        <p className="sub">{t('profile.settingsSub')}</p>
      </div>

      <div className="glass" style={{ padding: 18, marginBottom: 14 }}>
        <h2 className="h2" style={{ marginBottom: 6, fontSize: 17 }}>
          {t('profile.passwordSection')}
        </h2>
        {!user?.has_password && (
          <p className="faint" style={{ marginBottom: 14 }}>
            {t('profile.setPasswordNote')}
          </p>
        )}
        <form onSubmit={savePassword}>
          {user?.has_password && (
            <PasswordField
              label={t('profile.currentPassword')}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          )}
          <PasswordField
            label={t('profile.newPassword')}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <PasswordField
            label={t('signup.confirmPassword')}
            autoComplete="new-password"
            value={newPassword2}
            onChange={(e) => setNewPassword2(e.target.value)}
            invalid={pwMismatch}
            errorId="acc-password2-err"
          >
            <FieldError id="acc-password2-err" msg={pwMismatch ? t('signup.pwMismatch') : ''} />
          </PasswordField>
          {/* Strength bars and the rule checklist after both boxes, as on
              signup, so the two new-password fields sit together. */}
          <div className="signup-pw-strength">
            <PasswordStrength rules={newPwRules} score={newPwScore} />
          </div>
          {pwErr && <div className="err-inline">{pwErr}</div>}
          <SaveButton
            type="submit"
            busy={pwBusy}
            done={pwSaved.done}
            disabled={!newPwValid || newPassword2 !== newPassword || (user?.has_password && !currentPassword)}
            label={user?.has_password ? t('profile.changePassword') : t('profile.setPassword')}
            busyLabel={t('profile.passwordSaving')}
            doneLabel={t('profile.passwordSaved')}
          />
        </form>
      </div>

      {/* Same list rows as Profile, instead of two loose full-width buttons. */}
      <div className="glass profile-list" style={{ marginBottom: 14 }}>
        <button type="button" className="profile-row" onClick={() => nav('/app/profile/login-history')}>
          <span className="profile-row-ic">
            <IcHistory size={17} />
          </span>
          <span className="profile-row-label">{t('profile.loginHistory')}</span>
          <IcBack size={18} className="profile-row-chev" />
        </button>
        <button type="button" className="profile-row" onClick={doLogout}>
          <span className="profile-row-ic">
            <LogOut size={17} />
          </span>
          <span className="profile-row-label">{t('profile.logout')}</span>
        </button>
      </div>

      <div className="glass danger-zone" style={{ padding: 18 }}>
        <h2 className="h2" style={{ marginBottom: 6, fontSize: 17 }}>
          {t('profile.dangerZone')}
        </h2>
        <p className="faint" style={{ marginBottom: 14 }}>
          {t('profile.deleteMsg')}
        </p>
        {/* Outlined here; the filled red is kept for the confirm dialog, so
            this isn't the loudest thing on the page. */}
        <button className="btn btn--danger-outline" onClick={openDelete}>
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
