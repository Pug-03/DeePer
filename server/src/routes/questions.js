import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { CATEGORIES } from '../questions-bank.js';
import { generateQuestions, aiReady } from '../ai.js';

const router = Router();

const validCategory = (c) => CATEGORIES.includes(c);

// Fetch a shuffled batch of questions for a category (bank + AI + this user's own).
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
       WHERE category = ? AND (source != 'user' OR user_id = ?)
       ${placeholders}
       ORDER BY RANDOM() LIMIT ?`,
    )
    .all(category, req.user.id, ...exclude, limit);

  res.json({ questions: rows, ai_enabled: aiReady });
});

// Live AI top-up — generate fresh questions, persist them, return them.
router.post('/generate', requireAuth, async (req, res) => {
  const category = req.body.category;
  if (!validCategory(category))
    return res.status(400).json({ error: 'หมวดไม่ถูกต้อง', error_code: 'INVALID_CATEGORY' });
  if (!aiReady)
    return res.status(503).json({
      error: 'ยังไม่ได้เปิดใช้งานการสร้างคำถามด้วย AI',
      error_code: 'AI_DISABLED',
    });

  const count = Math.min(Number(req.body.count) || 6, 10);

  // Give the model recent questions to avoid near-duplicates.
  const recent = db
    .prepare(`SELECT text FROM questions WHERE category = ? ORDER BY id DESC LIMIT 40`)
    .all(category)
    .map((r) => r.text);

  try {
    const generated = await generateQuestions(category, count, recent);
    if (!generated.length)
      return res.status(502).json({
        error: 'AI ไม่ได้สร้างคำถามใหม่ กรุณาลองอีกครั้ง',
        error_code: 'AI_GENERATE_EMPTY',
      });

    const insert = db.prepare(
      `INSERT INTO questions (category, text, source) VALUES (?, ?, 'ai')`,
    );
    const out = [];
    for (const text of generated) {
      const info = insert.run(category, text);
      out.push({ id: Number(info.lastInsertRowid), category, text, source: 'ai' });
    }
    res.json({ questions: out });
  } catch (e) {
    console.error('[ai] generate failed', e);
    res.status(502).json({
      error: e.message || 'สร้างคำถามด้วย AI ไม่สำเร็จ',
      error_code: e.code || 'AI_GENERATE_FAILED',
    });
  }
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
