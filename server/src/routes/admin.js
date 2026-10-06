import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';
import { db } from '../db.js';
import { requireAdmin } from '../auth.js';
import { approveProofs, revokeProofs } from '../supporters.js';
import { sendMail } from '../mailer.js';
import { REPORT_DIR } from './reports.js';

const router = Router();
const __dirname = dirname(fileURLToPath(import.meta.url));

// Days are Bangkok calendar days; timestamps in the DB are UTC.
const BKK = "'+7 hours'";
const DAYS = 14;

// Signing in happens on the regular user login (POST /api/auth/login).
router.use(requireAdmin);

const count = (sql, ...args) => db.prepare(sql).get(...args).c;

// Bangkok-date strings for the last DAYS days, oldest first.
function lastDays() {
  const now = Date.now() + 7 * 3600 * 1000;
  return Array.from({ length: DAYS }, (_, i) =>
    new Date(now - (DAYS - 1 - i) * 86400 * 1000).toISOString().slice(0, 10),
  );
}

router.get('/stats', (req, res) => {
  const today = `date('now', ${BKK})`;
  const days = lastDays();
  const since = days[0];
  const perDay = (sql) => Object.fromEntries(db.prepare(sql).all(since).map((r) => [r.d, r.c]));
  const signups = perDay(
    `SELECT date(created_at, ${BKK}) AS d, COUNT(*) AS c FROM users WHERE date(created_at, ${BKK}) >= ? GROUP BY d`,
  );
  const active = perDay(`SELECT day AS d, COUNT(*) AS c FROM user_activity WHERE day >= ? GROUP BY day`);
  const visitors = perDay(`SELECT day AS d, COUNT(*) AS c FROM site_visits WHERE day >= ? GROUP BY day`);

  res.json({
    users_total: count('SELECT COUNT(*) AS c FROM users'),
    visitors_today: count(`SELECT COUNT(*) AS c FROM site_visits WHERE day = ${today}`),
    guests_today: count(`SELECT COUNT(*) AS c FROM site_visits WHERE day = ${today} AND signed_in = 0`),
    signups_today: count(`SELECT COUNT(*) AS c FROM users WHERE date(created_at, ${BKK}) = ${today}`),
    active_today: count(`SELECT COUNT(*) AS c FROM user_activity WHERE day = ${today}`),
    logins_today: count(`SELECT COUNT(*) AS c FROM login_history WHERE date(created_at, ${BKK}) = ${today}`),
    answers_today: count(`SELECT COUNT(*) AS c FROM history WHERE date(created_at, ${BKK}) = ${today}`),
    reports_open: count('SELECT COUNT(*) AS c FROM bug_reports WHERE resolved_at IS NULL AND deleted_at IS NULL'),
    inquiries_open: count('SELECT COUNT(*) AS c FROM sponsor_inquiries WHERE handled_at IS NULL AND deleted_at IS NULL'),
    reviews_pending: count(`SELECT COUNT(*) AS c FROM reviews WHERE status = 'pending'`),
    proofs_pending: count(
      'SELECT COUNT(*) AS c FROM support_proofs WHERE approved_at IS NULL AND rejected_at IS NULL AND deleted_at IS NULL',
    ),
    days: days.map((d) => ({
      day: d,
      visitors: visitors[d] || 0,
      active: active[d] || 0,
      signups: signups[d] || 0,
    })),
    // Where the last 14 days' visitors came from, biggest first.
    sources: db
      .prepare(`SELECT source, COUNT(*) AS c FROM site_visits WHERE day >= ? GROUP BY source ORDER BY c DESC`)
      .all(since),
  });
});

