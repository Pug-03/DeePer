import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { adminApi, getAdminToken, setAdminToken, AdminAuthError } from '../admin/adminApi.js';
import { Loading, ErrorState, useConfirm, useToast } from '../components/ui.jsx';
import { SPONSORS } from '../sponsors-info.js';
import { useI18n } from '../store/i18n.jsx';
import { CATS } from '../util.js';

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
    { key: 'proofs', label: 'ผู้สนับสนุน', badge: stats?.proofs_pending },
    { key: 'sponsors', label: 'สปอนเซอร์' },
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
      {tab === 'insights' && <Insights onLogout={onLogout} />}
      {tab === 'reports' && <Reports onLogout={onLogout} onChange={reload} />}
      {tab === 'proofs' && <Proofs onLogout={onLogout} onChange={reload} />}
      {tab === 'sponsors' && <Sponsors onLogout={onLogout} />}
    </div>
  );
}

function Overview({ stats }) {
  const tiles = [
    ['คนเข้าเว็บวันนี้', stats.visitors_today],
    ['ในนั้นยังไม่ล็อกอิน', stats.guests_today],
    ['คนใช้งานวันนี้ (ล็อกอิน)', stats.active_today],
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
      <DayChart days={stats.days} field="visitors" title="คนเข้าเว็บต่อวัน (14 วันล่าสุด)" />
      <DayChart days={stats.days} field="active" title="คนใช้งานที่ล็อกอินต่อวัน (14 วันล่าสุด)" />
      <BarList
        title="คนเข้าเว็บมาจากไหน (14 วันล่าสุด)"
        rows={stats.sources.map((s) => [SOURCE_LABEL[s.source] || s.source, s.c])}
        unit="คน"
        empty="ยังไม่มีข้อมูล"
      />
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
      <BarList title="หมวดที่ตอบคำถามมากที่สุด" rows={catRows(data.answered_by_category)} unit="ครั้ง" empty="ยังไม่มีข้อมูล" />
      <BarList title="หมวดที่บันทึกคำถามมากที่สุด" rows={catRows(data.saved_by_category)} unit="ครั้ง" empty="ยังไม่มีข้อมูล" />
      <TopQuestions title="คำถามที่ถูกบันทึกมากที่สุด" rows={data.top_saved} t={t} />
      <TopQuestions title="คำถามที่ถูกตอบมากที่สุด" rows={data.top_answered} t={t} />
      <p className="admin-note">คำถามที่ถูกบันทึกเยอะคือคำถามที่คนชอบ เอาไปทำคอนเทนต์ลง IG / TikTok ได้</p>
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
            <span className="admin-toplist-text">{q.text}</span>
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
          <ReplyButton r={r} onReply={reply} />
        </div>
      ))}
    </>
  );
}

function Proofs({ onLogout, onChange }) {
  const confirm = useConfirm();
  const toast = useToast();
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
      <p className="admin-note">ตรวจสลิปว่ายอดและเวลาตรงกับที่โอนเข้าจริง แล้วกดอนุมัติ ชื่อจะขึ้นในระดับ "เพื่อนของ DeePer" บนหน้าเว็บทันที ถ้าชื่อไม่เหมาะสม กด "ไม่ขึ้นชื่อ" ระบบจะส่งอีเมลขอบคุณไปที่อีเมลที่เขาใช้สมัครแทน</p>
      {data.proofs.length === 0 && <p className="admin-note">ยังไม่มีคนส่งหลักฐาน</p>}
      {data.proofs.map((p) => (
        <div key={p.id} className="glass admin-card">
          <div className="admin-card-head">
            <span className="admin-proof-name">{p.display_name}</span>
            <span
              className={`admin-tag ${p.approved_at ? 'admin-tag--ok' : p.rejected_at ? '' : 'admin-tag--wait'}`}
            >
              {p.approved_at ? 'ขึ้นหน้าเว็บแล้ว' : p.rejected_at ? 'ไม่ขึ้นชื่อ' : 'รออนุมัติ'}
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
          {p.rejected_at ? (
            <p className="admin-note admin-replied">ไม่ขึ้นชื่อเมื่อ {fmtTime(p.rejected_at)} · กดอนุมัติด้านบนถ้าเปลี่ยนใจ</p>
          ) : (
            <button className="btn btn--ghost admin-action admin-reply" type="button" onClick={() => reject(p)}>
              ไม่ขึ้นชื่อ · ส่งอีเมลขอบคุณแทน
            </button>
          )}
        </div>
      ))}
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
      toast('เพิ่มสปอนเซอร์แล้ว');
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
    const ok = await confirm({ title: 'ลบสปอนเซอร์', message: `ลบ ${s.name} ออกจากหน้าเว็บ?`, confirmText: 'ลบ', danger: true });
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
        สปอนเซอร์ที่เพิ่มตรงนี้จะขึ้นในหน้าเว็บต่อจากที่อยู่ในโค้ด ใช้โลโก้พื้นหลังโปร่งใส (PNG หรือ SVG) ที่อ่านออกบนพื้นดำ
        บน Render แบบฟรี โลโก้ที่เพิ่มจะหายเมื่อ deploy ใหม่
      </p>

      <form className="glass admin-card" onSubmit={add}>
        <p className="admin-chart-title">เพิ่มสปอนเซอร์</p>
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
          {busy ? 'กำลังเพิ่ม...' : 'เพิ่มสปอนเซอร์'}
        </button>
      </form>

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
    </>
  );
}
