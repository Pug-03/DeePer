import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

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

// Supporter submits proof of transfer: slip image + date/time + display name.
// Stored immediately; the maintainer gets a batched email digest every 15 days.
router.post('/proof', requireAuth, handleSlip, (req, res) => {
  const displayName = String(req.body.display_name || '').trim();
  const transferAt = String(req.body.transfer_at || '').trim();

  if (!req.file)
    return res.status(400).json({ error: 'กรุณาแนบสลิป', error_code: 'SLIP_REQUIRED' });
  if (!displayName)
    return res.status(400).json({ error: 'กรุณากรอกชื่อที่อยากให้แสดง', error_code: 'NAME_REQUIRED' });
  if (!transferAt)
    return res.status(400).json({ error: 'กรุณาระบุวันและเวลาที่โอน', error_code: 'DATETIME_REQUIRED' });

  const slipUrl = `/uploads/slips/${req.file.filename}`;
  db.prepare(
    'INSERT INTO support_proofs (user_id, display_name, transfer_at, slip_path) VALUES (?, ?, ?, ?)',
  ).run(req.user.id, displayName.slice(0, 80), transferAt.slice(0, 40), slipUrl);

  res.json({ ok: true });
});

export default router;
