import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { CATEGORIES } from '../questions-bank.js';

const router = Router();

const validCategory = (c) => CATEGORIES.includes(c);

// Fetch a shuffled batch of questions for a category (bank + this user's own).
// `exclude` (comma-separated ids) lets the client avoid repeats within a session.
router.get('/', requireAuth, (req, res) => {
  const category = req.query.category;
  if (!validCategory(category))
    return res.status(400).json({ error: 'หมวดไม่ถูกต้อง', error_code: 'INVALID_CATEGORY' });

  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const exclude = String(req.query.exclude || '')
    .split(',')
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n > 0);

  const placeholders = exclude.length ? `AND id NOT IN (${exclude.map(() => '?').join(',')})` : '';
  const rows = db
    .prepare(
      `SELECT id, category, text, source FROM questions
       WHERE category = ? AND (source = 'bank' OR (source = 'user' AND user_id = ?))
       ${placeholders}
       ORDER BY RANDOM() LIMIT ?`,
    )
    .all(category, req.user.id, ...exclude, limit);

  res.json({ questions: rows });
});

// A user adds their own question to a category.
router.post('/', requireAuth, (req, res) => {
  const category = req.body.category;
  const text = String(req.body.text || '').trim();
  if (!validCategory(category))
    return res.status(400).json({ error: 'หมวดไม่ถูกต้อง', error_code: 'INVALID_CATEGORY' });
  if (text.length < 3)
    return res
      .status(400)
      .json({ error: 'คำถามสั้นเกินไป', error_code: 'QUESTION_TOO_SHORT' });

  const info = db
    .prepare(`INSERT INTO questions (category, text, source, user_id) VALUES (?, ?, 'user', ?)`)
    .run(category, text, req.user.id);
  res.json({
    question: { id: Number(info.lastInsertRowid), category, text, source: 'user' },
  });
});

export default router;
