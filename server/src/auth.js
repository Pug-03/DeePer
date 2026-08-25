import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from './db.js';

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

export function signToken(user) {
  return jwt.sign({ uid: user.id }, JWT_SECRET, { expiresIn: TOKEN_TTL });
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

export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    nickname: u.nickname,
    age: u.age,
    gender: u.gender,
    partner_name: u.partner_name,
    partner_color: u.partner_color,
    avatar_url: u.avatar_url,
    has_password: !!u.password_hash,
    via_google: !!u.google_sub,
  };
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token)
    return res.status(401).json({ error: 'ต้องเข้าสู่ระบบก่อน', error_code: 'AUTH_REQUIRED' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.uid);
    if (!user)
      return res.status(401).json({ error: 'ไม่พบบัญชีผู้ใช้', error_code: 'USER_NOT_FOUND' });
    req.user = user;
    next();
  } catch {
    return res
      .status(401)
      .json({ error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', error_code: 'SESSION_EXPIRED' });
  }
}
