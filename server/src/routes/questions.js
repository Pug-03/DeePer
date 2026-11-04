import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { CATEGORIES, LEVELS } from '../questions-bank.js';
import { sampleQuestions } from '../seo.js';

const router = Router();

const validCategory = (c) => CATEGORIES.includes(c);

// Public: the fixed sample shown on the /questions/:category pages, open to
// guests so the page works before anyone signs up.
router.get('/samples/:category', (req, res) => {
  if (!validCategory(req.params.category))
    return res.status(400).json({ error: 'หมวดไม่ถูกต้อง', error_code: 'INVALID_CATEGORY' });
  res.json({ questions: sampleQuestions(req.params.category) });
});

// The "light to deep" deck, card by card: a few light ones to warm up, a
// few medium ones to get going, then deep, with a medium one every fourth
// card so the deep ones don't come one after another without a breather.
const RAMP_OPEN = 4;
const RAMP_MID = 5;
const DEEP_RUN = 3; // deep cards before each medium one
function rampLevel(pos) {
  if (pos < RAMP_OPEN) return 'open';
  if (pos < RAMP_OPEN + RAMP_MID) return 'mid';
  return (pos - RAMP_OPEN - RAMP_MID) % (DEEP_RUN + 1) === DEEP_RUN ? 'mid' : 'deep';
}
// When a level runs out, the nearest one stands in.
const FALLBACK = { open: ['mid', 'deep'], mid: ['deep', 'open'], deep: ['mid', 'open'] };

// Fetch a batch of questions for a category (bank + this user's own).
// `level` is one of LEVELS for just that level; left out, the batch follows
// the light-to-deep ramp above. `exclude` (comma-separated ids) is every card
// dealt so far this session, so the client doesn't see repeats, and its
// length is where in the ramp this batch starts: a fresh session (opening
// the app, switching category) starts light again. A user's own questions
// count as "mid".
router.get('/', requireAuth, (req, res) => {
  const category = req.query.category;
  if (!validCategory(category))
    return res.status(400).json({ error: 'หมวดไม่ถูกต้อง', error_code: 'INVALID_CATEGORY' });

  const level = req.query.level || null;
  if (level && !LEVELS.includes(level))
    return res.status(400).json({ error: 'ระดับคำถามไม่ถูกต้อง', error_code: 'INVALID_LEVEL' });

  // 1 to 50: a negative limit would read as "no limit" to SQLite.
  const limit = Math.min(Math.max(Math.trunc(Number(req.query.limit)) || 20, 1), 50);
  const exclude = String(req.query.exclude || '')
    .split(',')
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n > 0);

  const placeholders = exclude.length ? `AND id NOT IN (${exclude.map(() => '?').join(',')})` : '';
  const pick = (lv, n) =>
    db
      .prepare(
        `SELECT id, category, COALESCE(level, 'mid') AS level, text, text_en, source FROM questions
         WHERE category = ? AND (source = 'bank' OR (source = 'user' AND user_id = ?))
         AND COALESCE(level, 'mid') = ?
         ${placeholders}
         ORDER BY RANDOM()
         LIMIT ?`,
      )
      .all(category, req.user.id, lv, ...exclude, n);

  if (level) return res.json({ questions: pick(level, limit) });

  const pools = Object.fromEntries(LEVELS.map((lv) => [lv, pick(lv, limit)]));
  const rows = [];
  for (let i = 0; i < limit; i++) {
    const want = rampLevel(exclude.length + i);
    const from = [want, ...FALLBACK[want]].find((lv) => pools[lv].length);
    if (!from) break;
    rows.push(pools[from].shift());
  }
  res.json({ questions: rows });
});

// A person's own questions: the add form allows 200 characters; the cap
// here is the backstop, with a per-account pace a person never reaches.
const QUESTION_MAX = 300;
const addLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 30,
  keyGenerator: (req) => String(req.user.id),
  standardHeaders: true,
  legacyHeaders: false,
});

// A user adds their own question to a category.
router.post('/', requireAuth, addLimiter, (req, res) => {
  const category = req.body.category;
  const text = String(req.body.text || '').trim();
  if (!validCategory(category))
    return res.status(400).json({ error: 'หมวดไม่ถูกต้อง', error_code: 'INVALID_CATEGORY' });
  // At least a few real letters: a lone Thai vowel or tone mark (or just
  // punctuation) passed the length check and showed up as a stray glyph.
  if (text.length < 3 || (text.match(/\p{L}/gu) || []).length < 2)
    return res
      .status(400)
      .json({ error: 'คำถามสั้นเกินไป', error_code: 'QUESTION_TOO_SHORT' });
  if (text.length > QUESTION_MAX)
    return res.status(400).json({ error: 'คำถามยาวเกินไป', error_code: 'QUESTION_TOO_LONG' });

  const info = db
    .prepare(`INSERT INTO questions (category, text, source, user_id) VALUES (?, ?, 'user', ?)`)
    .run(category, text, req.user.id);
  res.json({
    question: { id: Number(info.lastInsertRowid), category, level: 'mid', text, text_en: null, source: 'user' },
  });
});

export default router;
