import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { db } from '../db.js';
import { sendOtpEmail, mailerReady } from '../mailer.js';
import {
  hashPassword,
  verifyPassword,
  signToken,
  validatePassword,
  publicUser,
  requireAuth,
} from '../auth.js';

const router = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

const isEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const genOtp = () => String(Math.floor(1000 + Math.random() * 9000)); // 4 digits

// --- Config for the client (which auth methods are live) ---
router.get('/config', (_req, res) => {
  res.json({
    google_enabled: !!googleClient,
    google_client_id: GOOGLE_CLIENT_ID || null,
    smtp_enabled: mailerReady,
  });
});

// --- Step 1: request OTP for email signup ---
router.post('/otp/request', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!isEmail(email)) return res.status(400).json({ error: 'อีเมลไม่ถูกต้อง' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'อีเมลนี้มีบัญชีอยู่แล้ว' });

  const code = genOtp();
  const expires = Date.now() + 10 * 60 * 1000;
  db.prepare(
    `INSERT INTO otp_codes (email, code, purpose, expires_at) VALUES (?, ?, 'register', ?)`,
  ).run(email, code, expires);

  try {
    const result = await sendOtpEmail(email, code, 'register');
    // In dev (no SMTP) we return the code so the flow is testable end-to-end.
    res.json({ ok: true, dev_code: result.delivered ? undefined : result.devCode });
  } catch (e) {
    console.error('[otp] send failed', e);
    res.status(500).json({ error: 'ส่งรหัส OTP ไม่สำเร็จ กรุณาลองใหม่' });
  }
});

// --- Step 2: verify OTP ---
router.post('/otp/verify', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const code = String(req.body.code || '').trim();
  if (!isEmail(email) || !/^\d{4}$/.test(code))
    return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง' });

  const row = db
    .prepare(
      `SELECT * FROM otp_codes WHERE email = ? AND code = ? AND purpose = 'register' AND consumed = 0
       ORDER BY id DESC LIMIT 1`,
    )
    .get(email, code);

  if (!row) return res.status(400).json({ error: 'รหัส OTP ไม่ถูกต้อง' });
  if (row.expires_at < Date.now())
    return res.status(400).json({ error: 'รหัส OTP หมดอายุแล้ว' });

  res.json({ ok: true });
});