// What people actually use: which categories get answered and saved, the
// most-saved and most-answered questions, and whether users come back.
router.get('/insights', (req, res) => {
  const since = lastDays()[0];
  const byCategory = (table) =>
    Object.fromEntries(
      db.prepare(`SELECT category, COUNT(*) AS c FROM ${table} GROUP BY category`).all().map((r) => [r.category, r.c]),
    );
  const top = (table) =>
    db
      .prepare(
        `SELECT question_text AS text, category, COUNT(*) AS c FROM ${table}
         GROUP BY question_text ORDER BY c DESC, MAX(created_at) DESC LIMIT 10`,
      )
      .all();

  res.json({
    answered_by_category: byCategory('history'),
    saved_by_category: byCategory('saved_questions'),
    top_saved: top('saved_questions'),
    top_answered: top('history'),
    // Signed-in users seen in the last 14 days, and how many of them came
    // back on 2+ different days.
    active_14d: count('SELECT COUNT(DISTINCT user_id) AS c FROM user_activity WHERE day >= ?', since),
    returning_14d: count(
      `SELECT COUNT(*) AS c FROM (SELECT user_id FROM user_activity WHERE day >= ?
       GROUP BY user_id HAVING COUNT(*) >= 2)`,
      since,
    ),
  });
});

router.get('/reports', (req, res) => {
  const rows = db
    .prepare(
      `SELECT r.id, r.category, r.message, r.contact, r.page, r.user_agent, r.resolved_at, r.replied_at, r.deleted_at, r.created_at,
              r.screenshot_path IS NOT NULL AS has_screenshot, u.nickname, u.email
       FROM bug_reports r LEFT JOIN users u ON u.id = r.user_id
       ORDER BY r.resolved_at IS NOT NULL, r.created_at DESC`,
    )
    .all()
    .map((r) => ({ ...r, has_screenshot: !!r.has_screenshot }));
  res.json({ reports: rows });
});

router.get('/reports/:id/screenshot', (req, res) => {
  const row = db.prepare('SELECT screenshot_path FROM bug_reports WHERE id = ?').get(Number(req.params.id));
  const file = row?.screenshot_path && join(REPORT_DIR, basename(row.screenshot_path));
  if (!file || !fs.existsSync(file)) return res.status(404).json({ error: 'ไม่พบรูป', error_code: 'NOT_FOUND' });
  res.sendFile(file);
});

router.post('/reports/:id/:action(resolve|reopen)', (req, res) => {
  const { changes } = db
    .prepare(
      req.params.action === 'resolve'
        ? `UPDATE bug_reports SET resolved_at = COALESCE(resolved_at, datetime('now')) WHERE id = ?`
        : 'UPDATE bug_reports SET resolved_at = NULL WHERE id = ?',
    )
    .run(Number(req.params.id));
  if (!changes) return res.status(404).json({ error: 'ไม่พบรายงาน', error_code: 'NOT_FOUND' });
  res.json({ ok: true });
});

// ---- Thank-you reply to a reporter (fixed template, one click) ----
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REPLY_BODY = {
  bug: 'ขอบคุณที่แจ้งบัคให้เรารู้นะ ทีมแก้ไขเรื่องที่คุณแจ้งเรียบร้อยแล้ว ลองใช้งานอีกครั้งได้เลย ถ้ายังเจอปัญหาอยู่ แจ้งเรามาได้ทุกเมื่อ',
  problem: 'ขอบคุณที่แจ้งปัญหาให้เรารู้นะ ทีมแก้ไขเรื่องที่คุณแจ้งเรียบร้อยแล้ว ลองใช้งานอีกครั้งได้เลย ถ้ายังติดขัดอยู่ แจ้งเรามาได้ทุกเมื่อ',
  idea: 'ขอบคุณสำหรับข้อเสนอแนะนะ ทีมอ่านแล้ว และจะนำไปพัฒนา DeePer ให้ดีขึ้นต่อไป',
};

// Where a reply can go: the reporter's account email, else their contact
// field when it's an email address.
function replyAddress(r) {
  if (r.email) return r.email;
  return r.contact && EMAIL_RE.test(r.contact) ? r.contact : null;
}

