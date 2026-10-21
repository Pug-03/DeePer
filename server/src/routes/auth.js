import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import multer from 'multer';
import fs from 'node:fs';
import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { join, basename } from 'node:path';
import { db } from '../db.js';
import { isRealImage } from '../images.js';
import { CATEGORIES } from '../questions-bank.js';
import { sendOtpEmail, mailerReady } from '../mailer.js';
import {
  hashPassword,
  verifyPassword,
  verifyPasswordOrWaste,
  signToken,
  validatePassword,
  publicUser,
  requireAuth,
  checkAdminLogin,
  isAdminEmail,
  signAdminToken,
} from '../auth.js';
import { UPLOADS_DIR } from '../paths.js';
import { inviteRequired, signupGateError } from '../signupGate.js';
import { slipFile } from './support.js';

const router = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

const AVATAR_DIR = join(UPLOADS_DIR, 'avatars');
const avatarPath = (avatarUrl) => join(AVATAR_DIR, basename(avatarUrl));
const PARTNER_AVATAR_DIR = join(UPLOADS_DIR, 'partner_avatars');
const partnerAvatarPath = (avatarUrl) => join(PARTNER_AVATAR_DIR, basename(avatarUrl));
fs.mkdirSync(PARTNER_AVATAR_DIR, { recursive: true });

