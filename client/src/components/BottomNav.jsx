import { useLocation, useNavigate } from 'react-router-dom';
import { IcHome, IcBookmark, IcHistory, IcUser } from './icons.jsx';

const TABS = [
  { to: '/app/home', label: 'หน้าหลัก', Icon: IcHome },
  { to: '/app/saved', label: 'บันทึกไว้', Icon: IcBookmark },
  { to: '/app/history', label: 'ประวัติ', Icon: IcHistory },
  { to: '/app/profile', label: 'โปรไฟล์', Icon: IcUser },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  return (
    <nav className="bottom-nav glass glass--red">
      {TABS.map(({ to, label, Icon }) => {
        const active = pathname === to;
        return (
          <button
            key={to}
            className={`nav-item ${active ? 'active' : ''}`}
            onClick={() => nav(to)}
            aria-label={label}
          >
            <span className="nav-ic">
              <Icon size={24} fill={to === '/app/saved' && active ? 'currentColor' : 'none'} />
            </span>
            {label}
          </button>
        );
      })}
    </nav>
  );
}