router.post('/reports/:id/reply', async (req, res) => {
  const r = db
    .prepare('SELECT r.*, u.email FROM bug_reports r LEFT JOIN users u ON u.id = r.user_id WHERE r.id = ?')
    .get(Number(req.params.id));
  if (!r) return res.status(404).json({ error: 'ไม่พบรายงาน', error_code: 'NOT_FOUND' });
  const to = replyAddress(r);
  if (!to) return res.status(400).json({ error: 'รายงานนี้ไม่มีอีเมลให้ตอบกลับ', error_code: 'REPORT_NO_EMAIL' });

  const text = `${REPLY_BODY[r.category] || REPLY_BODY.problem}\n\nเรื่องที่คุณแจ้งมา:\n"${r.message}"\n\n— ทีม DeePer`;
  // Never mail from the test suite (a real .env may hold SMTP credentials).
  const { delivered } =
    process.env.NODE_ENV === 'test'
      ? { delivered: true }
      : await sendMail({ to, subject: 'DeePer: ขอบคุณที่แจ้งเรานะ', text });
  if (!delivered)
    return res.status(503).json({ error: 'ยังไม่ได้ตั้งค่า SMTP จึงส่งอีเมลไม่ได้', error_code: 'MAIL_NOT_CONFIGURED' });
  db.prepare(`UPDATE bug_reports SET replied_at = datetime('now') WHERE id = ?`).run(r.id);
  res.json({ ok: true });
});

