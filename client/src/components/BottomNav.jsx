import { useLocation, useNavigate } from 'react-router-dom';
import { IcHome, IcBookmark, IcHistory, IcUser } from './icons.jsx';
import { useI18n } from '../store/i18n.jsx';

const TABS = [
  { to: '/app/home', key: 'nav.home', Icon: IcHome, tut: 'navHome' },
  { to: '/app/saved', key: 'nav.saved', Icon: IcBookmark, tut: 'navSaved' },
  { to: '/app/history', key: 'nav.history', Icon: IcHistory, tut: 'navHistory' },
  { to: '/app/profile', key: 'nav.profile', Icon: IcUser, tut: 'navProfile' },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const { t } = useI18n();
  return (
    <nav className="bottom-nav glass glass--red">
      {TABS.map(({ to, key, Icon, tut }) => {
        const active = pathname === to;
        return (
          <button
            key={to}
            className={`nav-item ${active ? 'active' : ''}`}
            data-tut={tut}
            onClick={() => nav(to)}
            aria-label={t(key)}
          >
            <span className="nav-ic">
              <Icon size={24} fill={to === '/app/saved' && active ? 'currentColor' : 'none'} />
            </span>
            {t(key)}
          </button>
        );
      })}
    </nav>
  );
}