// --- Step 3: complete email signup ---
router.post('/register', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const code = String(req.body.code || '').trim();
  const { nickname, age, gender, password } = req.body;

  if (!isEmail(email)) return res.status(400).json({ error: 'อีเมลไม่ถูกต้อง' });
  if (!nickname || String(nickname).trim().length < 1)
    return res.status(400).json({ error: 'กรุณากรอกชื่อเล่น' });
  if (!validatePassword(password))
    return res
      .status(400)
      .json({ error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัว มีพิมพ์ใหญ่ พิมพ์เล็ก ตัวเลข และอักขระพิเศษ' });

  const otp = db
    .prepare(
      `SELECT * FROM otp_codes WHERE email = ? AND code = ? AND purpose = 'register' AND consumed = 0
       ORDER BY id DESC LIMIT 1`,
    )
    .get(email, code);
  if (!otp || otp.expires_at < Date.now())
    return res.status(400).json({ error: 'ต้องยืนยัน OTP ก่อนสมัคร' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'อีเมลนี้มีบัญชีอยู่แล้ว' });

  const info = db
    .prepare(
      `INSERT INTO users (email, nickname, age, gender, password_hash)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      email,
      String(nickname).trim(),
      age ? Number(age) : null,
      gender || null,
      hashPassword(password),
    );

  db.prepare('UPDATE otp_codes SET consumed = 1 WHERE id = ?').run(otp.id);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.json({ token: signToken(user), user: publicUser(user) });
});

// --- Email + password login ---
router.post('/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!isEmail(email) || !password)
    return res.status(400).json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !verifyPassword(password, user.password_hash))
    return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });

  res.json({ token: signToken(user), user: publicUser(user) });
});

// --- Forgot password — Step 1: request OTP ---
router.post('/password-reset/request', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!isEmail(email)) return res.status(400).json({ error: 'อีเมลไม่ถูกต้อง' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(404).json({ error: 'ไม่พบบัญชีที่ใช้อีเมลนี้' });
  if (!user.password_hash)
    return res
      .status(400)
      .json({ error: 'บัญชีนี้สมัครด้วย Google กรุณาเข้าสู่ระบบด้วย Google แทน' });

  const code = genOtp();
  const expires = Date.now() + 10 * 60 * 1000;
  db.prepare(
    `INSERT INTO otp_codes (email, code, purpose, expires_at) VALUES (?, ?, 'reset', ?)`,
  ).run(email, code, expires);

  try {
    const result = await sendOtpEmail(email, code, 'reset');
    res.json({ ok: true, dev_code: result.delivered ? undefined : result.devCode });
  } catch (e) {
    console.error('[password-reset] send failed', e);
    res.status(500).json({ error: 'ส่งรหัส OTP ไม่สำเร็จ กรุณาลองใหม่' });
  }
});

// --- Forgot password — Step 2: verify OTP ---
router.post('/password-reset/verify', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const code = String(req.body.code || '').trim();
  if (!isEmail(email) || !/^\d{4}$/.test(code))
    return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง' });

  const row = db
    .prepare(
      `SELECT * FROM otp_codes WHERE email = ? AND code = ? AND purpose = 'reset' AND consumed = 0
       ORDER BY id DESC LIMIT 1`,
    )
    .get(email, code);

  if (!row) return res.status(400).json({ error: 'รหัส OTP ไม่ถูกต้อง' });
  if (row.expires_at < Date.now())
    return res.status(400).json({ error: 'รหัส OTP หมดอายุแล้ว' });

  res.json({ ok: true });
});

// --- Forgot password — Step 3: set new password (auto-login on success) ---
router.post('/password-reset/confirm', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const code = String(req.body.code || '').trim();
  const { password } = req.body;

  if (!isEmail(email)) return res.status(400).json({ error: 'อีเมลไม่ถูกต้อง' });
  if (!validatePassword(password))
    return res
      .status(400)
      .json({ error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัว มีพิมพ์ใหญ่ พิมพ์เล็ก ตัวเลข และอักขระพิเศษ' });

  const otp = db
    .prepare(
      `SELECT * FROM otp_codes WHERE email = ? AND code = ? AND purpose = 'reset' AND consumed = 0
       ORDER BY id DESC LIMIT 1`,
    )
    .get(email, code);
  if (!otp || otp.expires_at < Date.now())
    return res.status(400).json({ error: 'ต้องยืนยัน OTP ก่อนตั้งรหัสผ่านใหม่' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(404).json({ error: 'ไม่พบบัญชีที่ใช้อีเมลนี้' });

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
    hashPassword(password),
    user.id,
  );
  db.prepare('UPDATE otp_codes SET consumed = 1 WHERE id = ?').run(otp.id);

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  res.json({ token: signToken(updated), user: publicUser(updated) });
});

// --- Google OAuth (verify ID token from Google Identity Services) ---
router.post('/google', async (req, res) => {
  if (!googleClient)
    return res.status(503).json({ error: 'ยังไม่ได้เปิดใช้งานการเข้าสู่ระบบด้วย Google' });

  const credential = req.body.credential;
  if (!credential) return res.status(400).json({ error: 'ไม่พบข้อมูลรับรองจาก Google' });

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ error: 'ยืนยันตัวตนกับ Google ไม่สำเร็จ' });
  }

  const sub = payload.sub;
  const email = (payload.email || '').toLowerCase();
  let user = db.prepare('SELECT * FROM users WHERE google_sub = ?').get(sub);

  if (!user && email) {
    // Link to an existing email account if one exists.
    const byEmail = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (byEmail) {
      db.prepare('UPDATE users SET google_sub = ? WHERE id = ?').run(sub, byEmail.id);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(byEmail.id);
    }
  }

  if (!user) {
    // New Google account — needs profile completion (nickname/age/gender).
    const { nickname, age, gender } = req.body;
    if (!nickname || String(nickname).trim().length < 1) {
      return res.json({
        needs_profile: true,
        email,
        suggested_nickname: payload.given_name || payload.name || '',
      });
    }
    const info = db
      .prepare(
        `INSERT INTO users (email, google_sub, nickname, age, gender)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(email || null, sub, String(nickname).trim(), age ? Number(age) : null, gender || null);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  }

  res.json({ token: signToken(user), user: publicUser(user) });
});

// --- Current user ---
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// --- Update profile ---
router.patch('/me', requireAuth, (req, res) => {
  const { nickname, age, gender, partner_name, partner_color } = req.body;
  const u = req.user;
  db.prepare(
    `UPDATE users SET
       nickname = ?, age = ?, gender = ?, partner_name = ?, partner_color = ?
     WHERE id = ?`,
  ).run(
    nickname != null ? String(nickname).trim() : u.nickname,
    age != null && age !== '' ? Number(age) : u.age,
    gender != null ? gender : u.gender,
    partner_name != null ? String(partner_name).trim() : u.partner_name,
    partner_color != null ? partner_color : u.partner_color,
    u.id,
  );
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(u.id);
  res.json({ user: publicUser(updated) });
});

// --- Delete account ---
router.delete('/me', requireAuth, (req, res) => {
  const u = req.user;
  const password = String(req.body.password || '');

  if (u.password_hash) {
    if (!password) return res.status(400).json({ error: 'กรุณากรอกรหัสผ่าน' });
    if (!verifyPassword(password, u.password_hash))
      return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
  res.json({ ok: true });
});

export default router;
