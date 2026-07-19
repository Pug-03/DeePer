import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { CATEGORIES } from '../questions-bank.js';

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
  res.json({ saved: rows });
});

router.post('/saved', (req, res) => {
  const text = String(req.body.question_text || '').trim();
  const category = req.body.category;
  if (!text) return res.status(400).json({ error: 'ไม่มีคำถามให้บันทึก' });
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'หมวดไม่ถูกต้อง' });

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
  res.json({ saved: { id: Number(info.lastInsertRowid) } });
});

router.delete('/saved/:id', (req, res) => {
  db.prepare('DELETE FROM saved_questions WHERE id = ? AND user_id = ?').run(
    Number(req.params.id),
    req.user.id,
  );
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
  res.json({ history: rows });
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
  if (!text) return res.status(400).json({ error: 'ไม่มีคำถาม' });
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'หมวดไม่ถูกต้อง' });

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
      partner_name != null ? String(partner_name) : req.user.partner_name,
      partner_color != null ? String(partner_color) : req.user.partner_color,
    );

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
