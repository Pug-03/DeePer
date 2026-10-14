import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { adminApi, getAdminToken, setAdminToken, AdminAuthError } from '../admin/adminApi.js';
import { Loading, ErrorState, useConfirm, useToast } from '../components/ui.jsx';
import { SPONSORS } from '../sponsors-info.js';
import { useI18n } from '../store/i18n.jsx';
import { CATS } from '../util.js';
import { IcTrash } from '../components/icons.jsx';
import { keepWord } from '../utils/thai.js';

// Owner-only back office at /admin (not linked from anywhere in the app).
// Thai-only on purpose: its one reader is the maintainer.

const REPORT_LABEL = { bug: 'บัค', problem: 'ใช้งานติดขัด', idea: 'ข้อเสนอแนะ' };
const TIER_LABEL = { high: 'ระดับทอง', medium: 'ระดับเงิน', general: 'ระดับทองแดง' };
const TIERS = Object.keys(TIER_LABEL);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOURCE_LABEL = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  line: 'LINE',
  google: 'Google',
  x: 'X (Twitter)',
  direct: 'พิมพ์ลิงก์เอง / ไม่ทราบที่มา',
};

// DB timestamps are UTC "YYYY-MM-DD HH:MM:SS"; show them in Bangkok time.
// The slip's own date/time ("2026-10-12" + "10:30") in the same Thai style
// as the other times on the card, so the two can be compared at a glance.
function fmtTransfer(date, time) {
  if (!date) return '-';
  const d = new Date(`${date}T${time || '00:00'}:00+07:00`);
  if (isNaN(d)) return `${date} ${time || ''}`;
  return d.toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: time ? '2-digit' : undefined,
    minute: time ? '2-digit' : undefined,
    timeZone: 'Asia/Bangkok',
  });
}

// "Chrome 141 · iPhone" out of a raw user-agent string (the full string is
// in the tooltip).
function browserName(ua) {
  if (!ua) return '-';
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : '';
  const m =
    ua.match(/(Edg|OPR|CriOS|FxiOS|Firefox|Chrome)\/(\d+)/) || (/Safari/.test(ua) && ua.match(/Version\/(\d+)/) ? ['', 'Safari', ua.match(/Version\/(\d+)/)[1]] : null);
  const names = { Edg: 'Edge', OPR: 'Opera', CriOS: 'Chrome', FxiOS: 'Firefox' };
  const br = m ? `${names[m[1]] || m[1]} ${m[2]}` : 'เบราว์เซอร์อื่น';
  return os ? `${br} · ${os}` : br;
}

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
    { key: 'insights', label: 'การใช้งาน' },
    { key: 'reports', label: 'แจ้งปัญหา', badge: stats?.reports_open },
    { key: 'errors', label: 'ข้อผิดพลาด', badge: stats?.client_errors_open },
    { key: 'proofs', label: 'ผู้สนับสนุน', badge: stats?.proofs_pending },
    { key: 'testers', label: 'คำขอทดสอบ', badge: stats?.tester_requests_open },
    { key: 'inquiries', label: `ติดต่อเป็น${keepWord('สปอนเซอร์')}`, badge: stats?.inquiries_open },
    { key: 'reviews', label: 'รีวิว', badge: stats?.reviews_pending },
    { key: 'sponsors', label: `โลโก้${keepWord('สปอนเซอร์')}` },
  ];

  const current = tabs.find((x) => x.key === tab);

  // On a computer: a sticky sidebar of sections on the left (with their
  // to-do counts) and a wide work area on the right. On a phone the same
  // nav collapses back into the row of pills above the content.
  return (
    <div className="page admin">
      <div className="admin-layout">
        <aside className="admin-nav">
          <div className="admin-nav-head">
            <h1 className="h1 admin-title">{keepWord('แอดมิน')} DeePer</h1>
            <button className="link admin-logout" type="button" onClick={onLogout}>
              ออกจากระบบ
            </button>
          </div>
          <nav className="admin-tabs" aria-label="ส่วนของแอดมิน">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`admin-tab ${tab === t.key ? 'active' : ''}`}
                aria-current={tab === t.key ? 'page' : undefined}
                onClick={() => setTab(t.key)}
              >
                <span className="admin-tab-label">{t.label}</span>
                {t.badge > 0 && <span className="admin-badge">{t.badge}</span>}
              </button>
            ))}
          </nav>
        </aside>

        <main className="admin-main">
          {/* A short fade as the section changes, instead of a hard cut. */}
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
          <h2 className="admin-section-title">{current.label}</h2>
          {tab === 'overview' &&
            (error ? (
              <ErrorState message={error} onRetry={reload} />
            ) : stats ? (
              <Overview stats={stats} onOpen={setTab} />
            ) : (
              <Loading />
            ))}
          {tab === 'insights' && <Insights onLogout={onLogout} />}
          {tab === 'reports' && <Reports onLogout={onLogout} onChange={reload} />}
          {tab === 'errors' && <ClientErrors onLogout={onLogout} onChange={reload} />}
          {tab === 'proofs' && <Proofs onLogout={onLogout} onChange={reload} />}
          {tab === 'testers' && <TesterRequests onLogout={onLogout} onChange={reload} />}
          {tab === 'inquiries' && <Inquiries onLogout={onLogout} onChange={reload} />}
          {tab === 'reviews' && <Reviews onLogout={onLogout} onChange={reload} />}
          {tab === 'sponsors' && <Sponsors onLogout={onLogout} />}
        </main>
      </div>
    </div>
  );
}

