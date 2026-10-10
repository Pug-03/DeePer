import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db, bumpStat } from '../db.js';
import { requireAuth } from '../auth.js';
import { CATEGORIES, englishFor } from '../questions-bank.js';

const router = Router();
router.use(requireAuth);

// ---------------- Saved questions (🔖) ----------------

router.get('/saved', (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, question_text, category, created_at
       FROM saved_questions WHERE user_id = ? ORDER BY created_at DESC, id DESC`,
    )
    .all(req.user.id);
  // English for bank questions, matched on the stored Thai text.
  res.json({ saved: rows.map((r) => ({ ...r, question_text_en: englishFor(r.question_text) })) });
});

router.post('/saved', (req, res) => {
  const text = String(req.body.question_text || '').trim();
  const category = req.body.category;
  if (!text)
    return res
      .status(400)
      .json({ error: 'ไม่มีคำถามให้บันทึก', error_code: 'QUESTION_TEXT_REQUIRED' });
  if (!CATEGORIES.includes(category))
    return res.status(400).json({ error: 'หมวดไม่ถูกต้อง', error_code: 'INVALID_CATEGORY' });

  // Avoid duplicate saves of the same question.
  const exists = db
    .prepare('SELECT id FROM saved_questions WHERE user_id = ? AND question_text = ?')
    .get(req.user.id, text);
  if (exists) return res.json({ saved: { id: exists.id }, duplicate: true });

  const info = db
    .prepare(
      `INSERT INTO saved_questions (user_id, question_text, category) VALUES (?, ?, ?)`,
    )
    .run(req.user.id, text, category);
  bumpStat('saved');
  res.json({ saved: { id: Number(info.lastInsertRowid) } });
});

router.delete('/saved/:id', (req, res) => {
  db.prepare('DELETE FROM saved_questions WHERE id = ? AND user_id = ?').run(
    Number(req.params.id),
    req.user.id,
  );
  res.json({ ok: true });
});

// ---------------- Swipes & shares ----------------

// The deck pings these on every card swiped away (either direction) and
// every share card sent or saved, for the landing page's public totals.
// One shared cap so an account can't pump either number — well above what
// a person can do by hand.
const pingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 60,
  keyGenerator: (req) => String(req.user.id),
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/swipes', pingLimiter, (_req, res) => {
  bumpStat('swiped');
  res.json({ ok: true });
});

router.post('/shares', pingLimiter, (_req, res) => {
  bumpStat('shared');
  res.json({ ok: true });
});

// ---------------- History (answered) ----------------

router.get('/history', (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, question_text, category, my_answer, partner_answer,
              partner_name, partner_color, created_at
       FROM history WHERE user_id = ? ORDER BY created_at DESC, id DESC`,
    )
    .all(req.user.id);
  res.json({ history: rows.map((r) => ({ ...r, question_text_en: englishFor(r.question_text) })) });
});

router.post('/history', (req, res) => {
  const {
    question_text,
    category,
    my_answer,
    partner_answer,
    partner_name,
    partner_color,
    saved_id,
  } = req.body;

  const text = String(question_text || '').trim();
  if (!text)
    return res
      .status(400)
      .json({ error: 'ไม่มีคำถาม', error_code: 'QUESTION_TEXT_REQUIRED' });
  if (!CATEGORIES.includes(category))
    return res.status(400).json({ error: 'หมวดไม่ถูกต้อง', error_code: 'INVALID_CATEGORY' });

  // Client always sends both today (Answer.jsx computes them from the
  // question's own category), so this only covers a caller that doesn't —
  // look up that category's own partner rather than the (no longer
  // authoritative) flat users.partner_* columns.
  const fallback =
    partner_name == null || partner_color == null
      ? db
          .prepare(`SELECT name, color FROM partners WHERE user_id = ? AND category = ?`)
          .get(req.user.id, category) || { name: 'อีกฝ่าย', color: '#f43f5e' }
      : null;

  const info = db
    .prepare(
      `INSERT INTO history
        (user_id, question_text, category, my_answer, partner_answer, partner_name, partner_color)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      req.user.id,
      text,
      category,
      String(my_answer || ''),
      String(partner_answer || ''),
      partner_name != null ? String(partner_name) : fallback.name,
      partner_color != null ? String(partner_color) : fallback.color,
    );

  bumpStat('answered');

  // If this came from a saved question, remove it from the saved list.
  if (saved_id) {
    db.prepare('DELETE FROM saved_questions WHERE id = ? AND user_id = ?').run(
      Number(saved_id),
      req.user.id,
    );
  }

  res.json({ history: { id: Number(info.lastInsertRowid) } });
});

router.delete('/history/:id', (req, res) => {
  db.prepare('DELETE FROM history WHERE id = ? AND user_id = ?').run(
    Number(req.params.id),
    req.user.id,
  );
  res.json({ ok: true });
});

export default router;
