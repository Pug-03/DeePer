import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import multer from 'multer';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';
import { db } from '../db.js';
import { isRealImage } from '../images.js';
import { CATEGORIES } from '../questions-bank.js';
import { sendOtpEmail, mailerReady } from '../mailer.js';
import {
  hashPassword,
  verifyPassword,
  signToken,
  validatePassword,
  publicUser,
  requireAuth,
  checkAdminLogin,
  signAdminToken,
} from '../auth.js';

const router = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

const __dirname = dirname(fileURLToPath(import.meta.url));
const AVATAR_DIR = join(__dirname, '..', '..', 'uploads', 'avatars');
const avatarPath = (avatarUrl) => join(AVATAR_DIR, basename(avatarUrl));
const PARTNER_AVATAR_DIR = join(__dirname, '..', '..', 'uploads', 'partner_avatars');
const partnerAvatarPath = (avatarUrl) => join(PARTNER_AVATAR_DIR, basename(avatarUrl));
fs.mkdirSync(PARTNER_AVATAR_DIR, { recursive: true });

const AVATAR_MIME_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: AVATAR_DIR,
    filename: (req, file, cb) => cb(null, `${req.user.id}-${Date.now()}${AVATAR_MIME_EXT[file.mimetype]}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, !!AVATAR_MIME_EXT[file.mimetype]),
});
const partnerAvatarUpload = multer({
  storage: multer.diskStorage({
    destination: PARTNER_AVATAR_DIR,
    filename: (req, file, cb) =>
      cb(null, `${req.user.id}-${req.params.category}-${Date.now()}${AVATAR_MIME_EXT[file.mimetype]}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, !!AVATAR_MIME_EXT[file.mimetype]),
});

// Kept in sync with PARTNER_ICONS in client/src/utils/partnerIcons.js — the
// server only needs the id whitelist, not the actual icon artwork.
const PARTNER_ICON_IDS = new Set([
  'heart', 'star', 'cat', 'dog', 'sun', 'moon', 'flower', 'coffee',
  'smile', 'music', 'gamepad', 'gift', 'cloud', 'leaf', 'bolt', 'diamond',
]);

const getPartnerOrDefault = (userId, category) =>
  db.prepare(`SELECT name, color, icon, avatar_url FROM partners WHERE user_id = ? AND category = ?`).get(
    userId,
    category,
  ) || { name: 'อีกฝ่าย', color: '#f43f5e', icon: null, avatar_url: null };

const upsertPartner = (userId, category, { name, color, icon, avatar_url }) =>
  db
    .prepare(
      `INSERT INTO partners (user_id, category, name, color, icon, avatar_url)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, category) DO UPDATE SET
         name = excluded.name, color = excluded.color, icon = excluded.icon, avatar_url = excluded.avatar_url`,
    )
    .run(userId, category, name, color, icon, avatar_url);

const isEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const genOtp = () => String(Math.floor(1000 + Math.random() * 9000)); // 4 digits

// Logged at every token-issuing endpoint below (password login, Google,
// register, password-reset) so the account settings "login history" view
// has one row per time a session was actually created. The row's own id
// doubles as that session's id — embedded in the signed token (see
// signToken) so an individual login can be revoked later without
// touching any other session.
const recordLogin = (userId, method, req) => {
  const info = db
    .prepare(`INSERT INTO login_history (user_id, method, ip, user_agent) VALUES (?, ?, ?, ?)`)
    .run(userId, method, req.ip || null, req.get('user-agent') || null);
  return Number(info.lastInsertRowid);
};

// Guards the account-takeover-shaped endpoints — OTP request/verify, login,
// password reset. 10 requests / 15 min per IP is loose enough for a real
// user retrying a typo, but caps an attacker well short of exhausting the
// 10,000 possible 4-digit OTP codes within their 10-minute expiry window.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // The test suite legitimately registers/logs in far more than 10 times
  // per run (each test gets its own account) from one machine — raise the
  // cap in test mode only, so those runs don't trip a limiter meant for a
  // single real client. Production/dev behavior is unchanged.
  max: process.env.NODE_ENV === 'test' ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'พยายามมากเกินไป กรุณาลองใหม่ภายหลัง', error_code: 'RATE_LIMITED' },
});

// --- Config for the client (which auth methods are live) ---
router.get('/config', (_req, res) => {
  res.json({
    google_enabled: !!googleClient,
    google_client_id: GOOGLE_CLIENT_ID || null,
    smtp_enabled: mailerReady,
  });
});

