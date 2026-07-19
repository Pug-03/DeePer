import { useNavigate } from 'react-router-dom';

export default function Welcome() {
  const nav = useNavigate();
  return (
    <div className="page">
      <div className="spacer" />
      <div className="center fade-up">
        <div className="brand-mark" style={{ justifyContent: 'center' }}>
          <span className="dot" />
          <span className="brand">DeePer</span>
        </div>
        <p className="sub" style={{ marginTop: 14, maxWidth: 320, marginInline: 'auto' }}>
          การ์ดคำถามชวนคุยลึก ๆ<br />
          สำหรับคู่รัก เพื่อน ๆ และครอบครัว
        </p>
      </div>

      <div className="deck-hero fade-up" style={{ margin: '36px 0', display: 'grid', placeItems: 'center' }}>
        <div
          className="glass glass--red"
          style={{
            width: 260,
            height: 300,
            display: 'grid',
            placeItems: 'center',
            padding: 28,
            textAlign: 'center',
            transform: 'rotate(-4deg)',
          }}
        >
          <p style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.5 }}>
            “อะไรคือสิ่งเล็ก ๆ ที่ทำให้เรายิ้มได้ทุกวัน?”
          </p>
        </div>
      </div>

      <div className="spacer" />
      <div className="stack mt-a">
        <button className="btn btn--primary" onClick={() => nav('/signup')}>
          สมัครใหม่
        </button>
        <button className="btn btn--ghost" onClick={() => nav('/login')}>
          มีบัญชีอยู่แล้ว
        </button>
      </div>
    </div>
  );
}
