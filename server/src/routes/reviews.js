import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

export const REVIEW_RELATIONS = ['couple', 'friends', 'family'];
const MIN_LEN = 10;
const MAX_LEN = 200;

const reviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'ส่งรีวิวบ่อยเกินไป กรุณาลองใหม่ภายหลัง', error_code: 'REVIEW_RATE_LIMITED' },
});

// Public: approved reviews for the landing page, newest approval first.
// Shows the reviewer's nickname only (Thai and English), never anything else.
router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT r.id, r.text, r.relation, u.nickname, u.nickname_en
       FROM reviews r JOIN users u ON u.id = r.user_id
       WHERE r.status = 'approved'
       ORDER BY r.approved_at DESC, r.id DESC LIMIT 30`,
    )
    .all();
  res.json({ reviews: rows });
});

// The signed-in user's own review (or null), with its status.
router.get('/mine', requireAuth, (req, res) => {
  const row = db
    .prepare('SELECT text, relation, status, updated_at FROM reviews WHERE user_id = ?')
    .get(req.user.id);
  res.json({ review: row || null });
});

// Create or edit the user's review. Every save goes (back) to pending, so an
// approved review can't be changed into something unreviewed.
router.post('/mine', requireAuth, reviewLimiter, (req, res) => {
  const text = String(req.body.text || '').trim().replace(/\s+/g, ' ');
  const relation = req.body.relation;
  if (text.length < MIN_LEN || text.length > MAX_LEN)
    return res
      .status(400)
      .json({ error: `รีวิวต้องยาว ${MIN_LEN}–${MAX_LEN} ตัวอักษร`, error_code: 'REVIEW_LENGTH' });
  if (!REVIEW_RELATIONS.includes(relation))
    return res.status(400).json({ error: 'หมวดไม่ถูกต้อง', error_code: 'INVALID_CATEGORY' });

  db.prepare(
    `INSERT INTO reviews (user_id, text, relation) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET text = excluded.text, relation = excluded.relation,
       status = 'pending', approved_at = NULL, updated_at = datetime('now')`,
  ).run(req.user.id, text, relation);
  res.json({ review: { text, relation, status: 'pending' } });
});

router.delete('/mine', requireAuth, (req, res) => {
  db.prepare('DELETE FROM reviews WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

export default router;
