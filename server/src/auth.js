import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const TOKEN_TTL = '30d';

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

// Password rule: >= 8 chars, upper + lower + digit + special
export function validatePassword(pw) {
  if (typeof pw !== 'string' || pw.length < 8) return false;
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
    has_password: !!u.password_hash,
    via_google: !!u.google_sub,
  };
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'ต้องเข้าสู่ระบบก่อน' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.uid);
    if (!user) return res.status(401).json({ error: 'ไม่พบบัญชีผู้ใช้' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
  }
}
