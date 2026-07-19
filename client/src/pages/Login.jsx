import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../store/auth.jsx';
import { useToast } from '../components/ui.jsx';
import GoogleButton from '../components/GoogleButton.jsx';
import { IcBack, IcGoogle } from '../components/icons.jsx';

export default function Login() {
  const nav = useNavigate();
  const { config, applyAuth } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const d = await api.post('/auth/login', { email, password }, { auth: false });
      applyAuth(d.token, d.user);
      nav('/app/home', { replace: true });
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = useCallback(
    async (credential) => {
      setErr('');
      try {
        const d = await api.post('/auth/google', { credential }, { auth: false });
        if (d.needs_profile) {
          nav('/signup', { state: { google: { credential, ...d } } });
          return;
        }
        applyAuth(d.token, d.user);
        nav('/app/home', { replace: true });
      } catch (e2) {
        setErr(e2.message);
      }
    },
    [applyAuth, nav],
  );

  return (
    <div className="page">
      <button className="link" style={{ alignSelf: 'flex-start', marginBottom: 18 }} onClick={() => nav('/')}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IcBack size={18} /> กลับ
        </span>
      </button>

      <div className="header">
        <h1 className="h1">ยินดีต้อนรับกลับมา</h1>
        <p className="sub">เข้าสู่ระบบเพื่อคุยกันต่อ</p>
      </div>

      {err && <div className="err-inline">{err}</div>}

      {config.google_enabled ? (
        <>
          <GoogleButton
            clientId={config.google_client_id}
            onCredential={onGoogle}
            label="เข้าสู่ระบบด้วย Google"
            sub="เลือกบัญชี Google ที่เคยลงทะเบียน"
          />
          <div className="divider">หรือ</div>
        </>
      ) : (
        <>
          <button className="method-btn" disabled>
            <span className="m-ic">
              <IcGoogle />
            </span>
            <span>
              <div className="m-title">เข้าสู่ระบบด้วย Google</div>
              <div className="m-sub">ยังไม่ได้เปิดใช้งาน (ตั้งค่า GOOGLE_CLIENT_ID)</div>
            </span>
          </button>
          <div className="divider">หรือใช้อีเมล</div>
        </>
      )}

      <form onSubmit={submit}>
        <div className="field">
          <label>อีเมล</label>
          <input
            className="input"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label>รหัสผ่าน</label>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="row-between" style={{ marginBottom: 20 }}>
          <span />
          <button
            type="button"
            className="link"
            onClick={() => toast('กรุณาติดต่อผู้ดูแลระบบเพื่อรีเซ็ตรหัสผ่าน')}
          >
            ลืมรหัสผ่าน?
          </button>
        </div>
        <button className="btn btn--primary" type="submit" disabled={busy}>
          {busy ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </button>
      </form>

      <p className="sub center" style={{ marginTop: 22 }}>
        ยังไม่มีบัญชี?{' '}
        <button className="link" onClick={() => nav('/signup')}>
          สมัครใหม่
        </button>
      </p>
    </div>
  );
}
