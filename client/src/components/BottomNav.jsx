import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { IcHome, IcBookmark, IcHistory, IcUser } from './icons.jsx';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import { prefetchLists } from '../utils/listCache.js';
import TestBadge from './TestBadge.jsx';

const TABS = [
  { to: '/app/home', key: 'nav.home', Icon: IcHome, tut: 'navHome' },
  { to: '/app/saved', key: 'nav.saved', Icon: IcBookmark, tut: 'navSaved' },
  { to: '/app/history', key: 'nav.history', Icon: IcHistory, tut: 'navHistory' },
  { to: '/app/profile', key: 'nav.profile', Icon: IcUser, tut: 'navProfile' },
];

// A bar along the bottom on phones, a labelled sidebar on computers. `deskOnly`
// is for the pages under Profile, which show no nav on phones.
export default function BottomNav({ deskOnly = false }) {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const { t } = useI18n();
  const { user } = useAuth();
  // Load Saved/History ahead of the first tap so those tabs open instantly.
  useEffect(() => prefetchLists(user?.id), [user?.id]);
  return (
    <nav className={`bottom-nav glass glass--red${deskOnly ? ' bottom-nav--desk-only' : ''}`}>
      <div className="brand-mark nav-brand">
        <span className="dot" />
        <span className="nav-brand-name">DeePer</span>
        <TestBadge />
      </div>
      {TABS.map(({ to, key, Icon, tut }) => {
        const active = pathname === to || pathname.startsWith(`${to}/`);
        return (
          <button
            key={to}
            className={`nav-item ${active ? 'active' : ''}`}
            data-tut={tut}
            onClick={() => nav(to)}
            // Icon-only tabs: the label lives here (and as a tooltip) only.
            aria-label={t(key)}
            aria-current={active ? 'page' : undefined}
            title={t(key)}
          >
            <span className="nav-ic">
              <Icon size={28} fill={to === '/app/saved' && active ? 'currentColor' : 'none'} />
            </span>
            <span className="nav-label">{t(key)}</span>
          </button>
        );
      })}
    </nav>
  );
}
