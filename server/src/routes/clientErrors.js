import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';

const router = Router();

// Fire-and-forget from every browser, so keep each visitor to a trickle.
const errorLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'ส่งบ่อยเกินไป', error_code: 'RATE_LIMITED' },
});

const clip = (v, n) => String(v ?? '').slice(0, n);

// A browser error the client caught. No account details are kept — just
// what broke, on which page, in which browser. Seen again (same message
// and first stack frame) it bumps the count; if it had been marked fixed,
// it comes back as open.
router.post('/', errorLimiter, (req, res) => {
  const message = clip(req.body?.message, 500).trim();
  if (!message) return res.status(400).json({ error: 'ไม่มีข้อความ', error_code: 'INVALID_INPUT' });
  const stack = clip(req.body?.stack, 4000);
  const url = clip(req.body?.url, 300);
  const userAgent = clip(req.get('user-agent'), 300);
  const firstFrame = stack.split('\n').find((l) => /\d+:\d+/.test(l)) || '';
  const signature = clip(`${message}|${firstFrame.trim()}`, 900);

  db.prepare(
    `INSERT INTO client_errors (signature, message, stack, url, user_agent) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(signature) DO UPDATE SET count = count + 1, last_seen = datetime('now'),
       url = excluded.url, user_agent = excluded.user_agent, resolved_at = NULL`,
  ).run(signature, message, stack || null, url || null, userAgent || null);
  res.status(204).end();
});

export default router;
