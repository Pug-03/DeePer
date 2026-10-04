import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { approvedSupporterNames, approveProofs, revokeProofs, proofByToken } from '../supporters.js';
import { sendMail } from '../mailer.js';

const router = Router();

// Never mail from the test suite — a developer's real .env may hold SMTP
// credentials, and each test run would land in their inbox.
const REVIEW_TO =
  process.env.NODE_ENV === 'test' ? '' : process.env.SUPPORT_DIGEST_TO || process.env.SMTP_USER || '';

// Public origin for links in emails: APP_URL if set, else Render's own
// external URL, else whatever host the request came in on.
const publicOrigin = (req) =>
  (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const __dirname = dirname(fileURLToPath(import.meta.url));
const SLIP_DIR = join(__dirname, '..', '..', 'uploads', 'slips');
fs.mkdirSync(SLIP_DIR, { recursive: true });

const SLIP_MIME_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const slipUpload = multer({
  storage: multer.diskStorage({
    destination: SLIP_DIR,
    filename: (req, file, cb) => cb(null, `${req.user.id}-${Date.now()}${SLIP_MIME_EXT[file.mimetype]}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, !!SLIP_MIME_EXT[file.mimetype]),
});

// Wrap multer so its errors (too large / rejected type) come back as JSON.
const handleSlip = (req, res, next) =>
  slipUpload.single('slip')(req, res, (err) => {
    if (err)
      return res.status(400).json({
        error: 'อัปโหลดสลิปไม่สำเร็จ (ไฟล์ใหญ่เกิน 5MB หรือชนิดไม่รองรับ)',
        error_code: 'SLIP_UPLOAD_FAILED',
      });
    next();
  });

// Supporter submits proof of transfer: slip image + date + time + amount +
// display name. Stored immediately, and the maintainer is emailed the slip
// with a review link to approve it (plus the batched digest every 15 days).
router.post('/proof', requireAuth, handleSlip, (req, res) => {
  const displayName = String(req.body.display_name || '').trim();
  const transferDate = String(req.body.transfer_date || '').trim();
  const transferTime = String(req.body.transfer_time || '').trim();
  const amount = Number(req.body.amount);

  if (!req.file)
    return res.status(400).json({ error: 'กรุณาแนบสลิป', error_code: 'SLIP_REQUIRED' });
  if (!displayName)
    return res.status(400).json({ error: 'กรุณากรอกชื่อที่อยากให้แสดง', error_code: 'NAME_REQUIRED' });
  if (!transferDate || !transferTime)
    return res.status(400).json({ error: 'กรุณาระบุวันและเวลาที่โอน', error_code: 'DATETIME_REQUIRED' });
  if (!Number.isFinite(amount) || amount <= 0)
    return res.status(400).json({ error: 'กรุณาระบุจำนวนเงินให้ถูกต้อง', error_code: 'AMOUNT_INVALID' });

  const slipUrl = `/uploads/slips/${req.file.filename}`;
  const token = randomBytes(24).toString('hex');
  const name = displayName.slice(0, 80);
  const { lastInsertRowid: id } = db
    .prepare(
      `INSERT INTO support_proofs (user_id, display_name, transfer_date, transfer_time, amount, slip_path, review_token)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(req.user.id, name, transferDate.slice(0, 20), transferTime.slice(0, 10), amount, slipUrl, token);

  if (REVIEW_TO) {
    const link = `${publicOrigin(req)}/api/support/review/${token}`;
    sendMail({
      to: REVIEW_TO,
      subject: `[DeePer] ผู้สนับสนุนใหม่: ${name} (${amount} บาท)`,
      text:
        `ชื่อที่อยากให้แสดง: ${name}\nจำนวนเงิน: ${amount} บาท\nโอนเมื่อ: ${transferDate} ${transferTime}\n\n` +
        `ตรวจสลิป (แนบมาในอีเมล) แล้วกดลิงก์นี้เพื่ออนุมัติ ชื่อจะขึ้นหน้าเว็บทันที:\n${link}\n\n— DeePer (หลักฐาน #${id})`,
      attachments: [{ filename: `slip-${id}${SLIP_MIME_EXT[req.file.mimetype]}`, path: req.file.path }],
    }).catch((err) => console.error('[support] review email failed', err));
  }

  res.json({ ok: true });
});

// Public: names of donors whose proof the maintainer has approved, for the
// "เพื่อนของ DeePer" tier on the landing page.
router.get('/supporters', (req, res) => {
  res.json({ supporters: approvedSupporterNames() });
});

// Review page behind the emailed link: shows the proof and its slip, with
// approve / hide buttons. Changes go through POST so a mail scanner that
// pre-opens the link can never approve anything by itself.
function reviewPage(proof, token) {
  const approved = !!proof.approved_at;
  const action = approved ? 'revoke' : 'approve';
  return `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>ตรวจหลักฐาน #${proof.id} — DeePer</title>
<style>
  body { margin: 0; padding: 24px 16px; font-family: system-ui, sans-serif; background: #120a0e; color: #f4f1f2; }
  main { max-width: 420px; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0 0 16px; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; margin: 0 0 16px; font-size: 15px; }
  dt { color: #a8a0a6; }
  dd { margin: 0; }
  img { width: 100%; border-radius: 12px; background: #fff; margin-bottom: 16px; }
  .state { padding: 10px 14px; border-radius: 12px; margin-bottom: 16px; font-size: 14px;
           background: ${approved ? 'rgba(52,211,153,.14); color: #6ee7b7' : 'rgba(255,255,255,.06); color: #d8d0d6'}; }
  button { width: 100%; min-height: 50px; border: 0; border-radius: 14px; font: inherit; font-size: 16px; font-weight: 600; cursor: pointer;
           color: #fff; background: ${approved ? '#3a2f37' : 'linear-gradient(120deg, #f43f5e, #be123c)'}; }
</style></head><body><main>
  <h1>หลักฐานการโอน #${proof.id}</h1>
  <div class="state">${approved ? `✓ ชื่อขึ้นหน้าเว็บแล้ว (อนุมัติ ${escapeHtml(proof.approved_at)})` : 'ยังไม่ขึ้นหน้าเว็บ'}</div>
  <dl>
    <dt>ชื่อที่แสดง</dt><dd>${escapeHtml(proof.display_name)}</dd>
    <dt>จำนวนเงิน</dt><dd>${proof.amount != null ? `${escapeHtml(proof.amount)} บาท` : 'ไม่ระบุ'}</dd>
    <dt>โอนเมื่อ</dt><dd>${escapeHtml(proof.transfer_date)} ${escapeHtml(proof.transfer_time)}</dd>
    <dt>ส่งเมื่อ</dt><dd>${escapeHtml(proof.created_at)}</dd>
  </dl>
  <img src="${escapeHtml(proof.slip_path)}" alt="สลิป">
  <form method="post" action="/api/support/review/${token}/${action}">
    <button type="submit">${approved ? 'ซ่อนชื่อออกจากหน้าเว็บ' : 'อนุมัติ ให้ชื่อขึ้นหน้าเว็บ'}</button>
  </form>
</main></body></html>`;
}

const notFound = (res) =>
  res.status(404).type('html').send('<!doctype html><meta charset="utf-8"><p>ไม่พบหลักฐานนี้ (ลิงก์ไม่ถูกต้องหรือข้อมูลถูกล้างไปแล้ว)</p>');

router.get('/review/:token', (req, res) => {
  const proof = proofByToken(req.params.token);
  if (!proof) return notFound(res);
  res.type('html').send(reviewPage(proof, req.params.token));
});

router.post('/review/:token/:action(approve|revoke)', (req, res) => {
  const proof = proofByToken(req.params.token);
  if (!proof) return notFound(res);
  (req.params.action === 'approve' ? approveProofs : revokeProofs)([proof.id]);
  res.redirect(303, `/api/support/review/${req.params.token}`);
});

export default router;