function Overview({ stats, onOpen }) {
  // Things waiting on the admin, kept apart from the numbers: each opens its
  // tab, and turns red while something's waiting.
  const todo = [
    ['แจ้งปัญหาที่ยังไม่แก้', stats.reports_open, 'reports'],
    ['ข้อผิดพลาดที่ยังไม่แก้', stats.client_errors_open ?? 0, 'errors'],
    ['สลิปรออนุมัติ', stats.proofs_pending, 'proofs'],
    ['คำขอทดสอบรอส่งรหัส', stats.tester_requests_open ?? 0, 'testers'],
    [`${keepWord('สปอนเซอร์')}รอติดต่อกลับ`, stats.inquiries_open, 'inquiries'],
    ['รีวิวรออนุมัติ', stats.reviews_pending ?? 0, 'reviews'],
  ];
  const tiles = [
    ['คนเข้าเว็บวันนี้', stats.visitors_today, `ยังไม่ล็อกอิน ${stats.guests_today.toLocaleString('th-TH')}`],
    ['คนใช้งานวันนี้ (ล็อกอิน)', stats.active_today],
    ['สมัครใหม่วันนี้', stats.signups_today],
    ['เข้าสู่ระบบวันนี้', stats.logins_today],
    ['ตอบคำถามวันนี้', stats.answers_today],
    ['ผู้ใช้ทั้งหมด', stats.users_total],
    ['แจ้งปัญหาที่ยังไม่แก้', stats.reports_open],
    [`องค์กรติดต่อเป็น${keepWord('สปอนเซอร์')} (ยังไม่ได้ติดต่อกลับ)`, stats.inquiries_open],
    ['สลิปรออนุมัติ', stats.proofs_pending],
    ['รีวิวรออนุมัติ', stats.reviews_pending ?? 0],
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
      <div className="admin-grid">
        <DayChart days={stats.days} field="visitors" title="คนเข้าเว็บต่อวัน (14 วันล่าสุด)" />
        <DayChart days={stats.days} field="active" title="คนใช้งานที่ล็อกอินต่อวัน (14 วันล่าสุด)" />
        <BarList
          title="คนเข้าเว็บมาจากไหน (14 วันล่าสุด)"
          rows={stats.sources.map((s) => [SOURCE_LABEL[s.source] || s.source, s.c])}
          unit="คน"
          empty="ยังไม่มีข้อมูล"
        />
      </div>
      <p className="admin-note">
        นับคนเข้าเว็บ 1 ครั้งต่อเบราว์เซอร์ต่อวัน (เวลาไทย) ลิงก์ใน bio ให้ต่อท้ายด้วย ?ref=ig หรือ ?ref=tt
        เช่น deeper.in.th/?ref=ig จะได้รู้แน่ชัดว่ามาจาก IG หรือ TikTok
      </p>
    </>
  );
}

