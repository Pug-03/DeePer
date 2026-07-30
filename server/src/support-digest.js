import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';
import fs from 'node:fs';
import { db } from './db.js';
import { sendMail } from './mailer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SLIP_DIR = join(__dirname, '..', 'uploads', 'slips');

const DIGEST_DAYS = Number(process.env.SUPPORT_DIGEST_DAYS || 15);
const DIGEST_TO = process.env.SUPPORT_DIGEST_TO || process.env.SMTP_USER || '';
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // re-check every 6h
const META_KEY = 'support_digest_at';

const getMeta = (key) => db.prepare('SELECT value FROM app_meta WHERE key = ?').get(key)?.value ?? null;
const setMeta = (key, value) =>
  db
    .prepare('INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value);

/**
 * Email the maintainer a summary of everyone who submitted transfer proof since
 * the last digest, with each slip attached, then mark those rows notified. The
 * DB is the source of truth — a failed/skipped email never loses a submission.
 * Sends only when the window has elapsed AND there are pending rows.
 */
export async function runSupportDigest({ force = false } = {}) {
  const last = getMeta(META_KEY);
  const dueByTime = !last || Date.now() - Date.parse(last) >= DIGEST_DAYS * 86400000;
  if (!force && !dueByTime) return { sent: false, reason: 'not_due' };

  const rows = db
    .prepare('SELECT * FROM support_proofs WHERE notified = 0 ORDER BY created_at ASC')
    .all();
  if (rows.length === 0) return { sent: false, reason: 'empty' };

  if (!DIGEST_TO) {
    console.warn('[support-digest] no recipient — set SUPPORT_DIGEST_TO (or SMTP_USER) to receive the summary');
    return { sent: false, reason: 'no_recipient' };
  }

  const lines = rows.map((r, i) => {
    const amount = r.amount != null ? `${r.amount} บาท` : 'ไม่ระบุ';
    return `${i + 1}. ${r.display_name}\n     จำนวนเงิน: ${amount}\n     โอนเมื่อ: ${r.transfer_date} ${r.transfer_time}\n     ส่งเมื่อ: ${r.created_at}`;
  });
  const text =
    `มีผู้สนับสนุน ${rows.length} รายในรอบนี้ (สลิปแนบมาในอีเมล):\n\n` +
    `${lines.join('\n\n')}\n\n— DeePer`;

  const attachments = rows
    .map((r) => {
      const p = join(SLIP_DIR, basename(r.slip_path));
      return fs.existsSync(p) ? { filename: `slip-${r.id}${basename(r.slip_path).replace(/^[^.]*/, '')}`, path: p } : null;
    })
    .filter(Boolean);

  await sendMail({
    to: DIGEST_TO,
    subject: `DeePer — สรุปผู้สนับสนุน ${rows.length} ราย`,
    text,
    attachments,
  });

  const mark = db.prepare('UPDATE support_proofs SET notified = 1 WHERE id = ?');
  for (const r of rows) mark.run(r.id);
  setMeta(META_KEY, new Date().toISOString());

  console.log(`[support-digest] sent summary of ${rows.length} submission(s) to ${DIGEST_TO}`);
  return { sent: true, count: rows.length };
}

export function startSupportDigestScheduler() {
  // Start the clock on first boot so the first window is measured from now.
  if (!getMeta(META_KEY)) setMeta(META_KEY, new Date().toISOString());

  const tick = () => runSupportDigest().catch((e) => console.error('[support-digest]', e));
  // A short delay after boot, then on a fixed interval. On hosts that sleep,
  // the interval still runs whenever the server is awake (bounded by the window).
  setTimeout(tick, 30_000);
  setInterval(tick, CHECK_INTERVAL_MS);
}
