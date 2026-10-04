import { Router } from 'express';
import fs from 'node:fs';
import { join, basename } from 'node:path';
import { db } from '../db.js';
import { requireAdmin } from '../auth.js';
import { approveProofs, revokeProofs } from '../supporters.js';
import { REPORT_DIR } from './reports.js';

const router = Router();

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

  res.json({
    users_total: count('SELECT COUNT(*) AS c FROM users'),
    signups_today: count(`SELECT COUNT(*) AS c FROM users WHERE date(created_at, ${BKK}) = ${today}`),
    active_today: count(`SELECT COUNT(*) AS c FROM user_activity WHERE day = ${today}`),
    logins_today: count(`SELECT COUNT(*) AS c FROM login_history WHERE date(created_at, ${BKK}) = ${today}`),
    answers_today: count(`SELECT COUNT(*) AS c FROM history WHERE date(created_at, ${BKK}) = ${today}`),
    reports_open: count('SELECT COUNT(*) AS c FROM bug_reports WHERE resolved_at IS NULL'),
    proofs_pending: count('SELECT COUNT(*) AS c FROM support_proofs WHERE approved_at IS NULL'),
    days: days.map((d) => ({ day: d, active: active[d] || 0, signups: signups[d] || 0 })),
  });
});

router.get('/reports', (req, res) => {
  const rows = db
    .prepare(
      `SELECT r.id, r.category, r.message, r.contact, r.page, r.user_agent, r.resolved_at, r.created_at,
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

router.get('/proofs', (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.id, p.display_name, p.transfer_date, p.transfer_time, p.amount, p.slip_path,
              p.approved_at, p.created_at, u.nickname, u.email
       FROM support_proofs p LEFT JOIN users u ON u.id = p.user_id
       ORDER BY p.approved_at IS NOT NULL, p.created_at DESC`,
    )
    .all();
  res.json({ proofs: rows });
});

router.post('/proofs/:id/:action(approve|revoke)', (req, res) => {
  const id = Number(req.params.id);
  const done = (req.params.action === 'approve' ? approveProofs : revokeProofs)([id]);
  if (!done.length) return res.status(404).json({ error: 'ไม่พบหลักฐาน', error_code: 'NOT_FOUND' });
  res.json({ ok: true });
});

export default router;
