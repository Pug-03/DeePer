import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { adminApi, getAdminToken, setAdminToken, AdminAuthError } from '../admin/adminApi.js';
import { Loading, ErrorState } from '../components/ui.jsx';

// Owner-only back office at /admin (not linked from anywhere in the app).
// Thai-only on purpose: its one reader is the maintainer.

const REPORT_LABEL = { bug: 'บัค', problem: 'ใช้งานติดขัด', idea: 'ข้อเสนอแนะ' };

// DB timestamps are UTC "YYYY-MM-DD HH:MM:SS"; show them in Bangkok time.
function fmtTime(s) {
  if (!s) return '';
  return new Date(`${s.replace(' ', 'T')}Z`).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

// Runs a loader, re-running on demand; an expired admin session logs out.
function useAdminData(load, onLogout) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    setError('');
    try {
      setData(await load());
    } catch (e) {
      if (e instanceof AdminAuthError) onLogout();
      else setError(e.message);
    }
  }, [load, onLogout]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, error, reload };
}

// Signing in happens on the regular /login page (admin credentials there
// set the admin token and land here); without one, go back to it.
export default function Admin() {
  const [token, setToken] = useState(getAdminToken());
  const logout = useCallback(() => {
    setAdminToken(null);
    setToken(null);
  }, []);
  return token ? <AdminDashboard onLogout={logout} /> : <Navigate to="/login" replace />;
}

