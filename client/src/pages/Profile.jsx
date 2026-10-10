import { useRef, useState } from 'react';
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
  IcInstagram,
  IcPlayCircle,
  IcSettings,
  IcTranslate,
  IcTrash,
  IcUser,
} from '../components/icons.jsx';
import { Heart, HeartHandshake, Layers } from 'lucide-react';
import { LEVEL_OPTIONS, getQuestionLevel, setQuestionLevel } from '../utils/questionLevel.js';
import { AVATAR_MAX_BYTES, AVATAR_TYPES } from '../utils/avatar.js';
import { useTutorial } from '../store/tutorial.jsx';
import { displayName } from '../util.js';

export default function Profile() {
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const tutorial = useTutorial();
  const { user, setUser } = useAuth();
  const { t, lang, setLang } = useI18n();

  const [avatarBusy, setAvatarBusy] = useState(false);
  const fileInputRef = useRef(null);

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

      {/* Short lists of rows; each opens its own page (editing forms, longer
          pitches) so this page stays a tidy overview. */}
      <div className="glass profile-list">
        <h2 className="profile-list-title">{t('profile.aboutGroup')}</h2>
        <ProfileRow Icon={IcUser} label={t('profile.myInfo')} onClick={() => nav('/app/profile/info')} />
        <ProfileRow
          Icon={HeartHandshake}
          label={t('profile.partnerSection')}
          onClick={() => nav('/app/profile/partner')}
        />
      </div>

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
        <QuestionLevelRow t={t} />
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

// How deep the home deck's questions go. Its own row, stacked (label over
// the four options) since four choices don't fit beside the label like the
// language switch does.
function QuestionLevelRow({ t }) {
  const [level, setLevel] = useState(getQuestionLevel);
  const choose = (v) => {
    setLevel(v);
    setQuestionLevel(v);
  };
  return (
    <div className="profile-row profile-row--static profile-row--stack">
      <div className="profile-row-head">
        <span className="profile-row-ic">
          <Layers size={17} />
        </span>
        <span className="profile-row-label">{t('home.levelLabel')}</span>
      </div>
      <div className="lang-seg level-seg" role="radiogroup" aria-label={t('home.levelLabel')}>
        {LEVEL_OPTIONS.map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={level === v}
            className={level === v ? 'active' : ''}
            onClick={() => choose(v)}
          >
            {t(`home.level.${v}`)}
          </button>
        ))}
      </div>
      <p className="profile-row-hint">{t('home.levelHint')}</p>
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