router.get('/proofs', (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.id, p.display_name, p.transfer_date, p.transfer_time, p.amount, p.slip_path,
              p.approved_at, p.rejected_at, p.deleted_at, p.created_at, u.nickname, u.email
       FROM support_proofs p LEFT JOIN users u ON u.id = p.user_id
       ORDER BY p.approved_at IS NOT NULL OR p.rejected_at IS NOT NULL, p.created_at DESC`,
    )
    .all();
  res.json({ proofs: rows });
});

// Decline to show a donor's name (e.g. it's inappropriate) and thank them
// by email instead, at the address they signed up with. The proof stays on
// file and can still be approved later.
const REJECT_TEXT = (name) =>
  `ขอบคุณมากที่สนับสนุน DeePer นะ ทุกการสนับสนุนช่วยให้เราพัฒนาแอปต่อไปได้จริง ๆ\n\n` +
  `เราได้รับหลักฐานการโอนของคุณแล้ว แต่ขออนุญาตไม่แสดงชื่อ "${name}" บนหน้าเว็บ ` +
  `เพราะชื่อหรือความหมายอาจไม่เหมาะสมกับพื้นที่สาธารณะ\n\n` +
  `ถ้าอยากให้แสดงชื่ออื่น ส่งหลักฐานใหม่ในแอปพร้อมชื่อที่ต้องการได้เลย\n\n— ทีม DeePer`;

router.post('/proofs/:id/reject', async (req, res) => {
  const p = db
    .prepare('SELECT p.*, u.email FROM support_proofs p LEFT JOIN users u ON u.id = p.user_id WHERE p.id = ?')
    .get(Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'ไม่พบหลักฐาน', error_code: 'NOT_FOUND' });
  db.prepare(`UPDATE support_proofs SET approved_at = NULL, rejected_at = datetime('now') WHERE id = ?`).run(p.id);

  let emailed = false;
  if (p.email) {
    // Never mail from the test suite (a real .env may hold SMTP credentials).
    emailed =
      process.env.NODE_ENV === 'test' ||
      (await sendMail({ to: p.email, subject: 'ขอบคุณที่สนับสนุน DeePer', text: REJECT_TEXT(p.display_name) })
        .then((r) => r.delivered)
        .catch((err) => {
          console.error('[admin] reject email failed', err);
          return false;
        }));
  }
  res.json({ ok: true, emailed, email: p.email || null });
});

router.post('/proofs/:id/:action(approve|revoke)', (req, res) => {
  const id = Number(req.params.id);
  const done = (req.params.action === 'approve' ? approveProofs : revokeProofs)([id]);
  if (!done.length) return res.status(404).json({ error: 'ไม่พบหลักฐาน', error_code: 'NOT_FOUND' });
  res.json({ ok: true });
});

// ---- Sponsorship inquiries ----
router.get('/inquiries', (req, res) => {
  res.json({
    inquiries: db
      .prepare('SELECT * FROM sponsor_inquiries ORDER BY handled_at IS NOT NULL, created_at DESC')
      .all(),
  });
});

router.post('/inquiries/:id/:action(handled|reopen)', (req, res) => {
  const { changes } = db
    .prepare(
      req.params.action === 'handled'
        ? `UPDATE sponsor_inquiries SET handled_at = COALESCE(handled_at, datetime('now')) WHERE id = ?`
        : 'UPDATE sponsor_inquiries SET handled_at = NULL WHERE id = ?',
    )
    .run(Number(req.params.id));
  if (!changes) return res.status(404).json({ error: 'ไม่พบคำขอ', error_code: 'NOT_FOUND' });
  res.json({ ok: true });
});

// ---- Reviews: approve before they show on the landing page ----
router.get('/reviews', (req, res) => {
  res.json({
    reviews: db
      .prepare(
        `SELECT r.*, u.nickname, u.nickname_en, u.email
         FROM reviews r JOIN users u ON u.id = r.user_id
         ORDER BY r.status = 'pending' DESC, r.updated_at DESC`,
      )
      .all(),
  });
});

router.post('/reviews/:id/:action(approve|reject|pending)', (req, res) => {
  const status = { approve: 'approved', reject: 'rejected', pending: 'pending' }[req.params.action];
  const { changes } = db
    .prepare(
      `UPDATE reviews SET status = ?,
         approved_at = CASE WHEN ? = 'approved' THEN datetime('now') ELSE NULL END
       WHERE id = ?`,
    )
    .run(status, status, Number(req.params.id));
  if (!changes) return res.status(404).json({ error: 'ไม่พบรีวิว', error_code: 'NOT_FOUND' });
  res.json({ ok: true });
});

router.delete('/reviews/:id', (req, res) => {
  const { changes } = db.prepare('DELETE FROM reviews WHERE id = ?').run(Number(req.params.id));
  if (!changes) return res.status(404).json({ error: 'ไม่พบรีวิว', error_code: 'NOT_FOUND' });
  res.json({ ok: true });
});

// ---- Trash: reports, sponsor inquiries and transfer proofs ----
// Moving to the trash only sets deleted_at (the item stays viewable under
// the trash filter and can be restored). Deleting for good is allowed only
// from the trash, and also removes the uploaded screenshot or slip.
const UPLOADS_DIR = join(__dirname, '..', '..', 'uploads');
const TRASHABLE = {
  reports: { table: 'bug_reports', file: (r) => r.screenshot_path && join(REPORT_DIR, basename(r.screenshot_path)) },
  inquiries: { table: 'sponsor_inquiries', file: () => null },
  proofs: { table: 'support_proofs', file: (r) => join(UPLOADS_DIR, 'slips', basename(r.slip_path)) },
};

router.post('/:kind(reports|inquiries|proofs)/:id/:action(trash|restore)', (req, res) => {
  const { table } = TRASHABLE[req.params.kind];
  const { changes } = db
    .prepare(
      req.params.action === 'trash'
        ? `UPDATE ${table} SET deleted_at = COALESCE(deleted_at, datetime('now')) WHERE id = ?`
        : `UPDATE ${table} SET deleted_at = NULL WHERE id = ?`,
    )
    .run(Number(req.params.id));
  if (!changes) return res.status(404).json({ error: 'ไม่พบรายการ', error_code: 'NOT_FOUND' });
  res.json({ ok: true });
});

router.delete('/:kind(reports|inquiries|proofs)/:id', (req, res) => {
  const { table, file } = TRASHABLE[req.params.kind];
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'ไม่พบรายการ', error_code: 'NOT_FOUND' });
  if (!row.deleted_at)
    return res.status(409).json({ error: 'ย้ายไปถังขยะก่อน จึงจะลบถาวรได้', error_code: 'NOT_IN_TRASH' });
  db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(row.id);
  const path = file(row);
  if (path) fs.rm(path, { force: true }, () => {});
  res.status(204).end();
});

// ---- Sponsor logos ----
const SPONSOR_TIERS = ['high', 'medium', 'general'];
const SPONSOR_DIR = join(__dirname, '..', '..', 'uploads', 'sponsors');
fs.mkdirSync(SPONSOR_DIR, { recursive: true });

const LOGO_MIME_EXT = { 'image/png': '.png', 'image/webp': '.webp', 'image/jpeg': '.jpg', 'image/svg+xml': '.svg' };
const logoUpload = multer({
  storage: multer.diskStorage({
    destination: SPONSOR_DIR,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${randomUUID().slice(0, 8)}${LOGO_MIME_EXT[file.mimetype]}`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, !!LOGO_MIME_EXT[file.mimetype]),
});

