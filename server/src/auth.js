import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from './db.js';
import { CATEGORIES } from './questions-bank.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const TOKEN_TTL = '30d';

// The default secret is fine for local dev, but forging any user's login
// token is trivial if it's ever left in place in production — refuse to
// start rather than run silently insecure.
if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'dev-secret-change-me') {
  throw new Error('JWT_SECRET must be set in production — refusing to start with the default dev secret');
}

export function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

export function verifyPassword(plain, hash) {
  if (!hash) return false;
  return bcrypt.compareSync(plain, hash);
}

// sessionId is the login_history row id created for this login (see
// recordLogin in routes/auth.js) — embedding it lets requireAuth check
// (and a later "log out this device" revoke) target this one token
// specifically, without affecting any of the user's other sessions.
export function signToken(user, sessionId) {
  return jwt.sign({ uid: user.id, sid: sessionId }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

// Password rule: upper + lower + digit + special
export function validatePassword(pw) {
  if (typeof pw !== 'string') return false;
  return (
    /[A-Z]/.test(pw) &&
    /[a-z]/.test(pw) &&
    /[0-9]/.test(pw) &&
    /[^A-Za-z0-9]/.test(pw)
  );
}

// One partner slot per category (couple/friends/family) instead of one
// global slot — a category with no row yet (never customized) falls back
// to the same defaults the `partners` table columns declare.
function partnersByCategory(userId) {
  const rows = db
    .prepare(`SELECT category, name, color, icon, avatar_url FROM partners WHERE user_id = ?`)
    .all(userId);
  const byCategory = Object.fromEntries(rows.map((r) => [r.category, r]));
  const partners = {};
  for (const category of CATEGORIES) {
    const r = byCategory[category];
    partners[category] = {
      name: r?.name ?? 'อีกฝ่าย',
      color: r?.color ?? '#f43f5e',
      icon: r?.icon ?? null,
      avatar_url: r?.avatar_url ?? null,
    };
  }
  return partners;
}

export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    nickname: u.nickname,
    nickname_en: u.nickname_en,
    age: u.age,
    gender: u.gender,
    partners: partnersByCategory(u.id),
    avatar_url: u.avatar_url,
    has_password: !!u.password_hash,
    via_google: !!u.google_sub,
  };
}

const AUTH_ERRORS = {
  AUTH_REQUIRED: 'ต้องเข้าสู่ระบบก่อน',
  USER_NOT_FOUND: 'ไม่พบบัญชีผู้ใช้',
  SESSION_EXPIRED: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
};

// Resolves the request's Bearer token to { user, sessionId }, or { code }
// naming why it couldn't (one of AUTH_ERRORS).
function resolveAuth(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return { code: 'AUTH_REQUIRED' };
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.uid);
    if (!user) return { code: 'USER_NOT_FOUND' };
    // The token's own session must still be an un-revoked login_history
    // row — gone (revoked via "log out this device" / "log out other
    // devices", or a token signed before sessions existed) means treat it
    // the same as an expired session.
    const session = db
      .prepare('SELECT id FROM login_history WHERE id = ? AND user_id = ? AND revoked_at IS NULL')
      .get(payload.sid ?? -1, user.id);
    if (!session) return { code: 'SESSION_EXPIRED' };
    return { user, sessionId: payload.sid };
  } catch {
    return { code: 'SESSION_EXPIRED' };
  }
}

// Marks the user active today (Bangkok time) — feeds the admin dashboard.
const markActive = db.prepare(
  `INSERT OR IGNORE INTO user_activity (day, user_id) VALUES (date('now', '+7 hours'), ?)`,
);

export function requireAuth(req, res, next) {
  const { user, sessionId, code } = resolveAuth(req);
  if (code) return res.status(401).json({ error: AUTH_ERRORS[code], error_code: code });
  req.user = user;
  req.sessionId = sessionId;
  markActive.run(user.id);
  next();
}

// For routes open to guests too: sets req.user when a valid token is sent,
// and otherwise carries on as a guest — a stale token never blocks the
// request.
export function optionalAuth(req, res, next) {
  const { user, sessionId } = resolveAuth(req);
  req.user = user || null;
  req.sessionId = sessionId;
  next();
}

// ---- Admin ----
// A single admin login, separate from user accounts: the email and a bcrypt
// hash of the password come from ADMIN_EMAIL / ADMIN_PASSWORD_HASH (never
// from the repo, which is public), so it also survives DB wipes. Generate
// the hash with:  node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 10))" '<password>'
const ADMIN_TTL = '12h';

export const adminConfigured = () => !!(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD_HASH);

export function checkAdminLogin(email, password) {
  if (!adminConfigured()) return false;
  const emailOk = String(email || '').trim().toLowerCase() === process.env.ADMIN_EMAIL.trim().toLowerCase();
  // Always run the bcrypt compare so a wrong email takes as long as a wrong password.
  const passOk = bcrypt.compareSync(String(password || ''), process.env.ADMIN_PASSWORD_HASH);
  return emailOk && passOk;
}

export function signAdminToken() {
  return jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: ADMIN_TTL });
}

export function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  try {
    if (token && jwt.verify(token, JWT_SECRET).admin === true) return next();
  } catch {
    /* fall through */
  }
  res.status(401).json({ error: 'ต้องเข้าสู่ระบบแอดมินก่อน', error_code: 'ADMIN_AUTH_REQUIRED' });
}