const AVATAR_MIME_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: AVATAR_DIR,
    // Random names: "<userId>-<time>" let anyone walk through everyone's photos.
    filename: (req, file, cb) => cb(null, `${randomBytes(16).toString('hex')}${AVATAR_MIME_EXT[file.mimetype]}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, !!AVATAR_MIME_EXT[file.mimetype]),
});
const partnerAvatarUpload = multer({
  storage: multer.diskStorage({
    destination: PARTNER_AVATAR_DIR,
    filename: (req, file, cb) => cb(null, `${randomBytes(16).toString('hex')}${AVATAR_MIME_EXT[file.mimetype]}`),
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
  ) || { name: 'อีกฝ่าย', color: '#a78bfa', icon: null, avatar_url: null };

const upsertPartner = (userId, category, { name, color, icon, avatar_url }) =>
  db
    .prepare(
      `INSERT INTO partners (user_id, category, name, color, icon, avatar_url)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, category) DO UPDATE SET
         name = excluded.name, color = excluded.color, icon = excluded.icon, avatar_url = excluded.avatar_url`,
    )
    .run(userId, category, name, color, icon, avatar_url);

// At most 254 characters (the longest real address), plain local@domain
// only: no comments, quotes or angle brackets for the mail parser to chew on.
const isEmail = (s) =>
  typeof s === 'string' && s.length <= 254 && /^[^\s@()<>,;:"\[\]\\]+@[^\s@()<>,;:"\[\]\\]+\.[^\s@()<>,;:"\[\]\\]+$/.test(s);

// One-time codes (4 digits, mailed for signup and password reset). Guarding
// them is what keeps a reset code from being guessed into someone's account:
// - only the newest code for an email works (asking again voids the old ones),
// - a code dies after OTP_MAX_TRIES wrong guesses,
// - an email gets at most OTP_SENDS_PER_HOUR codes an hour and
//   OTP_SENDS_PER_DAY a day,
// all counted per email, so spreading guesses over many IPs doesn't help.
// The daily cap is what bounds a patient attacker: 6 codes x 5 tries is 30
// guesses a day out of 10,000, where the hourly cap alone allowed ~600.
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_TRIES = 5;
const OTP_SENDS_PER_HOUR = 5;
const OTP_SENDS_PER_DAY = 6;
const genOtp = () => String(randomInt(1000, 10000));

// null when a new code may be sent, else { status, body }.
function otpSendLimit(email, purpose) {
  const { hour, day } = db
    .prepare(
      `SELECT COUNT(CASE WHEN created_at > datetime('now', '-1 hour') THEN 1 END) AS hour, COUNT(*) AS day
       FROM otp_codes WHERE email = ? AND purpose = ? AND created_at > datetime('now', '-1 day')`,
    )
    .get(email, purpose);
  if (day >= OTP_SENDS_PER_DAY)
    return {
      status: 429,
      body: { error: 'ขอรหัสครบจำนวนของวันนี้แล้ว ลองใหม่อีกครั้งพรุ่งนี้', error_code: 'OTP_DAILY_LIMIT' },
    };
  if (hour < OTP_SENDS_PER_HOUR) return null;
  return {
    status: 429,
    body: { error: 'ขอรหัสบ่อยเกินไป ลองใหม่อีกครั้งในอีก 1 ชั่วโมง', error_code: 'OTP_TOO_MANY' },
  };
}

// Voids this email's earlier codes for the purpose and stores a fresh one.
function issueOtp(email, purpose) {
  const code = genOtp();
  db.prepare(`UPDATE otp_codes SET consumed = 1 WHERE email = ? AND purpose = ? AND consumed = 0`).run(email, purpose);
  db.prepare(`INSERT INTO otp_codes (email, code, purpose, expires_at) VALUES (?, ?, ?, ?)`).run(
    email,
    code,
    purpose,
    Date.now() + OTP_TTL_MS,
  );
  return code;
}

const sameCode = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

// Checks a typed code against the email's live code. Returns { otp } when it
// matches, or { error: { status, body } }. A wrong guess counts against the
// code; the last allowed one kills it.
function checkOtp(email, purpose, code) {
  const otp = db
    .prepare(`SELECT * FROM otp_codes WHERE email = ? AND purpose = ? AND consumed = 0 ORDER BY id DESC LIMIT 1`)
    .get(email, purpose);
  const invalid = { status: 400, body: { error: 'รหัส OTP ไม่ถูกต้อง', error_code: 'OTP_INVALID' } };
  if (!otp) return { error: invalid };
  if (otp.expires_at < Date.now())
    return { error: { status: 400, body: { error: 'รหัส OTP หมดอายุแล้ว', error_code: 'OTP_EXPIRED' } } };
  if (sameCode(otp.code, code)) return { otp };
  const tries = otp.attempts + 1;
  db.prepare('UPDATE otp_codes SET attempts = ?, consumed = ? WHERE id = ?').run(
    tries,
    tries >= OTP_MAX_TRIES ? 1 : 0,
    otp.id,
  );
  if (tries >= OTP_MAX_TRIES)
    return {
      error: {
        status: 400,
        body: { error: 'ใส่รหัสผิดหลายครั้ง กรุณาขอรหัสใหม่', error_code: 'OTP_LOCKED' },
      },
    };
  return { error: invalid };
}

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

// Rate limits for the account endpoints, per IP over 15 minutes. They used
// to share one counter of 10 across everything — requesting an OTP,
// checking it, registering, logging in — so one signup (request + verify +
// a retried submit) plus a login or two already hit "tried too many times".
// Now each kind of request has its own counter, and the ones that guard a
// secret (OTP checks, passwords) only count failed attempts: a correct code
// or password never uses up the allowance. The caps still stop someone
// working through the 10,000 possible 4-digit OTPs before they expire.
//
// Outside production (local dev) the caps are far higher, so testing the
// signup flow over and over doesn't lock you out; the test suite likewise.
const LIMIT_SCALE = process.env.NODE_ENV === 'production' ? 1 : 100;
const limiter = (max, { failedOnly = false } = {}) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: max * LIMIT_SCALE,
    skipSuccessfulRequests: failedOnly,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'พยายามมากเกินไป กรุณาลองใหม่ภายหลัง', error_code: 'RATE_LIMITED' },
  });
// Sending an email (OTP or reset code): each send counts, to stop mail spam.
const sendCodeLimiter = limiter(8);
// Typing a code or password: only wrong ones count.
const checkSecretLimiter = limiter(10, { failedOnly: true });
// Creating the account / setting the new password: needs a valid code
// already, so this only catches a broken client retrying in a loop.
const submitLimiter = limiter(20, { failedOnly: true });

// --- Config for the client (which auth methods are live) ---
router.get('/config', (_req, res) => {
  res.json({
    google_enabled: !!googleClient,
    google_client_id: GOOGLE_CLIENT_ID || null,
    smtp_enabled: mailerReady,
    invite_required: inviteRequired(),
  });
});

// --- Before launch: check an invite code before showing the signup options ---
router.post('/invite/check', checkSecretLimiter, (req, res) => {
  const gate = signupGateError(req.body.invite_code, req.ip);
  if (gate) return res.status(gate.status).json(gate.body);
  res.json({ ok: true });
});

// --- Step 1: request OTP for email signup ---
router.post('/otp/request', sendCodeLimiter, async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!isEmail(email))
    return res.status(400).json({ error: 'อีเมลไม่ถูกต้อง', error_code: 'INVALID_EMAIL' });
  // Checked before any email goes out, so no code is mailed to someone
  // who couldn't finish signing up anyway.
  const gate = signupGateError(req.body.invite_code, req.ip);
  if (gate) return res.status(gate.status).json(gate.body);

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing)
    return res
      .status(409)
      .json({ error: 'อีเมลนี้มีบัญชีอยู่แล้ว', error_code: 'EMAIL_TAKEN' });

  const tooMany = otpSendLimit(email, 'register');
  if (tooMany) return res.status(tooMany.status).json(tooMany.body);
  const code = issueOtp(email, 'register');

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
router.post('/otp/verify', checkSecretLimiter, (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const code = String(req.body.code || '').trim();
  if (!isEmail(email) || !/^\d{4}$/.test(code))
    return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง', error_code: 'INVALID_INPUT' });

  const { error } = checkOtp(email, 'register', code);
  if (error) return res.status(error.status).json(error.body);
  res.json({ ok: true });
});

// One nickname, in whatever language the person writes it. The old
// separate English name (`nickname_en`) is no longer asked for.
const NICKNAME_MAX = 40;
function nameError(nickname) {
  const name = String(nickname ?? '').trim();
  if (!name) return { error: 'กรุณากรอกชื่อเล่น', error_code: 'NICKNAME_REQUIRED' };
  if (name.length > NICKNAME_MAX)
    return { error: 'ชื่อเล่นยาวได้ไม่เกิน 40 ตัวอักษร', error_code: 'NICKNAME_TOO_LONG' };
  return null;
}

// The gender choices the app offers (client: gender.* strings). Signup and
// profile edits both accept only these, so a stray value can't be stored
// and then shown as a missing translation.
const GENDERS = ['female', 'male', 'other', 'prefer_not'];
function genderError(gender) {
  if (!gender) return { error: 'กรุณาเลือกเพศ', error_code: 'GENDER_REQUIRED' };
  if (!GENDERS.includes(gender)) return { error: 'เพศไม่ถูกต้อง', error_code: 'GENDER_INVALID' };
  return null;
}

// Signing up needs an explicit yes to the privacy policy (PDPA consent).
// The version is the policy's "last updated" date in the app
// (client/src/utils/privacyPolicy.js) — bump both together when the
// wording changes, so it's known which text each person agreed to.
const PRIVACY_VERSION = '2026-10-11';
function privacyError(accepted) {
  if (accepted !== true)
    return { error: 'กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนสมัคร', error_code: 'PRIVACY_REQUIRED' };
  return null;
}

// Partner details: a "#rrggbb" colour (the app's swatches) and a name no
// longer than the app's own input allows.
const PARTNER_NAME_MAX = 30;
const isHexColor = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);

// Same rule as the signup form (client/src/pages/Signup.jsx): a whole number
// from 1 to 90. Checked here too, so the profile page or a direct API call
// can't store 0, 999 or -5.
function ageError(age) {
  if (age == null || age === '' || Number.isNaN(Number(age)))
    return { error: 'กรุณากรอกอายุ', error_code: 'AGE_REQUIRED' };
  const n = Number(age);
  if (!Number.isInteger(n) || n < 1 || n > 90)
    return { error: 'อายุต้องเป็นตัวเลข 1–90', error_code: 'AGE_INVALID' };
  return null;
}

// --- Step 3: complete email signup ---
router.post('/register', submitLimiter, (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const code = String(req.body.code || '').trim();
  const { nickname, age, gender, password, accept_privacy: acceptPrivacy } = req.body;

  if (!isEmail(email))
    return res.status(400).json({ error: 'อีเมลไม่ถูกต้อง', error_code: 'INVALID_EMAIL' });
  const gate = signupGateError(req.body.invite_code, req.ip);
  if (gate) return res.status(gate.status).json(gate.body);
  const badName = nameError(nickname);
  if (badName) return res.status(400).json(badName);
  const badAge = ageError(age);
  if (badAge) return res.status(400).json(badAge);
  const badGender = genderError(gender);
  if (badGender) return res.status(400).json(badGender);
  const badPrivacy = privacyError(acceptPrivacy);
  if (badPrivacy) return res.status(400).json(badPrivacy);
  if (!validatePassword(password))
    return res.status(400).json({
      error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัว มีพิมพ์ใหญ่ พิมพ์เล็ก ตัวเลข และอักขระพิเศษ',
      error_code: 'PASSWORD_WEAK',
    });

  const { otp } = checkOtp(email, 'register', code);
  if (!otp)
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
      `INSERT INTO users (email, nickname, age, gender, password_hash, privacy_accepted_at, privacy_version)
       VALUES (?, ?, ?, ?, ?, datetime('now'), ?)`,
    )
    .run(
      email,
      String(nickname).trim(),
      age ? Number(age) : null,
      gender || null,
      hashPassword(password),
      PRIVACY_VERSION,
    );

  db.prepare('UPDATE otp_codes SET consumed = 1 WHERE id = ?').run(otp.id);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  const sessionId = recordLogin(user.id, 'register', req);
  res.json({ token: signToken(user, sessionId), user: publicUser(user) });
});

// --- Email + password login ---
router.post('/login', checkSecretLimiter, (req, res) => {
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
  if (!verifyPasswordOrWaste(password, user?.password_hash))
    return res
      .status(401)
      .json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', error_code: 'LOGIN_INVALID' });

  const sessionId = recordLogin(user.id, 'password', req);
  res.json({ token: signToken(user, sessionId), user: publicUser(user) });
});

// --- Forgot password — Step 1: request OTP ---
router.post('/password-reset/request', sendCodeLimiter, async (req, res) => {
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

  const tooMany = otpSendLimit(email, 'reset');
  if (tooMany) return res.status(tooMany.status).json(tooMany.body);
  const code = issueOtp(email, 'reset');

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
router.post('/password-reset/verify', checkSecretLimiter, (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const code = String(req.body.code || '').trim();
  if (!isEmail(email) || !/^\d{4}$/.test(code))
    return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง', error_code: 'INVALID_INPUT' });

  const { error } = checkOtp(email, 'reset', code);
  if (error) return res.status(error.status).json(error.body);
  res.json({ ok: true });
});

// --- Forgot password — Step 3: set new password (auto-login on success) ---
router.post('/password-reset/confirm', submitLimiter, (req, res) => {
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

  const { otp } = checkOtp(email, 'reset', code);
  if (!otp)
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
  // Same as the password login: the admin's Google account opens the admin
  // dashboard instead of a user session.
  if (payload.email_verified && isAdminEmail(email)) return res.json({ admin_token: signAdminToken() });
  let user = db.prepare('SELECT * FROM users WHERE google_sub = ?').get(sub);

  // A Google account we haven't seen only gets tied to an email (an existing
  // account with it, or a new one) once Google has verified that address —
  // otherwise someone could add a victim's address to a Google account and
  // sign straight into the victim's DeePer account.
  if (!user && payload.email_verified !== true)
    return res.status(403).json({
      error: 'อีเมลของบัญชี Google นี้ยังไม่ได้ยืนยัน กรุณายืนยันกับ Google ก่อน หรือสมัครด้วยอีเมล',
      error_code: 'GOOGLE_EMAIL_UNVERIFIED',
    });

  if (!user && email) {
    // Link to an existing email account if one exists.
    const byEmail = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (byEmail) {
      db.prepare('UPDATE users SET google_sub = ? WHERE id = ?').run(sub, byEmail.id);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(byEmail.id);
    }
  }

  if (!user) {
    // A Google account we haven't seen is a signup, so it's gated like one
    // — up front, before the profile form, so nobody fills it in for nothing.
    const gate = signupGateError(req.body.invite_code, req.ip);
    if (gate) return res.status(gate.status).json(gate.body);
    // New Google account — needs profile completion (nickname/age/gender)
    // and a password of its own, same as an email signup, so the account
    // can also sign in with email + password.
    const { nickname, age, gender, password, accept_privacy: acceptPrivacy } = req.body;
    if (!nickname || String(nickname).trim().length < 1) {
      return res.json({
        needs_profile: true,
        email,
        suggested_nickname: payload.given_name || payload.name || '',
      });
    }
    const badName = nameError(nickname);
    if (badName) return res.status(400).json(badName);
    const badAge = ageError(age);
    if (badAge) return res.status(400).json(badAge);
    const badGender = genderError(gender);
    if (badGender) return res.status(400).json(badGender);
    const badPrivacy = privacyError(acceptPrivacy);
    if (badPrivacy) return res.status(400).json(badPrivacy);
    if (!validatePassword(password))
      return res.status(400).json({
        error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัว มีพิมพ์ใหญ่ พิมพ์เล็ก ตัวเลข และอักขระพิเศษ',
        error_code: 'PASSWORD_WEAK',
      });
    const info = db
      .prepare(
        `INSERT INTO users (email, google_sub, nickname, age, gender, password_hash, privacy_accepted_at, privacy_version)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)`,
      )
      .run(
        email || null,
        sub,
        String(nickname).trim(),
        age ? Number(age) : null,
        gender || null,
        hashPassword(password),
        PRIVACY_VERSION,
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
// --- Sign out: ends this device's session on the server too, so a copy
// of the token stops working instead of lasting out its 30 days ---
router.post('/logout', requireAuth, (req, res) => {
  db.prepare(`UPDATE login_history SET revoked_at = datetime('now') WHERE id = ? AND revoked_at IS NULL`).run(
    req.sessionId,
  );
  res.json({ ok: true });
});

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
  const { nickname, age, gender } = req.body;
  const u = req.user;

  const nextName = nickname != null ? String(nickname).trim() : u.nickname;
  if (nickname != null) {
    const badName = nameError(nickname);
    if (badName) return res.status(400).json(badName);
  }
  // Age and gender are required at signup, so an edit can change them but
  // not blank them out; left out of the request, they stay as they are.
  if (age != null) {
    const badAge = ageError(age);
    if (badAge) return res.status(400).json(badAge);
  }
  if (gender != null) {
    const badGender = genderError(gender);
    if (badGender) return res.status(400).json(badGender);
  }

  // Saving a new nickname clears any old separate English one, so the app
  // never shows a stale second name.
  db.prepare(`UPDATE users SET nickname = ?, nickname_en = ?, age = ?, gender = ? WHERE id = ?`).run(
    nextName,
    nickname != null ? null : u.nickname_en,
    age != null ? Number(age) : u.age,
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

  if (color != null && !isHexColor(color))
    return res.status(400).json({ error: 'สีไม่ถูกต้อง', error_code: 'PARTNER_COLOR_INVALID' });
  if (name != null && String(name).trim().length > PARTNER_NAME_MAX)
    return res
      .status(400)
      .json({ error: 'ชื่อยาวได้ไม่เกิน 30 ตัวอักษร', error_code: 'PARTNER_NAME_TOO_LONG' });

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
  // Their transfer slips go too (the proof rows stay, unlinked from the
  // account, so an approved name can still be shown or hidden).
  const slips = db.prepare('SELECT slip_path FROM support_proofs WHERE user_id = ?').all(u.id);
  for (const { slip_path } of slips) {
    const file = slipFile(slip_path);
    if (file) fs.unlink(file, () => {});
  }
  db.prepare(`UPDATE support_proofs SET slip_path = '' WHERE user_id = ?`).run(u.id);

  db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
  res.json({ ok: true });
});

export default router;