// Optional link: only plain http(s) URLs.
function cleanLink(v) {
  const s = String(v || '').trim();
  if (!s) return { link: null };
  try {
    const u = new URL(s);
    if (u.protocol === 'http:' || u.protocol === 'https:') return { link: u.href.slice(0, 300) };
  } catch {
    /* invalid */
  }
  return { error: true };
}

const sponsorError = (req, res, error, code) => {
  if (req.file) fs.rm(req.file.path, { force: true }, () => {});
  return res.status(400).json({ error, error_code: code });
};

router.get('/sponsors', (req, res) => {
  res.json({ sponsors: db.prepare('SELECT * FROM sponsors ORDER BY created_at, id').all() });
});

router.post('/sponsors', (req, res) =>
  logoUpload.single('logo')(req, res, (err) => {
    if (err) return sponsorError(req, res, 'อัปโหลดโลโก้ไม่สำเร็จ (ไฟล์ใหญ่เกิน 2MB หรือชนิดไม่รองรับ)', 'LOGO_UPLOAD_FAILED');
    const name = String(req.body.name || '').trim().slice(0, 60);
    const tier = String(req.body.tier || '');
    const { link, error } = cleanLink(req.body.link);
    if (!req.file) return sponsorError(req, res, 'กรุณาแนบโลโก้', 'LOGO_REQUIRED');
    if (!name) return sponsorError(req, res, 'กรุณาใส่ชื่อสปอนเซอร์', 'NAME_REQUIRED');
    if (!SPONSOR_TIERS.includes(tier)) return sponsorError(req, res, 'กรุณาเลือกระดับ', 'TIER_INVALID');
    if (error) return sponsorError(req, res, 'ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://', 'LINK_INVALID');
    const { lastInsertRowid: id } = db
      .prepare('INSERT INTO sponsors (name, tier, logo_path, link) VALUES (?, ?, ?, ?)')
      .run(name, tier, `/uploads/sponsors/${req.file.filename}`, link);
    res.json({ sponsor: db.prepare('SELECT * FROM sponsors WHERE id = ?').get(id) });
  }),
);

router.patch('/sponsors/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM sponsors WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'ไม่พบสปอนเซอร์', error_code: 'NOT_FOUND' });
  const tier = req.body?.tier ?? row.tier;
  const name = req.body?.name !== undefined ? String(req.body.name).trim().slice(0, 60) : row.name;
  const { link, error } = req.body?.link !== undefined ? cleanLink(req.body.link) : { link: row.link };
  if (!SPONSOR_TIERS.includes(tier)) return res.status(400).json({ error: 'กรุณาเลือกระดับ', error_code: 'TIER_INVALID' });
  if (!name) return res.status(400).json({ error: 'กรุณาใส่ชื่อสปอนเซอร์', error_code: 'NAME_REQUIRED' });
  if (error) return res.status(400).json({ error: 'ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://', error_code: 'LINK_INVALID' });
  db.prepare('UPDATE sponsors SET tier = ?, name = ?, link = ? WHERE id = ?').run(tier, name, link, row.id);
  res.json({ ok: true });
});

router.delete('/sponsors/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM sponsors WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'ไม่พบสปอนเซอร์', error_code: 'NOT_FOUND' });
  db.prepare('DELETE FROM sponsors WHERE id = ?').run(row.id);
  fs.rm(join(SPONSOR_DIR, basename(row.logo_path)), { force: true }, () => {});
  res.status(204).end();
});

export default router;
