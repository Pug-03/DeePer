import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../store/auth.jsx';
import { useToast } from '../components/ui.jsx';
import GoogleButton from '../components/GoogleButton.jsx';
import { IcBack, IcGoogle, IcMail } from '../components/icons.jsx';

const GENDERS = [
  { v: 'female', l: 'หญิง' },
  { v: 'male', l: 'ชาย' },
  { v: 'other', l: 'อื่น ๆ' },
  { v: 'prefer_not', l: 'ไม่ระบุ' },
];

function pwScore(pw) {
  const rules = {
    len: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    digit: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
  const passed = [rules.upper, rules.lower, rules.digit, rules.special].filter(Boolean).length;
  const score = rules.len ? passed : Math.max(0, passed - 1);
  const valid = rules.len && rules.upper && rules.lower && rules.digit && rules.special;
  return { rules, score, valid };
}

function ProfileFields({ nickname, setNickname, age, setAge, gender, setGender }) {
  return (
    <>
      <div className="field">
        <label>ชื่อเล่น</label>
        <input
          className="input"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="เรียกเราว่า..."
          maxLength={40}
        />
      </div>
      <div className="field">
        <label>อายุ</label>
        <input
          className="input"
          type="number"
          inputMode="numeric"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          placeholder="เช่น 25"
          min={1}
          max={120}
        />
      </div>
      <div className="field">
        <label>เพศ</label>
        <select className="select" value={gender} onChange={(e) => setGender(e.target.value)}>
          <option value="">เลือกเพศ</option>
          {GENDERS.map((g) => (
            <option key={g.v} value={g.v}>
              {g.l}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

export default function Signup() {
  const nav = useNavigate();
  const loc = useLocation();
  const { config, applyAuth } = useAuth();
  const toast = useToast();

  const [step, setStep] = useState('method'); // method | email | otp | profile | gprofile
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const otpRefs = useRef([]);

  const [nickname, setNickname] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [password, setPassword] = useState('');

  const [gCredential, setGCredential] = useState(null);

  // If arriving from Login with a Google account needing profile completion.
  useEffect(() => {
    const g = loc.state?.google;
    if (g?.credential) {
      setGCredential(g.credential);
      if (g.suggested_nickname) setNickname(g.suggested_nickname);
      setStep('gprofile');
    }
  }, [loc.state]);

  const { rules, score, valid: pwValid } = pwScore(password);

  const requestOtp = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const d = await api.post('/auth/otp/request', { email }, { auth: false });
      setStep('otp');
      setOtp(['', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 60);
      if (d.dev_code) toast(`โหมดพัฒนา: รหัส OTP คือ ${d.dev_code}`);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const onOtpChange = (i, val) => {
    const v = val.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[i] = v;
    setOtp(next);
    if (v && i < 3) otpRefs.current[i + 1]?.focus();
  };
  const onOtpKey = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== 4) return;
    setErr('');
    setBusy(true);
    try {
      await api.post('/auth/otp/verify', { email, code }, { auth: false });
      setStep('profile');
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const registerEmail = async (e) => {
    e.preventDefault();
    setErr('');
    if (!nickname.trim()) return setErr('กรุณากรอกชื่อเล่น');
    if (!pwValid) return setErr('รหัสผ่านยังไม่ตรงตามเงื่อนไข');
    setBusy(true);
    try {
      const d = await api.post(
        '/auth/register',
        { email, code: otp.join(''), nickname, age, gender, password },
        { auth: false },
      );
      applyAuth(d.token, d.user);
      nav('/app/home', { replace: true });
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const onGoogleCredential = useCallback(
    async (credential) => {
      setErr('');
      try {
        const d = await api.post('/auth/google', { credential }, { auth: false });
        if (d.needs_profile) {
          setGCredential(credential);
          if (d.suggested_nickname) setNickname(d.suggested_nickname);
          setStep('gprofile');
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

  const registerGoogle = async (e) => {
    e.preventDefault();
    setErr('');
    if (!nickname.trim()) return setErr('กรุณากรอกชื่อเล่น');
    setBusy(true);
    try {
      const d = await api.post(
        '/auth/google',
        { credential: gCredential, nickname, age, gender },
        { auth: false },
      );
      applyAuth(d.token, d.user);
      nav('/app/home', { replace: true });
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const back = () => {
    setErr('');
    if (step === 'method') nav('/');
    else if (step === 'otp') setStep('email');
    else if (step === 'profile') setStep('otp');
    else if (step === 'gprofile') setStep('method');
    else setStep('method');
  };

  return (
    <div className="page">
      <button className="link" style={{ alignSelf: 'flex-start', marginBottom: 18 }} onClick={back}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IcBack size={18} /> กลับ
        </span>
      </button>

      {err && <div className="err-inline">{err}</div>}

      {/* Step: choose method */}
      {step === 'method' && (
        <div className="fade-up">
          <div className="header">
            <h1 className="h1">สมัครใหม่</h1>
            <p className="sub">เลือกวิธีสมัครที่สะดวก</p>
          </div>

          {config.google_enabled ? (
            <div style={{ marginBottom: 14 }}>
              <GoogleButton
                clientId={config.google_client_id}
                onCredential={onGoogleCredential}
                label="สมัครด้วย Google"
                sub="ไม่ต้องตั้งรหัสผ่านเอง"
              />
            </div>
          ) : (
            <button className="method-btn" style={{ marginBottom: 14 }} disabled>
              <span className="m-ic">
                <IcGoogle />
              </span>
              <span>
                <div className="m-title">สมัครด้วย Google</div>
                <div className="m-sub">ยังไม่ได้เปิดใช้งาน (ตั้งค่า GOOGLE_CLIENT_ID)</div>
              </span>
            </button>
          )}

          <button className="method-btn" onClick={() => setStep('email')}>
            <span className="m-ic">
              <IcMail size={22} />
            </span>
            <span>
              <div className="m-title">สมัครด้วยอีเมล</div>
              <div className="m-sub">รับรหัส OTP ทางอีเมล แล้วตั้งรหัสผ่าน</div>
            </span>
          </button>

          <p className="google-note" style={{ marginTop: 18 }}>
            สมัครด้วย Google ไม่ต้องตั้งรหัสผ่านเอง — Google ดูแลการยืนยันตัวตนให้
          </p>
        </div>
      )}

      {/* Step: email entry */}
      {step === 'email' && (
        <form className="fade-up" onSubmit={requestOtp}>
          <div className="header">
            <h1 className="h1">กรอกอีเมล</h1>
            <p className="sub">เราจะส่งรหัส OTP 4 หลักไปที่อีเมลของคุณ</p>
          </div>
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
              autoFocus
            />
          </div>
          <button className="btn btn--primary" type="submit" disabled={busy}>
            {busy ? 'กำลังส่ง...' : 'ส่งรหัส OTP'}
          </button>
        </form>
      )}

      {/* Step: OTP */}
      {step === 'otp' && (
        <form className="fade-up" onSubmit={verifyOtp}>
          <div className="header">
            <h1 className="h1">ยืนยันรหัส OTP</h1>
            <p className="sub">
              กรอกรหัส 4 หลักที่ส่งไปยัง<br />
              <b style={{ color: 'var(--text)' }}>{email}</b>
            </p>
          </div>
          <div className="otp-row" style={{ marginBottom: 24 }}>
            {otp.map((d, i) => (
              <input
                key={i}
                ref={(el) => (otpRefs.current[i] = el)}
                className="otp-box"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => onOtpChange(i, e.target.value)}
                onKeyDown={(e) => onOtpKey(i, e)}
              />
            ))}
          </div>
          <button className="btn btn--primary" type="submit" disabled={busy || otp.join('').length !== 4}>
            {busy ? 'กำลังตรวจสอบ...' : 'ยืนยัน'}
          </button>
          <button
            type="button"
            className="link center"
            style={{ marginTop: 16, width: '100%' }}
            onClick={requestOtp}
          >
            ส่งรหัสอีกครั้ง
          </button>
        </form>
      )}

      {/* Step: profile + password (email flow) */}
      {step === 'profile' && (
        <form className="fade-up" onSubmit={registerEmail}>
          <div className="header">
            <h1 className="h1">ตั้งค่าโปรไฟล์</h1>
            <p className="sub">อีกนิดเดียว แล้วเริ่มคุยกันได้เลย</p>
          </div>
          <ProfileFields
            nickname={nickname}
            setNickname={setNickname}
            age={age}
            setAge={setAge}
            gender={gender}
            setGender={setGender}
          />
          <div className="field">
            <label>ตั้งรหัสผ่าน</label>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="pw-meter">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className={`pw-seg ${score >= n ? `on-${score}` : ''}`} />
              ))}
            </div>
            <ul className="pw-rules">
              <li className={rules.len ? 'ok' : ''}>• อย่างน้อย 8 ตัว</li>
              <li className={rules.upper ? 'ok' : ''}>• พิมพ์ใหญ่ (A-Z)</li>
              <li className={rules.lower ? 'ok' : ''}>• พิมพ์เล็ก (a-z)</li>
              <li className={rules.digit ? 'ok' : ''}>• ตัวเลข (0-9)</li>
              <li className={rules.special ? 'ok' : ''}>• อักขระพิเศษ (!@#..)</li>
            </ul>
          </div>
          <button className="btn btn--primary" type="submit" disabled={busy || !pwValid}>
            {busy ? 'กำลังสมัคร...' : 'สมัครและเริ่มใช้งาน'}
          </button>
        </form>
      )}

      {/* Step: Google profile completion */}
      {step === 'gprofile' && (
        <form className="fade-up" onSubmit={registerGoogle}>
          <div className="header">
            <h1 className="h1">ตั้งค่าโปรไฟล์</h1>
            <p className="sub">ยืนยันตัวตนด้วย Google เรียบร้อย — กรอกข้อมูลอีกเล็กน้อย</p>
          </div>
          <ProfileFields
            nickname={nickname}
            setNickname={setNickname}
            age={age}
            setAge={setAge}
            gender={gender}
            setGender={setGender}
          />
          <button className="btn btn--primary" type="submit" disabled={busy}>
            {busy ? 'กำลังสมัคร...' : 'เริ่มใช้งาน'}
          </button>
        </form>
      )}
    </div>
  );
}
