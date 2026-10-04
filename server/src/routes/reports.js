import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { db } from '../db.js';
import { optionalAuth } from '../auth.js';
import { sendMail } from '../mailer.js';

const router = Router();

// Screenshots can show a user's private answers, so they live outside the
// publicly served uploads/ folder — only the maintainer sees them (by email,
// or on disk via `npm run reports`).
const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPORT_DIR = join(__dirname, '..', '..', 'private-uploads', 'reports');
fs.mkdirSync(REPORT_DIR, { recursive: true });

const REPORT_CATEGORIES = ['bug', 'problem', 'idea'];
const CATEGORY_LABEL = { bug: 'บัค', problem: 'ปัญหาการใช้งาน', idea: 'ข้อเสนอแนะ' };
// Never mail from the test suite — a developer's real .env may hold SMTP
// credentials, and each test run would land in their inbox.
const REPORTS_TO =
  process.env.NODE_ENV === 'test'
    ? ''
    : process.env.REPORTS_TO || process.env.SUPPORT_DIGEST_TO || process.env.SMTP_USER || '';

const SHOT_MIME_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const shotUpload = multer({
  storage: multer.diskStorage({
    destination: REPORT_DIR,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${randomUUID().slice(0, 8)}${SHOT_MIME_EXT[file.mimetype]}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, !!SHOT_MIME_EXT[file.mimetype]),
});

// Wrap multer so its errors (too large / rejected type) come back as JSON.
const handleShot = (req, res, next) =>
  shotUpload.single('screenshot')(req, res, (err) => {
    if (err)
      return res.status(400).json({
        error: 'อัปโหลดรูปไม่สำเร็จ (ไฟล์ใหญ่เกิน 5MB หรือชนิดไม่รองรับ)',
        error_code: 'REPORT_UPLOAD_FAILED',
      });
    next();
  });

// Open to guests, so cap it per visitor to keep it from being used as a
// spam pipe into the maintainer's inbox.
const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'ส่งรายงานบ่อยเกินไป กรุณาลองใหม่ภายหลัง', error_code: 'REPORT_RATE_LIMITED' },
});

const reject = (req, res, status, error, code) => {
  if (req.file) fs.rm(req.file.path, { force: true }, () => {});
  return res.status(status).json({ error, error_code: code });
};

// Bug / problem / idea report from anyone, signed in or not. Stored first,
// then emailed to the maintainer right away (Render's free plan wipes the DB
// on redeploy, so the email is what actually reaches a person).
router.post('/', reportLimiter, optionalAuth, handleShot, (req, res) => {
  const category = String(req.body.category || '');
  const message = String(req.body.message || '').trim();
  const contact = String(req.body.contact || '').trim().slice(0, 120);
  const page = String(req.body.page || '').trim().slice(0, 200);
  const userAgent = String(req.headers['user-agent'] || '').slice(0, 300);

  if (!REPORT_CATEGORIES.includes(category))
    return reject(req, res, 400, 'กรุณาเลือกประเภทของรายงาน', 'REPORT_CATEGORY_INVALID');
  if (message.length < 5)
    return reject(req, res, 400, 'กรุณาเล่ารายละเอียดอย่างน้อย 5 ตัวอักษร', 'REPORT_MESSAGE_REQUIRED');

  const shotPath = req.file ? req.file.filename : null;
  const { lastInsertRowid: id } = db
    .prepare(
      `INSERT INTO bug_reports (user_id, category, message, contact, page, user_agent, screenshot_path)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(req.user?.id ?? null, category, message.slice(0, 2000), contact || null, page || null, userAgent, shotPath);

  if (REPORTS_TO) {
    const who = req.user ? `${req.user.nickname} <${req.user.email || 'ไม่มีอีเมล'}> (user #${req.user.id})` : 'ผู้ใช้ที่ยังไม่ล็อกอิน';
    const text = [
      `ประเภท: ${CATEGORY_LABEL[category]}`,
      `จาก: ${who}`,
      contact ? `ช่องทางติดต่อกลับ: ${contact}` : null,
      page ? `หน้าที่เจอ: ${page}` : null,
      `อุปกรณ์: ${userAgent || 'ไม่ทราบ'}`,
      '',
      message,
      '',
      `— DeePer (รายงาน #${id})`,
    ]
      .filter((l) => l !== null)
      .join('\n');
    sendMail({
      to: REPORTS_TO,
      subject: `[DeePer] ${CATEGORY_LABEL[category]} #${id}: ${message.slice(0, 50)}`,
      text,
      attachments: req.file ? [{ filename: `report-${id}${SHOT_MIME_EXT[req.file.mimetype]}`, path: req.file.path }] : undefined,
    }).catch((err) => console.error('[reports] email failed', err));
  } else if (process.env.NODE_ENV !== 'test') {
    console.warn('[reports] no recipient — set REPORTS_TO (or SMTP_USER) to get reports by email');
  }

  res.json({ ok: true });
});

export default router;
