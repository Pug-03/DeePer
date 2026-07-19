import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../store/auth.jsx';
import { useToast } from '../components/ui.jsx';

const GENDERS = [
  { v: '', l: 'ไม่ระบุ' },
  { v: 'female', l: 'หญิง' },
  { v: 'male', l: 'ชาย' },
  { v: 'other', l: 'อื่น ๆ' },
  { v: 'prefer_not', l: 'ไม่บอก' },
];
const COLORS = ['#f43f5e', '#fb923c', '#eab308', '#34d399', '#38bdf8', '#a78bfa', '#f472b6'];

export default function Profile() {
  const nav = useNavigate();
  const toast = useToast();
  const { user, setUser, logout } = useAuth();

  const [nickname, setNickname] = useState(user?.nickname || '');
  const [age, setAge] = useState(user?.age || '');
  const [gender, setGender] = useState(user?.gender || '');
  const [partnerName, setPartnerName] = useState(user?.partner_name || 'อีกฝ่าย');
  const [partnerColor, setPartnerColor] = useState(user?.partner_color || '#f43f5e');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const d = await api.patch('/auth/me', {
        nickname,
        age,
        gender,
        partner_name: partnerName,
        partner_color: partnerColor,
      });
      setUser(d.user);
      toast('บันทึกข้อมูลแล้ว ✅');
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };

  const doLogout = () => {
    logout();
    nav('/', { replace: true });
  };

  const initial = (user?.nickname || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="page page--tab">
      <div className="center" style={{ marginBottom: 22 }}>
        <div className="avatar" style={{ margin: '0 auto 12px' }}>
          {initial}
        </div>
        <h1 className="h2">{user?.nickname}</h1>
        <p className="faint">
          {user?.email || 'บัญชี Google'} {user?.via_google ? '· Google' : ''}
        </p>
      </div>

      <div className="glass" style={{ padding: 18, marginBottom: 14 }}>
        <h2 className="h2" style={{ marginBottom: 14, fontSize: 17 }}>
          ข้อมูลของฉัน
        </h2>
        <div className="field">
          <label>ชื่อเล่น</label>
          <input className="input" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={40} />
        </div>
        <div className="field">
          <label>อายุ</label>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>เพศ</label>
          <select className="select" value={gender} onChange={(e) => setGender(e.target.value)}>
            {GENDERS.map((g) => (
              <option key={g.v} value={g.v}>
                {g.l}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="glass" style={{ padding: 18, marginBottom: 18 }}>
        <h2 className="h2" style={{ marginBottom: 6, fontSize: 17 }}>
          อีกฝ่ายของฉัน
        </h2>
        <p className="faint" style={{ marginBottom: 14 }}>
          ตั้งค่าเริ่มต้นสำหรับหน้าตอบคำถาม
        </p>
        <div className="field">
          <label>ชื่ออีกฝ่าย</label>
          <input
            className="input"
            value={partnerName}
            onChange={(e) => setPartnerName(e.target.value)}
            maxLength={30}
          />
        </div>
        <label style={{ fontSize: 14, color: 'var(--text-dim)', paddingLeft: 4 }}>สีประจำตัว</label>
        <div className="color-swatches" style={{ marginTop: 8 }}>
          {COLORS.map((c) => (
            <button
              key={c}
              className={`swatch ${partnerColor === c ? 'sel' : ''}`}
              style={{ background: c }}
              onClick={() => setPartnerColor(c)}
              aria-label={c}
            />
          ))}
        </div>
      </div>

      <div className="stack">
        <button className="btn btn--primary" onClick={save} disabled={busy}>
          {busy ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
        </button>
        <button className="btn btn--ghost" onClick={doLogout}>
          ออกจากระบบ
        </button>
      </div>
    </div>
  );
}
