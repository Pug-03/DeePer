import { useState } from 'react';
import { useI18n } from '../store/i18n.jsx';
import { DEV_TEAM } from '../dev-team-info.js';
import { unbreakablePhrases } from '../utils/phrases.jsx';

// Who this page is about, at the top of each team member's awards page:
// the visitor arrives here by tapping a name on the landing page, so say
// whose page it is before listing anything.
export default function DevProfile({ href }) {
  const { lang } = useI18n();
  const [imgFailed, setImgFailed] = useState(false);
  const dev = DEV_TEAM.find((d) => d.awardsHref === href);
  if (!dev) return null;
  const name = (lang === 'en' ? dev.nameEn : dev.nameTh) || dev.nameTh;
  const otherName = lang === 'en' ? dev.nameTh : dev.nameEn;
  const role = (lang === 'en' ? dev.roleEn : dev.roleTh) || dev.roleTh;
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('');

  return (
    <div className="dev-profile">
      {dev.avatar && !imgFailed ? (
        <img
          className="dev-profile-photo"
          src={dev.avatar}
          alt=""
          style={{ objectPosition: dev.avatarPosition || 'center' }}
          onError={() => setImgFailed(true)}
          draggable={false}
        />
      ) : (
        <span className="supporter-avatar dev-profile-photo">{initials}</span>
      )}
      <h1 className="dev-profile-name">{name}</h1>
      {otherName && otherName !== name && <p className="dev-profile-alt">{otherName}</p>}
      <p className="dev-profile-role">{unbreakablePhrases(role)}</p>
    </div>
  );
}
