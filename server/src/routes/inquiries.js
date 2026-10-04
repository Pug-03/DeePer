import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';
import { sendMail } from '../mailer.js';

const router = Router();

// Never mail from the test suite — a developer's real .env may hold SMTP
// credentials, and each test run would land in their inbox.
const NOTIFY_TO =
  process.env.NODE_ENV === 'test'
    ? ''
    : process.env.REPORTS_TO || process.env.SUPPORT_DIGEST_TO || process.env.SMTP_USER || '';

// Public form, so cap it per visitor to keep it from spamming the inbox.
const inquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'ส่งบ่อยเกินไป กรุณาลองใหม่ภายหลัง', error_code: 'INQUIRY_RATE_LIMITED' },
});

// An organization asking to sponsor DeePer. Stored for the admin dashboard
// and emailed to the maintainer right away.
router.post('/', inquiryLimiter, (req, res) => {
  const orgName = String(req.body?.org_name || '').trim().slice(0, 120);
  const contactName = String(req.body?.contact_name || '').trim().slice(0, 80);
  const contact = String(req.body?.contact || '').trim().slice(0, 120);
  const message = String(req.body?.message || '').trim().slice(0, 2000);

  if (!orgName) return res.status(400).json({ error: 'กรุณากรอกชื่อองค์กร', error_code: 'INQUIRY_ORG_REQUIRED' });
  if (!contactName)
    return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ติดต่อ', error_code: 'INQUIRY_NAME_REQUIRED' });
  if (!contact)
    return res.status(400).json({ error: 'กรุณากรอกอีเมลหรือเบอร์โทร', error_code: 'INQUIRY_CONTACT_REQUIRED' });
  if (message.length < 5)
    return res
      .status(400)
      .json({ error: 'กรุณาเล่ารายละเอียดอย่างน้อย 5 ตัวอักษร', error_code: 'INQUIRY_MESSAGE_REQUIRED' });

  const { lastInsertRowid: id } = db
    .prepare('INSERT INTO sponsor_inquiries (org_name, contact_name, contact, message) VALUES (?, ?, ?, ?)')
    .run(orgName, contactName, contact, message);

  if (NOTIFY_TO) {
    sendMail({
      to: NOTIFY_TO,
      subject: `[DeePer] มีองค์กรสนใจเป็นสปอนเซอร์: ${orgName}`,
      text:
        `องค์กร: ${orgName}\nผู้ติดต่อ: ${contactName}\nติดต่อกลับ: ${contact}\n\n${message}\n\n` +
        `— DeePer (คำขอ #${id}) ดูทั้งหมดได้ในหน้าแอดมิน แท็บสปอนเซอร์`,
    }).catch((err) => console.error('[inquiries] email failed', err));
  }

  res.json({ ok: true });
});

export default router;