function AdminDashboard({ onLogout }) {
  const [tab, setTab] = useState('overview');
  const { data: stats, error, reload } = useAdminData(adminApi.stats, onLogout);

  const tabs = [
    { key: 'overview', label: 'ภาพรวม' },
    { key: 'reports', label: 'แจ้งปัญหา', badge: stats?.reports_open },
    { key: 'proofs', label: 'ผู้สนับสนุน', badge: stats?.proofs_pending },
  ];

  return (
    <div className="page admin">
      <div className="row-between" style={{ marginBottom: 18 }}>
        <h1 className="h1" style={{ margin: 0 }}>แอดมิน DeePer</h1>
        <button className="link" type="button" onClick={onLogout}>
          ออกจากระบบ
        </button>
      </div>

      <div className="filter-row">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`pill ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.badge > 0 && <span className="admin-badge">{t.badge}</span>}
          </button>
        ))}
      </div>

      {tab === 'overview' &&
        (error ? <ErrorState message={error} onRetry={reload} /> : stats ? <Overview stats={stats} /> : <Loading />)}
      {tab === 'reports' && <Reports onLogout={onLogout} onChange={reload} />}
      {tab === 'proofs' && <Proofs onLogout={onLogout} onChange={reload} />}
    </div>
  );
}

function Overview({ stats }) {
  const tiles = [
    ['คนใช้งานวันนี้', stats.active_today],
    ['สมัครใหม่วันนี้', stats.signups_today],
    ['เข้าสู่ระบบวันนี้', stats.logins_today],
    ['ตอบคำถามวันนี้', stats.answers_today],
    ['ผู้ใช้ทั้งหมด', stats.users_total],
    ['แจ้งปัญหาที่ยังไม่แก้', stats.reports_open],
  ];
  return (
    <>
      <div className="admin-tiles">
        {tiles.map(([label, value]) => (
          <div key={label} className="glass admin-tile">
            <span className="admin-tile-value">{value.toLocaleString('th-TH')}</span>
            <span className="admin-tile-label">{label}</span>
          </div>
        ))}
      </div>
      <ActiveChart days={stats.days} />
      <p className="admin-note">
        "คนใช้งาน" นับคนที่ล็อกอินแล้วเปิดแอปในวันนั้น (เวลาไทย) ไม่รวมคนที่ยังไม่ล็อกอิน
      </p>
    </>
  );
}

// Daily active users, last 14 days — single series, so no legend; the
// title names it and each bar shows its exact value on hover/tap.
function ActiveChart({ days }) {
  const max = Math.max(1, ...days.map((d) => d.active));
  const label = (day) => new Date(`${day}T00:00:00Z`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return (
    <div className="glass admin-chart">
      <p className="admin-chart-title">คนใช้งานต่อวัน (14 วันล่าสุด)</p>
      <div className="admin-bars" role="img" aria-label="กราฟจำนวนคนใช้งานต่อวัน">
        {days.map((d) => (
          <div key={d.day} className="admin-bar-slot" tabIndex={0}>
            <span className="admin-bar-tip">
              {label(d.day)}: {d.active} คน · สมัครใหม่ {d.signups}
            </span>
            <span className="admin-bar" style={{ height: `${(d.active / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="admin-axis">
        <span>{label(days[0].day)}</span>
        <span>วันนี้</span>
      </div>
    </div>
  );
}

function Reports({ onLogout, onChange }) {
  const { data, error, reload } = useAdminData(adminApi.reports, onLogout);
  const [filter, setFilter] = useState('open');
  const [shots, setShots] = useState({});

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const act = async (id, action) => {
    try {
      await adminApi.setReport(id, action);
      reload();
      onChange();
    } catch (e) {
      if (e instanceof AdminAuthError) onLogout();
    }
  };
  const showShot = async (id) => {
    try {
      const blob = await adminApi.screenshot(id);
      setShots((s) => ({ ...s, [id]: URL.createObjectURL(blob) }));
    } catch (e) {
      if (e instanceof AdminAuthError) onLogout();
    }
  };

  const list = data.reports.filter((r) =>
    filter === 'all' ? true : filter === 'open' ? !r.resolved_at : !!r.resolved_at,
  );

  return (
    <>
      <div className="filter-row">
        {[
          ['open', 'ยังไม่แก้'],
          ['done', 'แก้แล้ว'],
          ['all', 'ทั้งหมด'],
        ].map(([k, l]) => (
          <button key={k} type="button" className={`pill ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>
            {l}
          </button>
        ))}
      </div>
      {list.length === 0 && <p className="admin-note">ไม่มีรายการ</p>}
      {list.map((r) => (
        <div key={r.id} className="glass admin-card">
          <div className="admin-card-head">
            <span className={`admin-tag admin-tag--${r.category}`}>{REPORT_LABEL[r.category] || r.category}</span>
            <span className="admin-meta">
              #{r.id} · {fmtTime(r.created_at)}
            </span>
          </div>
          <p className="admin-message">{r.message}</p>
          <dl className="admin-dl">
            <dt>จาก</dt>
            <dd>{r.nickname ? `${r.nickname} (${r.email || 'ไม่มีอีเมล'})` : 'ผู้ใช้ที่ยังไม่ล็อกอิน'}</dd>
            {r.contact && (
              <>
                <dt>ติดต่อกลับ</dt>
                <dd>{r.contact}</dd>
              </>
            )}
            {r.page && (
              <>
                <dt>หน้า</dt>
                <dd>{r.page}</dd>
              </>
            )}
            <dt>อุปกรณ์</dt>
            <dd className="admin-ua">{r.user_agent || 'ไม่ทราบ'}</dd>
          </dl>
          {r.has_screenshot &&
            (shots[r.id] ? (
              <a href={shots[r.id]} target="_blank" rel="noreferrer">
                <img className="admin-img" src={shots[r.id]} alt="รูปหน้าจอ" />
              </a>
            ) : (
              <button className="link admin-inline-btn" type="button" onClick={() => showShot(r.id)}>
                ดูรูปหน้าจอ
              </button>
            ))}
          <button
            className={`btn ${r.resolved_at ? 'btn--ghost' : 'btn--primary'} admin-action`}
            type="button"
            onClick={() => act(r.id, r.resolved_at ? 'reopen' : 'resolve')}
          >
            {r.resolved_at ? `แก้แล้ว ${fmtTime(r.resolved_at)} · เปิดใหม่` : 'ทำเครื่องหมายว่าแก้แล้ว'}
          </button>
        </div>
      ))}
    </>
  );
}

function Proofs({ onLogout, onChange }) {
  const { data, error, reload } = useAdminData(adminApi.proofs, onLogout);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const act = async (id, action) => {
    try {
      await adminApi.setProof(id, action);
      reload();
      onChange();
    } catch (e) {
      if (e instanceof AdminAuthError) onLogout();
    }
  };

  return (
    <>
      <p className="admin-note">ตรวจสลิปว่ายอดและเวลาตรงกับที่โอนเข้าจริง แล้วกดอนุมัติ ชื่อจะขึ้นในระดับ "เพื่อนของ DeePer" บนหน้าเว็บทันที</p>
      {data.proofs.length === 0 && <p className="admin-note">ยังไม่มีคนส่งหลักฐาน</p>}
      {data.proofs.map((p) => (
        <div key={p.id} className="glass admin-card">
          <div className="admin-card-head">
            <span className="admin-proof-name">{p.display_name}</span>
            <span className={`admin-tag ${p.approved_at ? 'admin-tag--ok' : 'admin-tag--wait'}`}>
              {p.approved_at ? 'ขึ้นหน้าเว็บแล้ว' : 'รออนุมัติ'}
            </span>
          </div>
          <dl className="admin-dl">
            <dt>จำนวนเงิน</dt>
            <dd>{p.amount != null ? `${p.amount.toLocaleString('th-TH')} บาท` : 'ไม่ระบุ'}</dd>
            <dt>โอนเมื่อ</dt>
            <dd>
              {p.transfer_date} {p.transfer_time}
            </dd>
            <dt>ส่งเมื่อ</dt>
            <dd>{fmtTime(p.created_at)}</dd>
            <dt>บัญชี</dt>
            <dd>{p.nickname ? `${p.nickname} (${p.email || 'ไม่มีอีเมล'})` : 'ไม่ทราบ'}</dd>
          </dl>
          <a href={p.slip_path} target="_blank" rel="noreferrer">
            <img className="admin-img" src={p.slip_path} alt={`สลิปของ ${p.display_name}`} />
          </a>
          <button
            className={`btn ${p.approved_at ? 'btn--ghost' : 'btn--primary'} admin-action`}
            type="button"
            onClick={() => act(p.id, p.approved_at ? 'revoke' : 'approve')}
          >
            {p.approved_at ? 'ซ่อนชื่อออกจากหน้าเว็บ' : 'อนุมัติ ให้ชื่อขึ้นหน้าเว็บ'}
          </button>
        </div>
      ))}
    </>
  );
}