// One count per day for the last 14 days — single series, so no legend;
// the title names it and each bar shows its exact value on hover/tap.
function DayChart({ days, field, title }) {
  const max = Math.max(1, ...days.map((d) => d[field]));
  const label = (day) =>
    new Date(`${day}T00:00:00Z`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return (
    <div className="glass admin-chart">
      <p className="admin-chart-title">{title}</p>
      <div className="admin-bars" role="img" aria-label={title}>
        {days.map((d) => (
          <div key={d.day} className="admin-bar-slot" tabIndex={0}>
            <span className="admin-bar-tip">
              {label(d.day)}: {d[field]} คน{field === 'active' ? ` · สมัครใหม่ ${d.signups}` : ''}
            </span>
            <span className="admin-bar" style={{ height: `${(d[field] / max) * 100}%` }} />
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

// Ranked horizontal bars with the value written at the end of each row.
function BarList({ title, rows, unit, empty }) {
  const max = Math.max(1, ...rows.map(([, v]) => v));
  return (
    <div className="glass admin-chart">
      <p className="admin-chart-title">{title}</p>
      {rows.length === 0 && <p className="admin-note" style={{ margin: 0 }}>{empty}</p>}
      {rows.map(([name, value]) => (
        <div key={name} className="admin-hbar">
          <div className="admin-hbar-head">
            <span>{name}</span>
            <span className="admin-hbar-value">
              {value.toLocaleString('th-TH')} {unit}
            </span>
          </div>
          <div className="admin-hbar-track">
            <span className="admin-hbar-fill" style={{ width: `${(value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Insights({ onLogout }) {
  const { t } = useI18n();
  const { data, error, reload } = useAdminData(adminApi.insights, onLogout);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const catRows = (counts) => CATS.map((c) => [t(`cat.${c}`), counts[c] || 0]).sort((a, b) => b[1] - a[1]);
  const pct = data.active_14d ? Math.round((data.returning_14d / data.active_14d) * 100) : 0;

  return (
    <>
      <div className="glass admin-tile admin-tile--wide">
        <span className="admin-tile-value">{pct}%</span>
        <span className="admin-tile-label">
          กลับมาใช้ซ้ำ: {data.returning_14d} จาก {data.active_14d} คนที่ใช้งานใน 14 วันล่าสุด ใช้มากกว่า 1 วัน
        </span>
      </div>
      <div className="admin-grid">
        <BarList title="หมวดที่ตอบคำถามมากที่สุด" rows={catRows(data.answered_by_category)} unit="ครั้ง" empty="ยังไม่มีข้อมูล" />
        <BarList title="หมวดที่บันทึกคำถามมากที่สุด" rows={catRows(data.saved_by_category)} unit="ครั้ง" empty="ยังไม่มีข้อมูล" />
        <TopQuestions title="คำถามที่ถูกบันทึกมากที่สุด" rows={data.top_saved} t={t} />
        <TopQuestions title="คำถามที่ถูกตอบมากที่สุด" rows={data.top_answered} t={t} />
      </div>
      <p className="admin-note">คำถามที่ถูกบันทึกเยอะคือคำถามที่คนชอบ เอาไปทำ{keepWord('คอนเทนต์')}ลง IG / TikTok ได้</p>
    </>
  );
}

function TopQuestions({ title, rows, t }) {
  return (
    <div className="glass admin-chart">
      <p className="admin-chart-title">{title}</p>
      {rows.length === 0 && <p className="admin-note" style={{ margin: 0 }}>ยังไม่มีข้อมูล</p>}
      <ol className="admin-toplist">
        {rows.map((q) => (
          <li key={q.text}>
            {/* A "question" that's only Thai marks or spaces shows as such
                instead of a stray glyph at the top of the list. */}
            <span className="admin-toplist-text">
              {(q.text.match(/\p{L}/gu) || []).length >= 2 ? q.text : <i className="faint">(ข้อความว่าง)</i>}
            </span>
            <span className="admin-meta">
              {t(`cat.${q.category}`)} · {q.c} ครั้ง
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Reports({ onLogout, onChange }) {
  const confirm = useConfirm();
  const toast = useToast();
  const { data, error, reload } = useAdminData(adminApi.reports, onLogout);
  const [filter, setFilter] = useState('open');
  const [shots, setShots] = useState({}); // id -> loaded image URL (kept once fetched)
  const [openShots, setOpenShots] = useState({}); // id -> currently shown
  const trash = useTrash('reports', 'รายงาน', { reload, onChange, onLogout });

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
  // One-click thank-you email (fixed template, worded per report type).
  const reply = async (r, to) => {
    const ok = await confirm({
      title: 'ส่งอีเมลขอบคุณ',
      message: `ส่งอีเมลขอบคุณไปที่ ${to} ?`,
      confirmText: 'ส่งเลย',
      danger: false,
    });
    if (!ok) return;
    try {
      await adminApi.replyReport(r.id);
      toast('ส่งอีเมลแล้ว');
      reload();
    } catch (e) {
      if (e instanceof AdminAuthError) onLogout();
      else toast(e.message);
    }
  };
  const showShot = async (id) => {
    setOpenShots((o) => ({ ...o, [id]: true }));
    if (shots[id]) return;
    try {
      const blob = await adminApi.screenshot(id);
      setShots((s) => ({ ...s, [id]: URL.createObjectURL(blob) }));
    } catch (e) {
      setOpenShots((o) => ({ ...o, [id]: false }));
      if (e instanceof AdminAuthError) onLogout();
    }
  };


  const list = inFilter(data.reports, filter, (r) => (r.resolved_at ? 'done' : 'open'));

  return (
    <>
      <FilterRow
        items={data.reports}
        filter={filter}
        setFilter={setFilter}
        statusOf={(r) => (r.resolved_at ? 'done' : 'open')}
        filters={[
          ['open', 'ยังไม่แก้'],
          ['done', 'แก้แล้ว'],
        ]}
      />
      {list.length === 0 && <p className="admin-note">ไม่มีรายการ</p>}
      <div className="admin-list">
      {list.map((r) => (
          <div key={r.id} className="glass admin-card">
          <div className="admin-card-head">
            <span className={`admin-tag admin-tag--${r.category}`}>{REPORT_LABEL[r.category] || r.category}</span>
            <span className="admin-meta">
              #{r.id} · {fmtTime(r.created_at)}
              {!r.deleted_at && <TrashButton onClick={() => trash.toTrash(r)} />}
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
          {r.has_screenshot && (
            <>
              <button
                className="link admin-inline-btn"
                type="button"
                onClick={() => (openShots[r.id] ? setOpenShots((o) => ({ ...o, [r.id]: false })) : showShot(r.id))}
              >
                {openShots[r.id] ? 'ซ่อนรูปหน้าจอ' : 'ดูรูปหน้าจอ'}
              </button>
              {openShots[r.id] && shots[r.id] && (
                <a href={shots[r.id]} target="_blank" rel="noreferrer">
                  <img className="admin-img" src={shots[r.id]} alt="รูปหน้าจอ" />
                </a>
              )}
            </>
          )}
          {r.deleted_at ? (
            <TrashedActions item={r} trash={trash} />
          ) : (
            <div className="admin-actions">
              <button
                className={`btn ${r.resolved_at ? 'btn--ghost' : 'btn--primary'} admin-action`}
                type="button"
                onClick={() => act(r.id, r.resolved_at ? 'reopen' : 'resolve')}
              >
                {r.resolved_at ? `แก้แล้ว ${fmtTime(r.resolved_at)} · เปิดใหม่` : 'ทำเครื่องหมายว่าแก้แล้ว'}
              </button>
              <ReplyButton r={r} onReply={reply} />
            </div>
          )}
        </div>
      ))}
      </div>
    </>
  );
}

function Proofs({ onLogout, onChange }) {
  const confirm = useConfirm();
  const toast = useToast();
  const { data, error, reload } = useAdminData(adminApi.proofs, onLogout);
  const [filter, setFilter] = useState('pending');
  const trash = useTrash('proofs', 'หลักฐาน', { reload, onChange, onLogout });

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const statusOf = (p) => (p.approved_at ? 'approved' : p.rejected_at ? 'rejected' : 'pending');
  const list = inFilter(data.proofs, filter, statusOf);

  const act = async (id, action) => {
    try {
      await adminApi.setProof(id, action);
      reload();
      onChange();
    } catch (e) {
      if (e instanceof AdminAuthError) onLogout();
    }
  };

  // Name not fit to show publicly: keep it off the site and email the donor
  // a thank-you at their sign-up address instead.
  const reject = async (p) => {
    const ok = await confirm({
      title: 'ไม่ขึ้นชื่อ',
      message: p.email
        ? `ไม่แสดงชื่อ "${p.display_name}" บนหน้าเว็บ และส่งอีเมลขอบคุณไปที่ ${p.email} ?`
        : `ไม่แสดงชื่อ "${p.display_name}" บนหน้าเว็บ? (บัญชีนี้ไม่มีอีเมล จึงส่งอีเมลขอบคุณไม่ได้)`,
      confirmText: 'ไม่ขึ้นชื่อ',
    });
    if (!ok) return;
    try {
      const r = await adminApi.rejectProof(p.id);
      toast(r.emailed ? 'ไม่ขึ้นชื่อ และส่งอีเมลขอบคุณแล้ว' : 'ไม่ขึ้นชื่อแล้ว แต่ส่งอีเมลไม่ได้ (ไม่มีอีเมล หรือยังไม่ได้ตั้งค่า SMTP)');
      reload();
      onChange();
    } catch (e) {
      if (e instanceof AdminAuthError) onLogout();
      else toast(e.message);
    }
  };

  return (
    <>
      <p className="admin-note">ตรวจสลิปว่า{keepWord('ยอด')}และเวลาตรงกับที่โอนเข้าจริง แล้วกดอนุมัติ ชื่อจะขึ้นในระดับ "ผู้สนับสนุนรายบุคคล" บนหน้าเว็บทันที ถ้าชื่อไม่เหมาะสม กด "ไม่ขึ้นชื่อ" ระบบจะส่งอีเมลขอบคุณไปที่อีเมลที่เขาใช้สมัครแทน</p>
      <FilterRow
        items={data.proofs}
        filter={filter}
        setFilter={setFilter}
        statusOf={statusOf}
        filters={[
          ['pending', 'รออนุมัติ'],
          ['approved', 'ขึ้นหน้าเว็บแล้ว'],
          ['rejected', 'ไม่ขึ้นชื่อ'],
        ]}
      />
      {list.length === 0 && <p className="admin-note">ไม่มีรายการ</p>}
      <div className="admin-list">
      {list.map((p) => (
          <div key={p.id} className="glass admin-card">
          <div className="admin-card-head">
            <span className="admin-proof-name">{p.display_name}</span>
            <span className="admin-meta">
              <span
                className={`admin-tag ${p.approved_at ? 'admin-tag--ok' : p.rejected_at ? '' : 'admin-tag--wait'}`}
              >
                {p.approved_at ? 'ขึ้นหน้าเว็บแล้ว' : p.rejected_at ? 'ไม่ขึ้นชื่อ' : 'รออนุมัติ'}
              </span>
              {!p.deleted_at && <TrashButton onClick={() => trash.toTrash(p)} />}
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
          {p.deleted_at ? (
            <TrashedActions item={p} trash={trash} />
          ) : (
            <div className="admin-actions">
              <button
                className={`btn ${p.approved_at ? 'btn--ghost' : 'btn--primary'} admin-action`}
                type="button"
                onClick={() => act(p.id, p.approved_at ? 'revoke' : 'approve')}
              >
                {p.approved_at ? 'ซ่อนชื่อออกจากหน้าเว็บ' : 'อนุมัติ ให้ชื่อขึ้นหน้าเว็บ'}
              </button>
              {p.rejected_at ? (
                <p className="admin-note admin-replied">
                  ไม่ขึ้นชื่อเมื่อ {fmtTime(p.rejected_at)} · กดอนุมัติด้านบนถ้าเปลี่ยนใจ
                </p>
              ) : (
                <button className="btn btn--ghost admin-action admin-reply" type="button" onClick={() => reject(p)}>
                  ไม่ขึ้นชื่อ · ส่งอีเมลขอบคุณแทน
                </button>
              )}
            </div>
          )}
        </div>
      ))}
      </div>
    </>
  );
}

// Where the thank-you goes: the account email, else an email typed in the
// contact field. Without either there's no one to reply to.
function ReplyButton({ r, onReply }) {
  const to = r.email || (r.contact && EMAIL_RE.test(r.contact) ? r.contact : null);
  if (r.replied_at) return <p className="admin-note admin-replied">✓ ส่งอีเมลขอบคุณแล้ว {fmtTime(r.replied_at)}</p>;
  if (!to) return <p className="admin-note admin-replied">ไม่มีอีเมลให้ตอบกลับ</p>;
  return (
    <button className="btn btn--ghost admin-action admin-reply" type="button" onClick={() => onReply(r, to)}>
      ส่งอีเมลขอบคุณ
    </button>
  );
}

function Sponsors({ onLogout }) {
  const confirm = useConfirm();
  const toast = useToast();
  const { data, error, reload } = useAdminData(adminApi.sponsors, onLogout);
  const [name, setName] = useState('');
  const [tier, setTier] = useState('general');
  const [link, setLink] = useState('');
  const [logo, setLogo] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const fail = (e) => {
    if (e instanceof AdminAuthError) onLogout();
    else toast(e.message);
  };

  const pickLogo = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(f));
    setLogo(f);
  };

  const add = async (e) => {
    e.preventDefault();
    if (!logo || !name.trim() || busy) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('name', name.trim());
      form.append('tier', tier);
      form.append('link', link.trim());
      form.append('logo', logo);
      await adminApi.addSponsor(form);
      if (preview) URL.revokeObjectURL(preview);
      setName('');
      setLink('');
      setLogo(null);
      setPreview('');
      toast(`เพิ่ม${keepWord('สปอนเซอร์')}แล้ว`);
      reload();
    } catch (e2) {
      fail(e2);
    } finally {
      setBusy(false);
    }
  };

  const changeTier = async (s, next) => {
    try {
      await adminApi.updateSponsor(s.id, { tier: next });
      reload();
    } catch (e) {
      fail(e);
    }
  };

  const remove = async (s) => {
    const ok = await confirm({ title: `ลบ${keepWord('สปอนเซอร์')}`, message: `ลบ ${s.name} ออกจากหน้าเว็บ?`, confirmText: 'ลบ', danger: true });
    if (!ok) return;
    try {
      await adminApi.deleteSponsor(s.id);
      reload();
    } catch (e) {
      fail(e);
    }
  };

  return (
    <>
      <p className="admin-note">
        โลโก้{keepWord('สปอนเซอร์')}ที่เพิ่มตรงนี้จะขึ้นในหน้าเว็บต่อจากที่อยู่ในโค้ด ใช้โลโก้พื้นหลังโปร่งใส (PNG หรือ SVG) ที่อ่านออกบนพื้นดำ
        บน Render แบบฟรี โลโก้ที่เพิ่มจะหายเมื่อ deploy ใหม่
      </p>

      <div className="admin-sponsors">
      <form className="glass admin-card admin-sponsor-form" onSubmit={add}>
        <p className="admin-chart-title">เพิ่ม{keepWord('สปอนเซอร์')}</p>
        <label className="admin-logo-drop">
          <input type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" hidden onChange={pickLogo} />
          {preview ? <img src={preview} alt="ตัวอย่างโลโก้" /> : <span>แนบโลโก้ (ไม่เกิน 2MB)</span>}
        </label>
        <div className="field">
          <label htmlFor="sp-name">ชื่อ</label>
          <input id="sp-name" className="input" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>ระดับ</label>
          <div className="filter-row" style={{ marginBottom: 0 }}>
            {TIERS.map((k) => (
              <button key={k} type="button" className={`pill ${tier === k ? 'active' : ''}`} onClick={() => setTier(k)}>
                {TIER_LABEL[k]}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="sp-link">ลิงก์เว็บไซต์ (ไม่บังคับ)</label>
          <input
            id="sp-link"
            className="input"
            type="url"
            placeholder="https://"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
        </div>
        <button className="btn btn--primary admin-action" type="submit" disabled={!logo || !name.trim() || busy}>
          {busy ? 'กำลังเพิ่ม...' : `เพิ่ม${keepWord('สปอนเซอร์')}`}
        </button>
      </form>

      <div className="admin-sponsor-tiers">
      {TIERS.map((k) => {
        const fromCode = SPONSORS.filter((s) => s.tier === k);
        const added = data.sponsors.filter((s) => s.tier === k);
        if (!fromCode.length && !added.length) return null;
        return (
          <div key={k} className="glass admin-card">
            <p className="admin-chart-title">{TIER_LABEL[k]}</p>
            {fromCode.map((s) => (
              <div key={`code-${s.name}`} className="admin-sponsor">
                <span className="admin-sponsor-logo">
                  <img src={s.logo} alt={s.name} />
                </span>
                <span className="admin-sponsor-name">{s.name}</span>
                <span className="admin-tag">อยู่ในโค้ด</span>
              </div>
            ))}
            {added.map((s) => (
              <div key={s.id} className="admin-sponsor admin-sponsor--editable">
                <div className="admin-sponsor-row">
                  <span className="admin-sponsor-logo">
                    <img src={s.logo_path} alt={s.name} />
                  </span>
                  <span className="admin-sponsor-name">
                    {s.name}
                    {s.link && <span className="admin-meta"> · {s.link}</span>}
                  </span>
                  <button className="link admin-delete" type="button" onClick={() => remove(s)}>
                    ลบ
                  </button>
                </div>
                <div className="filter-row" style={{ marginBottom: 0 }}>
                  {TIERS.map((t2) => (
                    <button
                      key={t2}
                      type="button"
                      className={`pill ${s.tier === t2 ? 'active' : ''}`}
                      onClick={() => s.tier !== t2 && changeTier(s, t2)}
                    >
                      {TIER_LABEL[t2]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })}
      </div>
      </div>
    </>
  );
}

// Errors caught in visitors' browsers (utils/errorReporter.js). The same
// error from many people is one card with a count; mark it fixed once
// dealt with — it reopens by itself if it happens again.
function ClientErrors({ onLogout, onChange }) {
  const { data, error, reload } = useAdminData(adminApi.clientErrors, onLogout);
  const [filter, setFilter] = useState('open');
  const confirm = useConfirm();
  const toast = useToast();
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const counts = {
    open: data.errors.filter((e) => !e.resolved_at).length,
    done: data.errors.filter((e) => e.resolved_at).length,
    all: data.errors.length,
  };
  const list = data.errors.filter((e) => filter === 'all' || (filter === 'done') === !!e.resolved_at);
  const run = async (fn) => {
    try {
      await fn();
      reload();
      onChange();
    } catch (e) {
      if (e instanceof AdminAuthError) onLogout();
      else toast(e.message);
    }
  };
  const remove = async (e) => {
    const ok = await confirm({ title: 'ลบรายการ', message: 'ลบ error นี้ออกจากรายการ?', confirmText: 'ลบ' });
    if (ok) run(() => adminApi.deleteClientError(e.id));
  };

  return (
    <>
      <p className="admin-note">
        error ที่เกิดในเบราว์เซอร์ของผู้ใช้ ระบบส่งมาเองโดยไม่ต้องมีใครแจ้ง ไม่มีข้อมูลบัญชี มีแค่ข้อความ หน้าที่เกิด และเบราว์เซอร์
      </p>
      <div className="filter-row">
        {[
          ['open', 'ยังไม่แก้'],
          ['done', 'แก้แล้ว'],
          ['all', 'ทั้งหมด'],
        ].map(([k, l]) => (
          <button key={k} type="button" className={`pill ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>
            {l}
            <span className="admin-badge">{counts[k]}</span>
          </button>
        ))}
      </div>
      {list.length === 0 && <AdminEmpty />}
      <div className="admin-list">
        {list.map((e) => (
          <div key={e.id} className="glass admin-card">
            <div className="admin-card-head">
              {/* The error itself is the headline; how often is a tag. */}
              <span className="admin-meta">
                <span className="admin-tag">เกิด {e.count.toLocaleString('th-TH')} ครั้ง</span>
                <span className={`admin-tag ${e.resolved_at ? 'admin-tag--ok' : 'admin-tag--wait'}`}>
                  {e.resolved_at ? 'แก้แล้ว' : 'ยังไม่แก้'}
                </span>
              </span>
              <TrashButton onClick={() => remove(e)} />
            </div>
            <p className="admin-message admin-code admin-error-title">{e.message}</p>
            <dl className="admin-dl">
              <dt>หน้า</dt>
              <dd>{e.url || '-'}</dd>
              <dt>{e.first_seen === e.last_seen ? 'เกิดเมื่อ' : 'ล่าสุด'}</dt>
              <dd>{fmtTime(e.last_seen)}</dd>
              {e.first_seen !== e.last_seen && (
                <>
                  <dt>ครั้งแรก</dt>
                  <dd>{fmtTime(e.first_seen)}</dd>
                </>
              )}
              <dt>เบราว์เซอร์</dt>
              <dd title={e.user_agent || ''}>{browserName(e.user_agent)}</dd>
            </dl>
            {e.stack && (
              <details className="admin-email-preview">
                <summary>stack</summary>
                <p className="admin-message admin-code">{e.stack}</p>
              </details>
            )}
            <div className="admin-actions">
              {/* Routine, so outlined: red fills are for approve/send. */}
              <button
                className="btn btn--ghost admin-action"
                type="button"
                onClick={() => run(() => adminApi.setClientError(e.id, e.resolved_at ? 'reopen' : 'resolve'))}
              >
                {e.resolved_at ? 'เปิดใหม่' : 'ทำเครื่องหมายว่าแก้แล้ว'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// People who asked to join the pre-launch test from the signup page. Each
// card shows the exact invite email (with the current INVITE_CODE) — read
// it, press send, and it goes out from the app's mailbox.
const TESTER_SOURCE = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  friend: 'เพื่อนแนะนำ',
  google: 'ค้นหาใน Google',
  other: 'อื่น ๆ',
};
function TesterRequests({ onLogout, onChange }) {
  const { data, error, reload } = useAdminData(adminApi.testerRequests, onLogout);
  const [filter, setFilter] = useState('open');
  const confirm = useConfirm();
  const toast = useToast();
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const counts = {
    open: data.requests.filter((r) => !r.invited_at).length,
    done: data.requests.filter((r) => r.invited_at).length,
    all: data.requests.length,
  };
  const list = data.requests.filter((r) => filter === 'all' || (filter === 'done') === !!r.invited_at);

  const run = async (fn, success) => {
    try {
      await fn();
      if (success) toast(success);
      reload();
      onChange();
    } catch (e) {
      if (e instanceof AdminAuthError) onLogout();
      else toast(e.message);
    }
  };
  const send = async (r) => {
    const ok = await confirm({
      title: 'ส่งรหัสเชิญ',
      message: `ส่งอีเมลพร้อมรหัสเชิญไปที่ ${r.email} ?`,
      confirmText: 'ส่งเลย',
      danger: false,
      pulse: false,
    });
    if (!ok) return;
    setSendErr((cur) => ({ ...cur, [r.id]: '' }));
    try {
      await adminApi.inviteTester(r.id);
      toast('ส่งอีเมลแล้ว');
      reload();
      onChange();
    } catch (e) {
      if (e instanceof AdminAuthError) onLogout();
      // Kept on the card (a toast was easy to miss and then gone).
      else setSendErr((cur) => ({ ...cur, [r.id]: e.message }));
    }
  };
  const remove = async (r) => {
    const ok = await confirm({ title: 'ลบคำขอ', message: `ลบคำขอของ ${r.nickname} ?`, confirmText: 'ลบ' });
    if (ok) run(() => adminApi.deleteTesterRequest(r.id));
  };

  return (
    <>
      <p className="admin-note">
        คนที่กด "ขอเข้าร่วมทดสอบ" ในหน้าสมัคร อ่านอีเมลที่จะส่งด้านล่าง แล้วกดส่งรหัสเชิญ
      </p>
      {!data.invite_code_set && (
        <p className="admin-note admin-note--warn">ยังไม่ได้ตั้ง INVITE_CODE ใน Render จึงยังส่งรหัสไม่ได้</p>
      )}
      <div className="filter-row">
        {[
          ['open', 'ยังไม่ได้ส่ง'],
          ['done', 'ส่งแล้ว'],
          ['all', 'ทั้งหมด'],
        ].map(([k, l]) => (
          <button key={k} type="button" className={`pill ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>
            {l}
            <span className="admin-badge">{counts[k]}</span>
          </button>
        ))}
      </div>
      {list.length === 0 && <p className="admin-note">ไม่มีรายการ</p>}
      <div className="admin-list">
        {list.map((r) => (
          <div key={r.id} className="glass admin-card">
            <div className="admin-card-head">
              <span className="admin-proof-name">{r.nickname}</span>
              <span className="admin-meta">
                <span className={`admin-tag ${r.invited_at ? 'admin-tag--ok' : 'admin-tag--wait'}`}>
                  {r.invited_at ? 'ส่งแล้ว' : 'ยังไม่ได้ส่ง'}
                </span>
                <TrashButton onClick={() => remove(r)} />
              </span>
            </div>
            <dl className="admin-dl">
              <dt>อีเมล</dt>
              <dd>
                <a href={`mailto:${r.email}`}>{r.email}</a>
              </dd>
              <dt>รู้จักจาก</dt>
              <dd>
                {TESTER_SOURCE[r.source] || r.source}
                {r.source_other ? ` · ${r.source_other}` : ''}
              </dd>
              <dt>ขอเมื่อ</dt>
              <dd>{fmtTime(r.created_at)}</dd>
              {r.invited_at && (
                <>
                  <dt>ส่งรหัสเมื่อ</dt>
                  <dd>{fmtTime(r.invited_at)}</dd>
                </>
              )}
            </dl>
            <details className="admin-email-preview" open={!r.invited_at}>
              <summary>อีเมลที่จะส่ง · {r.email_preview.subject}</summary>
              <p className="admin-message">{r.email_preview.text}</p>
            </details>
            <div className="admin-actions">
              <button
                className={`btn ${r.invited_at ? 'btn--ghost' : 'btn--primary'} admin-action`}
                type="button"
                disabled={!data.invite_code_set}
                onClick={() => send(r)}
              >
                {r.invited_at ? 'ส่งรหัสอีกครั้ง' : 'ส่งรหัสเชิญทางอีเมล'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// Organizations that asked to sponsor us via /sponsor — contact them, then
// mark handled.
function Inquiries({ onLogout, onChange }) {
  const { data, error, reload } = useAdminData(adminApi.inquiries, onLogout);
  const [filter, setFilter] = useState('open');
  const trash = useTrash('inquiries', 'คำขอ', { reload, onChange, onLogout });
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const statusOf = (q) => (q.handled_at ? 'done' : 'open');
  const list = inFilter(data.inquiries, filter, statusOf);

  const act = async (id, action) => {
    try {
      await adminApi.setInquiry(id, action);
      reload();
      onChange();
    } catch (e) {
      if (e instanceof AdminAuthError) onLogout();
    }
  };

  return (
    <>
      <p className="admin-note">
        องค์กรที่กด "สนใจร่วมเป็น{keepWord('สปอนเซอร์')}กับ DeePer? ติดต่อเรา" ในหน้าแรก แล้ว{keepWord('กรอก')}ฟอร์มเข้ามา
      </p>
      <FilterRow
        items={data.inquiries}
        filter={filter}
        setFilter={setFilter}
        statusOf={statusOf}
        filters={[
          ['open', 'ยังไม่ได้ติดต่อ'],
          ['done', 'ติดต่อแล้ว'],
        ]}
      />
      {list.length === 0 && <p className="admin-note">ไม่มีรายการ</p>}
      <div className="admin-list">
      {list.map((q) => (
          <div key={q.id} className="glass admin-card">
          <div className="admin-card-head">
            <span className="admin-proof-name">{q.org_name}</span>
            <span className="admin-meta">
              <span className={`admin-tag ${q.handled_at ? 'admin-tag--ok' : 'admin-tag--wait'}`}>
                {q.handled_at ? 'ติดต่อแล้ว' : 'ยังไม่ได้ติดต่อ'}
              </span>
              {!q.deleted_at && <TrashButton onClick={() => trash.toTrash(q)} />}
            </span>
          </div>
          <p className="admin-message">{q.message}</p>
          <dl className="admin-dl">
            <dt>ผู้ติดต่อ</dt>
            <dd>{q.contact_name}</dd>
            <dt>ติดต่อกลับ</dt>
            <dd>
              {EMAIL_RE.test(q.contact) ? <a href={`mailto:${q.contact}`}>{q.contact}</a> : q.contact}
            </dd>
            <dt>ส่งเมื่อ</dt>
            <dd>{fmtTime(q.created_at)}</dd>
          </dl>
          {q.deleted_at ? (
            <TrashedActions item={q} trash={trash} />
          ) : (
            <div className="admin-actions">
              <button
                className={`btn ${q.handled_at ? 'btn--ghost' : 'btn--primary'} admin-action`}
                type="button"
                onClick={() => act(q.id, q.handled_at ? 'reopen' : 'handled')}
              >
                {q.handled_at ? `ติดต่อแล้ว ${fmtTime(q.handled_at)} · เปิดใหม่` : 'ทำเครื่องหมายว่าติดต่อแล้ว'}
              </button>
            </div>
          )}
        </div>
      ))}
      </div>
    </>
  );
}

// User reviews from the profile page. Approved ones show on the landing
// page with the reviewer's nickname; editing a review sends it back here.
const REVIEW_STATUS = { pending: 'รอตรวจ', approved: 'ขึ้นหน้าแรกแล้ว', rejected: 'ไม่แสดง' };
const RELATION_LABEL = { couple: 'ใช้กับแฟน', friends: 'ใช้กับเพื่อน', family: 'ใช้กับครอบครัว' };
function Reviews({ onLogout, onChange }) {
  const { data, error, reload } = useAdminData(adminApi.reviews, onLogout);
  const confirm = useConfirm();
  const [filter, setFilter] = useState('pending');
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const counts = (k) => data.reviews.filter((r) => k === 'all' || r.status === k).length;
  const list = data.reviews.filter((r) => filter === 'all' || r.status === filter);
  const run = async (fn) => {
    try {
      await fn();
      reload();
      onChange();
    } catch (e) {
      if (e instanceof AdminAuthError) onLogout();
    }
  };
  const remove = async (r) => {
    if (await confirm({ title: 'ลบรีวิว', message: 'ลบรีวิวนี้ถาวร? ผู้ใช้เขียนใหม่ได้', confirmText: 'ลบ', danger: true })) run(() => adminApi.deleteReview(r.id));
  };

  return (
    <>
      <p className="admin-note">รีวิวที่ผู้ใช้เขียนในหน้าโปรไฟล์ อนุมัติแล้วจะขึ้นหน้าแรกพร้อมชื่อเล่น ถ้าผู้ใช้แก้ไข รีวิวจะกลับมารอตรวจใหม่</p>
      <div className="filter-row">
        {[['pending', 'รอตรวจ'], ['approved', 'ขึ้นหน้าแรกแล้ว'], ['rejected', 'ไม่แสดง'], ['all', 'ทั้งหมด']].map(([k, l]) => (
          <button key={k} type="button" className={`pill ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>
            {l}
            <span className="admin-badge">{counts(k)}</span>
          </button>
        ))}
      </div>
      {list.length === 0 && <p className="admin-note">ไม่มีรายการ</p>}
      <div className="admin-list">
      {list.map((r) => (
          <div key={r.id} className="glass admin-card">
          <div className="admin-card-head">
            <span className="admin-proof-name">
              {r.nickname} / {r.nickname_en}
            </span>
            <span className="admin-meta">
              <span className={`admin-tag ${r.status === 'approved' ? 'admin-tag--ok' : 'admin-tag--wait'}`}>{REVIEW_STATUS[r.status]}</span>
              <TrashButton onClick={() => remove(r)} />
            </span>
          </div>
          <p className="admin-message">“{r.text}”</p>
          <dl className="admin-dl">
            <dt>ใช้กับ</dt>
            <dd>{RELATION_LABEL[r.relation]}</dd>
            <dt>อีเมล</dt>
            <dd>{r.email}</dd>
            <dt>ส่งล่าสุด</dt>
            <dd>{fmtTime(r.updated_at)}</dd>
          </dl>
          <div className="admin-actions">
            {r.status !== 'approved' && (
              <button className="btn btn--primary admin-action" type="button" onClick={() => run(() => adminApi.setReview(r.id, 'approve'))}>
                อนุมัติ ให้ขึ้นหน้าแรก
              </button>
            )}
            {r.status !== 'rejected' && (
              <button className="btn btn--ghost admin-action" type="button" onClick={() => run(() => adminApi.setReview(r.id, 'reject'))}>
                {r.status === 'approved' ? 'เอาออกจากหน้าแรก' : 'ไม่แสดง'}
              </button>
            )}
          </div>
        </div>
      ))}
      </div>
    </>
  );
}

// ---- Trash (shared by reports, proofs and inquiries) ----
// Trashed items drop out of every status filter and the counts, and live
// under the "ถังขยะ" filter until restored or deleted for good.
function inFilter(items, filter, statusOf) {
  if (filter === 'trash') return items.filter((i) => i.deleted_at);
  const live = items.filter((i) => !i.deleted_at);
  return filter === 'all' ? live : live.filter((i) => statusOf(i) === filter);
}

function FilterRow({ items, filter, setFilter, statusOf, filters }) {
  const all = [...filters, ['all', 'ทั้งหมด'], ['trash', 'ถังขยะ']];
  return (
    <div className="filter-row">
      {all.map(([k, l]) => (
        <button key={k} type="button" className={`pill ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>
          {k === 'trash' && <IcTrash size={14} />}
          {l}
          <span className="admin-badge">{inFilter(items, k, statusOf).length}</span>
        </button>
      ))}
    </div>
  );
}

function useTrash(kind, noun, { reload, onChange, onLogout }) {
  const confirm = useConfirm();
  const toast = useToast();
  const run = async (fn, done) => {
    try {
      await fn();
      if (done) toast(done);
      reload();
      onChange?.();
    } catch (e) {
      if (e instanceof AdminAuthError) onLogout();
      else toast(e.message);
    }
  };
  return {
    toTrash: (item) => run(() => adminApi.trash(kind, item.id), `ย้าย${noun}ไปถังขยะแล้ว`),
    restore: (item) => run(() => adminApi.restore(kind, item.id), `กู้คืน${noun}แล้ว`),
    purge: async (item) => {
      const ok = await confirm({
        title: 'ลบถาวร',
        message: `ลบ${noun}นี้ถาวร? กู้คืนไม่ได้อีก${kind === 'reports' || kind === 'proofs' ? ' และไฟล์รูปจะถูกลบด้วย' : ''}`,
        confirmText: 'ลบถาวร',
      });
      if (ok) run(() => adminApi.purge(kind, item.id), `ลบ${noun}ถาวรแล้ว`);
    },
  };
}

function TrashButton({ onClick }) {
  return (
    <button className="admin-trash-btn" type="button" onClick={onClick} aria-label="ย้ายไปถังขยะ" title="ย้ายไปถังขยะ">
      <IcTrash size={16} />
    </button>
  );
}

function TrashedActions({ item, trash }) {
  return (
    <>
      <p className="admin-note admin-replied">อยู่ในถังขยะตั้งแต่ {fmtTime(item.deleted_at)}</p>
      <div className="admin-actions">
        <button className="btn btn--ghost admin-action" type="button" onClick={() => trash.restore(item)}>
          กู้คืน
        </button>
        <button className="btn btn--danger admin-action" type="button" onClick={() => trash.purge(item)}>
          ลบถาวร
        </button>
      </div>
    </>
  );
}
