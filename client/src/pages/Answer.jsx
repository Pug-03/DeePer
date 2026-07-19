import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../store/auth.jsx';
import { useToast } from '../components/ui.jsx';
import { IcBack } from '../components/icons.jsx';

const COLORS = ['#f43f5e', '#fb923c', '#eab308', '#34d399', '#38bdf8', '#a78bfa', '#f472b6'];

export default function Answer() {
  const nav = useNavigate();
  const loc = useLocation();
  const { user } = useAuth();
  const toast = useToast();

  const q = loc.state?.question;
  const savedId = loc.state?.savedId || null;
  const preset = loc.state?.answers; // when re-viewing/editing from history/saved

  const [turn, setTurn] = useState('me'); // me | partner
  const [myAnswer, setMyAnswer] = useState(preset?.my_answer || '');
  const [partnerAnswer, setPartnerAnswer] = useState(preset?.partner_answer || '');
  const [partnerName, setPartnerName] = useState(
    preset?.partner_name || user?.partner_name || 'อีกฝ่าย',
  );
  const [partnerColor, setPartnerColor] = useState(
    preset?.partner_color || user?.partner_color || '#f43f5e',
  );
  const [busy, setBusy] = useState(false);

  if (!q) {
    return (
      <div className="page">
        <p className="sub">ไม่พบคำถาม</p>
        <button className="btn btn--ghost" onClick={() => nav('/app/home')}>
          กลับหน้าหลัก
        </button>
      </div>
    );
  }

  const save = async () => {
    if (!myAnswer.trim() && !partnerAnswer.trim()) {
      toast('กรอกคำตอบอย่างน้อยหนึ่งช่องก่อนนะ');
      return;
    }
    setBusy(true);
    try {
      await api.post('/history', {
        question_text: q.text,
        category: q.category,
        my_answer: myAnswer,
        partner_answer: partnerAnswer,
        partner_name: partnerName,
        partner_color: partnerColor,
        saved_id: savedId,
      });
      toast('บันทึกคำตอบลงประวัติแล้ว ✅');
      nav('/app/home', { replace: true });
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <button
        className="link"
        style={{ alignSelf: 'flex-start', marginBottom: 14 }}
        onClick={() => nav(-1)}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IcBack size={18} /> กลับ
        </span>
      </button>

      <div className="glass glass--red" style={{ padding: 22, marginBottom: 18 }}>
        <p style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.5, textAlign: 'center' }}>
          {q.text}
        </p>
      </div>

      {/* turn toggle — one device, take turns */}
      <div className="turn-tabs">
        <button
          className="turn-tab"
          style={turn === 'me' ? { background: 'var(--red)', borderColor: 'transparent' } : {}}
          onClick={() => setTurn('me')}
        >
          <span className="turn-dot" style={{ background: '#fff' }} />
          {user?.nickname || 'ของเรา'}
        </button>
        <button
          className="turn-tab"
          style={turn === 'partner' ? { background: partnerColor, borderColor: 'transparent' } : {}}
          onClick={() => setTurn('partner')}
        >
          <span className="turn-dot" style={{ background: partnerColor }} />
          {partnerName || 'อีกฝ่าย'}
        </button>
      </div>

      {turn === 'me' ? (
        <div className="field fade-up">
          <label>คำตอบของ {user?.nickname || 'เรา'}</label>
          <textarea
            className="textarea"
            placeholder="เขียนความรู้สึกของเรา..."
            value={myAnswer}
            onChange={(e) => setMyAnswer(e.target.value)}
            autoFocus
          />
          <button
            className="btn btn--ghost btn--sm"
            style={{ width: '100%', marginTop: 4 }}
            onClick={() => setTurn('partner')}
          >
            ถึงตา {partnerName || 'อีกฝ่าย'} →
          </button>
        </div>
      ) : (
        <div className="field fade-up">
          <label>คำตอบของ {partnerName || 'อีกฝ่าย'}</label>
          <textarea
            className="textarea"
            placeholder={`ส่งเครื่องให้ ${partnerName || 'อีกฝ่าย'} เขียน...`}
            value={partnerAnswer}
            onChange={(e) => setPartnerAnswer(e.target.value)}
            autoFocus
          />

          <div className="field" style={{ marginTop: 10 }}>
            <label>ชื่ออีกฝ่าย</label>
            <input
              className="input"
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
              placeholder="ตั้งชื่ออีกฝ่าย"
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
                aria-label={`สี ${c}`}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-a stack" style={{ marginTop: 24 }}>
        <button className="btn btn--primary" onClick={save} disabled={busy}>
          {busy ? 'กำลังบันทึก...' : 'บันทึกคำตอบ'}
        </button>
      </div>
    </div>
  );
}
