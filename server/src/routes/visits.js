import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';
import { optionalAuth } from '../auth.js';

const router = Router();

// Known referrer hosts folded into one readable source name each.
const SOURCE_HOSTS = [
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)(facebook\.com|fb\.com|messenger\.com)$/, 'facebook'],
  [/(^|\.)(line\.me|line-apps\.com)$/, 'line'],
  [/(^|\.)google\.[a-z.]+$/, 'google'],
  [/(^|\.)(x\.com|twitter\.com|t\.co)$/, 'x'],
];

// ?ref= wins (e.g. the IG bio link ends in ?ref=ig); otherwise the
// referrer's host; otherwise a direct visit.
function sourceOf(ref, referrer) {
  const tag = String(ref || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30);
  if (tag) return { ig: 'instagram', tt: 'tiktok', fb: 'facebook' }[tag] || tag;
  let host = '';
  try {
    host = new URL(String(referrer || '')).hostname.toLowerCase();
  } catch {
    return 'direct';
  }
  if (!host) return 'direct';
  for (const [re, name] of SOURCE_HOSTS) if (re.test(host)) return name;
  return host.replace(/^www\./, '').slice(0, 60);
}

const visitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const insertVisit = db.prepare(
  `INSERT INTO site_visits (day, visitor_id, source, path, signed_in)
   VALUES (date('now', '+7 hours'), ?, ?, ?, ?)
   ON CONFLICT(day, visitor_id) DO UPDATE SET signed_in = MAX(signed_in, excluded.signed_in)`,
);

// The client pings this once per browser per day. The first ping of the day
// keeps its source and landing path; a later one only upgrades signed_in.
router.post('/', visitLimiter, optionalAuth, (req, res) => {
  const visitorId = String(req.body?.visitor_id || '');
  if (!/^[A-Za-z0-9-]{8,64}$/.test(visitorId))
    return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง', error_code: 'INVALID_INPUT' });
  const path = String(req.body?.path || '').slice(0, 120) || null;
  insertVisit.run(visitorId, sourceOf(req.body?.ref, req.body?.referrer), path, req.user ? 1 : 0);
  res.status(204).end();
});

export default router;