// --- Step 1: request OTP for email signup ---
router.post('/otp/request', authLimiter, async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!isEmail(email))
    return res.status(400).json({ error: 'อีเมลไม่ถูกต้อง', error_code: 'INVALID_EMAIL' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing)
    return res
      .status(409)
      .json({ error: 'อีเมลนี้มีบัญชีอยู่แล้ว', error_code: 'EMAIL_TAKEN' });

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
    res
      .status(500)
      .json({ error: 'ส่งรหัส OTP ไม่สำเร็จ กรุณาลองใหม่', error_code: 'OTP_SEND_FAILED' });
  }
});

// --- Step 2: verify OTP ---
router.post('/otp/verify', authLimiter, (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const code = String(req.body.code || '').trim();
  if (!isEmail(email) || !/^\d{4}$/.test(code))
    return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง', error_code: 'INVALID_INPUT' });

  const row = db
    .prepare(
      `SELECT * FROM otp_codes WHERE email = ? AND code = ? AND purpose = 'register' AND consumed = 0
       ORDER BY id DESC LIMIT 1`,
    )
    .get(email, code);

  if (!row)
    return res.status(400).json({ error: 'รหัส OTP ไม่ถูกต้อง', error_code: 'OTP_INVALID' });
  if (row.expires_at < Date.now())
    return res.status(400).json({ error: 'รหัส OTP หมดอายุแล้ว', error_code: 'OTP_EXPIRED' });

  res.json({ ok: true });
});

