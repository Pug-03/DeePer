import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';
import { sendMail } from '../mailer.js';
import { TESTER_SOURCES } from '../testerInvite.js';

const router = Router();

// Never mail from the test suite — a developer's real .env may hold SMTP
// credentials, and each test run would land in their inbox.
const NOTIFY_TO =
  process.env.NODE_ENV === 'test'
    ? ''
    : process.env.REPORTS_TO || process.env.SUPPORT_DIGEST_TO || process.env.SMTP_USER || '';

// Public form, so cap it per visitor.
const requestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'ส่งบ่อยเกินไป กรุณาลองใหม่ภายหลัง', error_code: 'TESTER_RATE_LIMITED' },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Someone without an invite code asking to join the pre-launch test. Stored
// for the admin dashboard (which emails them the code) and the maintainer
// is told right away. Asking twice with the same email just updates it.
router.post('/', requestLimiter, (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 120);
  const nickname = String(req.body?.nickname || '').trim().slice(0, 40);
  // Several can be picked: an array, or a single string from older clients.
  // Stored comma-joined in the one `source` column, in the list's own order.
  const picked = [].concat(req.body?.source ?? []).map(String);
  const sources = TESTER_SOURCES.filter((s) => picked.includes(s));
  const source = sources.join(',');
  const sourceOther = sources.includes('other') ? String(req.body?.source_other || '').trim().slice(0, 100) : '';

  if (!nickname) return res.status(400).json({ error: 'กรุณากรอกชื่อเล่น', error_code: 'NICKNAME_REQUIRED' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'อีเมลไม่ถูกต้อง', error_code: 'INVALID_EMAIL' });
  if (!sources.length || sources.length !== new Set(picked).size)
    return res.status(400).json({ error: 'กรุณาเลือกว่ารู้จักเราจากช่องทางไหน', error_code: 'TESTER_SOURCE_REQUIRED' });

  db.prepare(
    `INSERT INTO tester_requests (email, nickname, source, source_other) VALUES (?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET nickname = excluded.nickname, source = excluded.source,
       source_other = excluded.source_other`,
  ).run(email, nickname, source, sourceOther || null);

  if (NOTIFY_TO) {
    sendMail({
      to: NOTIFY_TO,
      subject: `[DeePer] มีคนขอเข้าร่วมทดสอบ: ${nickname}`,
      text:
        `ชื่อเล่น: ${nickname}\nอีเมล: ${email}\nรู้จักจาก: ${source}${sourceOther ? ` (${sourceOther})` : ''}\n\n` +
        '— ส่งรหัสเชิญได้ในหน้าแอดมิน แท็บคำขอทดสอบ',
    }).catch((err) => console.error('[testers] email failed', err));
  }

  res.json({ ok: true });
});

export default router;
