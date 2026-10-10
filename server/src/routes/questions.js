import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { CATEGORIES, LEVELS } from '../questions-bank.js';

const router = Router();

const validCategory = (c) => CATEGORIES.includes(c);

// Fetch a batch of questions for a category (bank + this user's own).
// `level` is one of LEVELS for just that level, or left out for all of them
// in order from light to deep (shuffled within each level). A user's own
// questions count as "mid". `exclude` (comma-separated ids) lets the client
// avoid repeats within a session.
router.get('/', requireAuth, (req, res) => {
  const category = req.query.category;
  if (!validCategory(category))
    return res.status(400).json({ error: 'หมวดไม่ถูกต้อง', error_code: 'INVALID_CATEGORY' });

  const level = req.query.level || null;
  if (level && !LEVELS.includes(level))
    return res.status(400).json({ error: 'ระดับคำถามไม่ถูกต้อง', error_code: 'INVALID_LEVEL' });

  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const exclude = String(req.query.exclude || '')
    .split(',')
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n > 0);

  const placeholders = exclude.length ? `AND id NOT IN (${exclude.map(() => '?').join(',')})` : '';
  const rows = db
    .prepare(
      `SELECT id, category, COALESCE(level, 'mid') AS level, text, text_en, source FROM questions
       WHERE category = ? AND (source = 'bank' OR (source = 'user' AND user_id = ?))
       ${level ? `AND COALESCE(level, 'mid') = ?` : ''}
       ${placeholders}
       ORDER BY CASE COALESCE(level, 'mid') WHEN 'open' THEN 0 WHEN 'mid' THEN 1 ELSE 2 END, RANDOM()
       LIMIT ?`,
    )
    .all(category, req.user.id, ...(level ? [level] : []), ...exclude, limit);

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
    question: { id: Number(info.lastInsertRowid), category, level: 'mid', text, text_en: null, source: 'user' },
  });
});

export default router;