// Signup asks for the nickname twice: in Thai (stored in `nickname`) and in
// English (`nickname_en`). The Thai one must contain Thai script and no
// Latin letters; the English one only Latin letters plus space . ' -.
const THAI_RE = /[\u0E00-\u0E7F]/;
const LATIN_RE = /[A-Za-z]/;
const EN_NAME_RE = /^[A-Za-z][A-Za-z .'-]*$/;

function nameError(nickname, nicknameEn) {
  const th = String(nickname ?? '').trim();
  const en = String(nicknameEn ?? '').trim();
  if (!th) return { error: 'กรุณากรอกชื่อเล่นภาษาไทย', error_code: 'NICKNAME_REQUIRED' };
  if (!THAI_RE.test(th) || LATIN_RE.test(th))
    return { error: 'ชื่อเล่นภาษาไทยต้องเป็นตัวอักษรไทย', error_code: 'NICKNAME_TH_INVALID' };
  if (!en) return { error: 'กรุณากรอกชื่อเล่นภาษาอังกฤษ', error_code: 'NICKNAME_EN_REQUIRED' };
  if (!EN_NAME_RE.test(en))
    return { error: 'ชื่อเล่นภาษาอังกฤษต้องเป็นตัวอักษรภาษาอังกฤษ', error_code: 'NICKNAME_EN_INVALID' };
  return null;
}

// Same rule as the signup form (client/src/pages/Signup.jsx): a whole number
// from 1 to 120. Checked here too, so the profile page or a direct API call
// can't store 0, 999 or -5.
function ageError(age) {
  if (age == null || age === '' || Number.isNaN(Number(age)))
    return { error: 'กรุณากรอกอายุ', error_code: 'AGE_REQUIRED' };
  const n = Number(age);
  if (!Number.isInteger(n) || n < 1 || n > 120)
    return { error: 'อายุต้องเป็นตัวเลข 1–120', error_code: 'AGE_INVALID' };
  return null;
}

// --- Step 3: complete email signup ---
router.post('/register', authLimiter, (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const code = String(req.body.code || '').trim();
  const { nickname, nickname_en: nicknameEn, age, gender, password } = req.body;

  if (!isEmail(email))
    return res.status(400).json({ error: 'อีเมลไม่ถูกต้อง', error_code: 'INVALID_EMAIL' });
  const badName = nameError(nickname, nicknameEn);
  if (badName) return res.status(400).json(badName);
  const badAge = ageError(age);
  if (badAge) return res.status(400).json(badAge);
  if (!gender)
    return res.status(400).json({ error: 'กรุณาเลือกเพศ', error_code: 'GENDER_REQUIRED' });
  if (!validatePassword(password))
    return res.status(400).json({
      error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัว มีพิมพ์ใหญ่ พิมพ์เล็ก ตัวเลข และอักขระพิเศษ',
      error_code: 'PASSWORD_WEAK',
    });

  const otp = db
    .prepare(
      `SELECT * FROM otp_codes WHERE email = ? AND code = ? AND purpose = 'register' AND consumed = 0
       ORDER BY id DESC LIMIT 1`,
    )
    .get(email, code);
  if (!otp || otp.expires_at < Date.now())
    return res
      .status(400)
      .json({ error: 'ต้องยืนยัน OTP ก่อนสมัคร', error_code: 'OTP_NOT_VERIFIED' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing)
    return res
      .status(409)
      .json({ error: 'อีเมลนี้มีบัญชีอยู่แล้ว', error_code: 'EMAIL_TAKEN' });

  const info = db
    .prepare(
      `INSERT INTO users (email, nickname, nickname_en, age, gender, password_hash)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      email,
      String(nickname).trim(),
      String(nicknameEn).trim(),
      age ? Number(age) : null,
      gender || null,
      hashPassword(password),
    );

  db.prepare('UPDATE otp_codes SET consumed = 1 WHERE id = ?').run(otp.id);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  const sessionId = recordLogin(user.id, 'register', req);
  res.json({ token: signToken(user, sessionId), user: publicUser(user) });
});

// --- Email + password login ---
router.post('/login', authLimiter, (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!isEmail(email) || !password)
    return res
      .status(400)
      .json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน', error_code: 'EMAIL_PASSWORD_REQUIRED' });

  // The admin signs in on this same form: their credentials (from env, not
  // the users table) get an admin token instead of a user session.
  if (checkAdminLogin(email, password)) return res.json({ admin_token: signAdminToken() });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !verifyPassword(password, user.password_hash))
    return res
      .status(401)
      .json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', error_code: 'LOGIN_INVALID' });

  const sessionId = recordLogin(user.id, 'password', req);
  res.json({ token: signToken(user, sessionId), user: publicUser(user) });
});

// --- Forgot password — Step 1: request OTP ---
router.post('/password-reset/request', authLimiter, async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!isEmail(email))
    return res.status(400).json({ error: 'อีเมลไม่ถูกต้อง', error_code: 'INVALID_EMAIL' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user)
    return res
      .status(404)
      .json({ error: 'ไม่พบบัญชีที่ใช้อีเมลนี้', error_code: 'EMAIL_NOT_FOUND' });
  if (!user.password_hash)
    return res.status(400).json({
      error: 'บัญชีนี้สมัครด้วย Google กรุณาเข้าสู่ระบบด้วย Google แทน',
      error_code: 'ACCOUNT_IS_GOOGLE',
    });

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
    res
      .status(500)
      .json({ error: 'ส่งรหัส OTP ไม่สำเร็จ กรุณาลองใหม่', error_code: 'OTP_SEND_FAILED' });
  }
});

// --- Forgot password — Step 2: verify OTP ---
router.post('/password-reset/verify', authLimiter, (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const code = String(req.body.code || '').trim();
  if (!isEmail(email) || !/^\d{4}$/.test(code))
    return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง', error_code: 'INVALID_INPUT' });

  const row = db
    .prepare(
      `SELECT * FROM otp_codes WHERE email = ? AND code = ? AND purpose = 'reset' AND consumed = 0
       ORDER BY id DESC LIMIT 1`,
    )
    .get(email, code);

  if (!row)
    return res.status(400).json({ error: 'รหัส OTP ไม่ถูกต้อง', error_code: 'OTP_INVALID' });
  if (row.expires_at < Date.now())
    return res.status(400).json({ error: 'รหัส OTP หมดอายุแล้ว', error_code: 'OTP_EXPIRED' });

  res.json({ ok: true });
});

// --- Forgot password — Step 3: set new password (auto-login on success) ---
router.post('/password-reset/confirm', authLimiter, (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const code = String(req.body.code || '').trim();
  const { password } = req.body;

  if (!isEmail(email))
    return res.status(400).json({ error: 'อีเมลไม่ถูกต้อง', error_code: 'INVALID_EMAIL' });
  if (!validatePassword(password))
    return res.status(400).json({
      error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัว มีพิมพ์ใหญ่ พิมพ์เล็ก ตัวเลข และอักขระพิเศษ',
      error_code: 'PASSWORD_WEAK',
    });

  const otp = db
    .prepare(
      `SELECT * FROM otp_codes WHERE email = ? AND code = ? AND purpose = 'reset' AND consumed = 0
       ORDER BY id DESC LIMIT 1`,
    )
    .get(email, code);
  if (!otp || otp.expires_at < Date.now())
    return res
      .status(400)
      .json({ error: 'ต้องยืนยัน OTP ก่อนตั้งรหัสผ่านใหม่', error_code: 'OTP_NOT_VERIFIED_RESET' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user)
    return res
      .status(404)
      .json({ error: 'ไม่พบบัญชีที่ใช้อีเมลนี้', error_code: 'EMAIL_NOT_FOUND' });

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
    hashPassword(password),
    user.id,
  );
  db.prepare('UPDATE otp_codes SET consumed = 1 WHERE id = ?').run(otp.id);
  // A reset usually means the old password can't be trusted: sign every
  // existing session out, so whoever might have it is logged out too.
  db.prepare(
    `UPDATE login_history SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL`,
  ).run(user.id);

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  const sessionId = recordLogin(updated.id, 'password_reset', req);
  res.json({ token: signToken(updated, sessionId), user: publicUser(updated) });
});

// --- Google OAuth (verify ID token from Google Identity Services) ---
router.post('/google', async (req, res) => {
  if (!googleClient)
    return res.status(503).json({
      error: 'ยังไม่ได้เปิดใช้งานการเข้าสู่ระบบด้วย Google',
      error_code: 'GOOGLE_DISABLED',
    });

  const credential = req.body.credential;
  if (!credential)
    return res
      .status(400)
      .json({ error: 'ไม่พบข้อมูลรับรองจาก Google', error_code: 'GOOGLE_CREDENTIAL_MISSING' });

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    return res
      .status(401)
      .json({ error: 'ยืนยันตัวตนกับ Google ไม่สำเร็จ', error_code: 'GOOGLE_AUTH_FAILED' });
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
    const { nickname, nickname_en: nicknameEn, age, gender } = req.body;
    if (!nickname || String(nickname).trim().length < 1) {
      return res.json({
        needs_profile: true,
        email,
        suggested_nickname: payload.given_name || payload.name || '',
      });
    }
    const badName = nameError(nickname, nicknameEn);
    if (badName) return res.status(400).json(badName);
    const badAge = ageError(age);
    if (badAge) return res.status(400).json(badAge);
    if (!gender)
      return res.status(400).json({ error: 'กรุณาเลือกเพศ', error_code: 'GENDER_REQUIRED' });
    const info = db
      .prepare(
        `INSERT INTO users (email, google_sub, nickname, nickname_en, age, gender)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        email || null,
        sub,
        String(nickname).trim(),
        String(nicknameEn).trim(),
        age ? Number(age) : null,
        gender || null,
      );
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  }

  const sessionId = recordLogin(user.id, 'google', req);
  res.json({ token: signToken(user, sessionId), user: publicUser(user) });
});

// --- Current user ---
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// --- Login history — each row is its own revocable session (see
// requireAuth's sid check). current_id tells the client which row this
// very request came in on, so it can label/disable that one differently.
router.get('/me/login-history', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, method, ip, user_agent, revoked_at, created_at FROM login_history
       WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 100`,
    )
    .all(req.user.id);
  const { c: total } = db
    .prepare(`SELECT COUNT(*) AS c FROM login_history WHERE user_id = ?`)
    .get(req.user.id);
  res.json({ login_history: rows, total, current_id: req.sessionId });
});

// --- Log out one specific device/session — revokes just that login_history
// row, so only the token issued for that one login stops working (see
// requireAuth). No-ops (still 200) if the id doesn't belong to this user
// or is already revoked, matching the delete-by-id pattern used elsewhere
// (e.g. DELETE /history/:id) rather than leaking which ids exist.
router.delete('/me/login-history/:id', requireAuth, (req, res) => {
  db.prepare(
    `UPDATE login_history SET revoked_at = datetime('now') WHERE id = ? AND user_id = ? AND revoked_at IS NULL`,
  ).run(Number(req.params.id), req.user.id);
  res.json({ ok: true });
});

// --- Log out of every OTHER device/session at once — revokes every
// not-yet-revoked login_history row for this user except the one the
// current request came in on.
router.post('/me/logout-other-devices', requireAuth, (req, res) => {
  const { changes } = db
    .prepare(
      `UPDATE login_history SET revoked_at = datetime('now')
       WHERE user_id = ? AND id != ? AND revoked_at IS NULL`,
    )
    .run(req.user.id, req.sessionId);
  res.json({ ok: true, revoked: changes });
});

// --- Update profile ---
router.patch('/me', requireAuth, (req, res) => {
  const { nickname, nickname_en: nicknameEn, age, gender } = req.body;
  const u = req.user;

  // Either name may be sent on its own; the resulting pair is validated as
  // at signup. The one exception: an account made before English names
  // existed can still save its Thai name alone until it adds one.
  const nextTh = nickname != null ? String(nickname).trim() : u.nickname;
  const nextEn = nicknameEn != null ? String(nicknameEn).trim() : u.nickname_en;
  if (nickname != null || nicknameEn != null) {
    const badName = nameError(nextTh, nextEn);
    const legacyNoEn = nicknameEn == null && !nextEn && badName?.error_code === 'NICKNAME_EN_REQUIRED';
    if (badName && !legacyNoEn) return res.status(400).json(badName);
  }
  if (age != null && age !== '') {
    const badAge = ageError(age);
    if (badAge) return res.status(400).json(badAge);
  }

  db.prepare(`UPDATE users SET nickname = ?, nickname_en = ?, age = ?, gender = ? WHERE id = ?`).run(
    nextTh,
    nextEn ?? null,
    age != null && age !== '' ? Number(age) : u.age,
    gender != null ? gender : u.gender,
    u.id,
  );
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(u.id);
  res.json({ user: publicUser(updated) });
});

// --- Update one category's partner (name/color/icon) ---
router.patch('/me/partner/:category', requireAuth, (req, res) => {
  const { category } = req.params;
  if (!CATEGORIES.includes(category))
    return res.status(400).json({ error: 'หมวดไม่ถูกต้อง', error_code: 'INVALID_CATEGORY' });

  const { name, color, icon } = req.body;
  const current = getPartnerOrDefault(req.user.id, category);

  // Picking a stock icon clears any uploaded partner photo for this
  // category — the two are mutually exclusive representations of the same
  // slot (see the avatar upload route below, which does the reverse).
  let nextIcon = current.icon;
  let nextAvatarUrl = current.avatar_url;
  if (icon !== undefined) {
    if (icon === null || icon === '') {
      nextIcon = null;
    } else if (PARTNER_ICON_IDS.has(icon)) {
      nextIcon = icon;
      if (nextAvatarUrl) {
        fs.unlink(partnerAvatarPath(nextAvatarUrl), () => {});
        nextAvatarUrl = null;
      }
    } else {
      return res
        .status(400)
        .json({ error: 'ไอคอนไม่ถูกต้อง', error_code: 'PARTNER_ICON_INVALID' });
    }
  }

  upsertPartner(req.user.id, category, {
    name: name != null ? String(name).trim() : current.name,
    color: color != null ? color : current.color,
    icon: nextIcon,
    avatar_url: nextAvatarUrl,
  });

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicUser(updated) });
});

// --- Upload a category's partner photo (clears any picked icon) ---
router.post('/me/partner/:category/avatar', requireAuth, (req, res) => {
  const { category } = req.params;
  if (!CATEGORIES.includes(category))
    return res.status(400).json({ error: 'หมวดไม่ถูกต้อง', error_code: 'INVALID_CATEGORY' });

  partnerAvatarUpload.single('avatar')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE')
        return res
          .status(400)
          .json({ error: 'ไฟล์รูปใหญ่เกินไป (สูงสุด 5MB)', error_code: 'AVATAR_TOO_LARGE' });
      return res
        .status(400)
        .json({ error: 'อัปโหลดรูปไม่สำเร็จ', error_code: 'AVATAR_UPLOAD_FAILED' });
    }
    if (!req.file || !isRealImage(req.file.path)) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        error: 'รองรับเฉพาะไฟล์รูป JPG, PNG, WEBP',
        error_code: 'AVATAR_TYPE_INVALID',
      });
    }

    const current = getPartnerOrDefault(req.user.id, category);
    const avatar_url = `/uploads/partner_avatars/${req.file.filename}`;
    upsertPartner(req.user.id, category, { name: current.name, color: current.color, icon: null, avatar_url });
    if (current.avatar_url) fs.unlink(partnerAvatarPath(current.avatar_url), () => {});

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json({ user: publicUser(updated) });
  });
});

// --- Remove a category's partner photo ---
router.delete('/me/partner/:category/avatar', requireAuth, (req, res) => {
  const { category } = req.params;
  if (!CATEGORIES.includes(category))
    return res.status(400).json({ error: 'หมวดไม่ถูกต้อง', error_code: 'INVALID_CATEGORY' });

  const current = getPartnerOrDefault(req.user.id, category);
  if (current.avatar_url) {
    fs.unlink(partnerAvatarPath(current.avatar_url), () => {});
    upsertPartner(req.user.id, category, { ...current, avatar_url: null });
  }
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicUser(updated) });
});

// --- Change / set password. Accounts created via Google have no
// password_hash yet, so current_password isn't required for them — this
// doubles as the "add a password" flow that also unlocks email login.
router.post('/me/password', requireAuth, (req, res) => {
  const u = req.user;
  const currentPassword = String(req.body.current_password || '');
  const newPassword = req.body.new_password;

  if (u.password_hash) {
    if (!currentPassword)
      return res
        .status(400)
        .json({ error: 'กรุณากรอกรหัสผ่าน', error_code: 'PASSWORD_REQUIRED' });
    if (!verifyPassword(currentPassword, u.password_hash))
      return res
        .status(401)
        .json({ error: 'รหัสผ่านไม่ถูกต้อง', error_code: 'PASSWORD_INCORRECT' });
  }
  if (!validatePassword(newPassword))
    return res.status(400).json({
      error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัว มีพิมพ์ใหญ่ พิมพ์เล็ก ตัวเลข และอักขระพิเศษ',
      error_code: 'PASSWORD_WEAK',
    });

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), u.id);
  // Changing the password signs out every other device; this one stays in.
  db.prepare(
    `UPDATE login_history SET revoked_at = datetime('now')
     WHERE user_id = ? AND id != ? AND revoked_at IS NULL`,
  ).run(u.id, req.sessionId);
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(u.id);
  res.json({ user: publicUser(updated) });
});

// --- Upload profile picture ---
router.post('/me/avatar', requireAuth, (req, res) => {
  avatarUpload.single('avatar')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE')
        return res
          .status(400)
          .json({ error: 'ไฟล์รูปใหญ่เกินไป (สูงสุด 5MB)', error_code: 'AVATAR_TOO_LARGE' });
      return res
        .status(400)
        .json({ error: 'อัปโหลดรูปไม่สำเร็จ', error_code: 'AVATAR_UPLOAD_FAILED' });
    }
    if (!req.file || !isRealImage(req.file.path)) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        error: 'รองรับเฉพาะไฟล์รูป JPG, PNG, WEBP',
        error_code: 'AVATAR_TYPE_INVALID',
      });
    }

    const u = req.user;
    const oldAvatarUrl = u.avatar_url;
    const avatar_url = `/uploads/avatars/${req.file.filename}`;
    db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatar_url, u.id);
    if (oldAvatarUrl) fs.unlink(avatarPath(oldAvatarUrl), () => {});

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(u.id);
    res.json({ user: publicUser(updated) });
  });
});

// --- Remove profile picture ---
router.delete('/me/avatar', requireAuth, (req, res) => {
  const u = req.user;
  if (u.avatar_url) {
    fs.unlink(avatarPath(u.avatar_url), () => {});
    db.prepare('UPDATE users SET avatar_url = NULL WHERE id = ?').run(u.id);
  }
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(u.id);
  res.json({ user: publicUser(updated) });
});

// --- Delete account ---
router.delete('/me', requireAuth, (req, res) => {
  const u = req.user;
  const password = String(req.body.password || '');

  if (u.password_hash) {
    if (!password)
      return res
        .status(400)
        .json({ error: 'กรุณากรอกรหัสผ่าน', error_code: 'PASSWORD_REQUIRED' });
    if (!verifyPassword(password, u.password_hash))
      return res
        .status(401)
        .json({ error: 'รหัสผ่านไม่ถูกต้อง', error_code: 'PASSWORD_INCORRECT' });
  }

  if (u.avatar_url) fs.unlink(avatarPath(u.avatar_url), () => {});
  const partnerAvatars = db
    .prepare(`SELECT avatar_url FROM partners WHERE user_id = ? AND avatar_url IS NOT NULL`)
    .all(u.id);
  for (const { avatar_url } of partnerAvatars) fs.unlink(partnerAvatarPath(avatar_url), () => {});

  db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
  res.json({ ok: true });
});

export default router;
