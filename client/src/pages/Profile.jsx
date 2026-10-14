import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import { useConfirm } from '../components/ui.jsx';
import {
  IcAlertCircle,
  IcBack,
  IcChat,
  IcInstagram,
  IcPlayCircle,
  IcSettings,
  IcTranslate,
  IcUser,
} from '../components/icons.jsx';
import { Building2, Heart, HeartHandshake, Layers, ShieldCheck } from 'lucide-react';
import { LEVEL_OPTIONS, getQuestionLevel, setQuestionLevel } from '../utils/questionLevel.js';
import { useElasticIndicator } from '../utils/elasticIndicator.js';
import { useTutorial } from '../store/tutorial.jsx';
import { displayName } from '../util.js';
import { useLaunch } from '../launch.js';

export default function Profile() {
  const nav = useNavigate();
  const confirm = useConfirm();
  const tutorial = useTutorial();
  const { user } = useAuth();
  const { t, lang, setLang } = useI18n();
  // Before launch the report row doubles as the testers' feedback line.
  const { launched } = useLaunch();

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
        <div
          className="avatar avatar--lg"
          style={{
            flexShrink: 0,
            ...(user?.avatar_url && {
              backgroundImage: `url("${user.avatar_url}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }),
          }}
        >
          {!user?.avatar_url && initial}
        </div>
        <div className="profile-header-info">
          <h1 className="h2">{displayName(user, lang)}</h1>
          <p className="faint" style={{ margin: '4px 0 0' }}>
            {user?.email || t('common.googleAccount')} {user?.via_google ? '· Google' : ''}
          </p>
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
        <LanguageRow t={t} lang={lang} setLang={setLang} />
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
        {/* Organisations: the same sponsor form as the landing page's footer,
            which signed-in people otherwise never see. */}
        <ProfileRow Icon={Building2} label={t('sponsorForm.cta')} onClick={() => nav('/sponsor')} />
        <ProfileRow Icon={IcChat} label={t('review.cta')} onClick={() => nav('/app/profile/review')} />
        <ProfileRow
          Icon={IcAlertCircle}
          label={launched ? t('report.cta') : t('beta.feedbackRow')}
          onClick={() => nav('/report', { state: { from: '/app/profile' } })}
        />
        <ProfileRow Icon={ShieldCheck} label={t('privacy.link')} onClick={() => nav('/privacy')} />
      </div>
    </div>
  );
}

// Language switch: both languages on show, the current one lit — clearer
// here than the lone translate icon used on the other pages. Same sliding
// capsule as the question-depth row below it.
const LANG_OPTIONS = [
  ['th', 'ไทย'],
  ['en', 'EN'],
];
function LanguageRow({ t, lang, setLang }) {
  const ind = useElasticIndicator(lang, setLang);
  return (
    <div className="profile-row profile-row--static">
      <span className="profile-row-ic">
        <IcTranslate size={17} />
      </span>
      <span className="profile-row-label">{t('profile.language')}</span>
      <div
        ref={ind.rowRef}
        className="lang-seg lang-seg--elastic"
        role="radiogroup"
        aria-label={t('profile.language')}
        {...ind.dragHandlers}
      >
        <motion.span className="level-seg-bg" style={ind.style} />
        {LANG_OPTIONS.map(([code, label]) => {
          const isActive = lang === code;
          return (
            <button
              key={code}
              ref={ind.itemRef(code)}
              data-pick={code}
              type="button"
              role="radio"
              aria-checked={isActive}
              className={isActive ? 'active' : ''}
              onClick={() => setLang(code)}
            >
              <motion.span
                key={isActive ? 'on' : 'off'}
                className="pill-label"
                initial={isActive ? { scale: 0.82 } : false}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 14 }}
              >
                {label}
              </motion.span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// How deep the home deck's questions go. Its own row, stacked (label over
// the four options) since four choices don't fit beside the label like the
// language switch does. The active capsule slides elastically like Home's
// category tabs.
function QuestionLevelRow({ t }) {
  const [level, setLevel] = useState(getQuestionLevel);
  const choose = (v) => {
    if (v === level) return;
    setLevel(v);
    setQuestionLevel(v);
  };
  const ind = useElasticIndicator(level, choose);

  return (
    <div className="profile-row profile-row--static profile-row--stack">
      <div className="profile-row-head">
        <span className="profile-row-ic">
          <Layers size={17} />
        </span>
        <span className="profile-row-label">{t('home.levelLabel')}</span>
      </div>
      <div
        ref={ind.rowRef}
        className="lang-seg level-seg"
        role="radiogroup"
        aria-label={t('home.levelLabel')}
        {...ind.dragHandlers}
      >
        <motion.span className="level-seg-bg" style={ind.style} />
        {LEVEL_OPTIONS.map((v) => {
          const isActive = level === v;
          return (
            <button
              key={v}
              ref={ind.itemRef(v)}
              data-pick={v}
              type="button"
              role="radio"
              aria-checked={isActive}
              className={isActive ? 'active' : ''}
              onClick={() => choose(v)}
            >
              <motion.span
                key={isActive ? 'on' : 'off'}
                className="pill-label"
                initial={isActive ? { scale: 0.82 } : false}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 14 }}
              >
                {t(`home.level.${v}`)}
              </motion.span>
            </button>
          );
        })}
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
