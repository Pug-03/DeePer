import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Where everything the app writes lives: the SQLite database, uploaded
// pictures (public) and bug-report screenshots (private). Set DATA_DIR to a
// persistent disk in production (Render: /var/data) so a redeploy or restart
// doesn't wipe them. Left unset, they stay in the server folder as before.
const serverDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = process.env.DATA_DIR || serverDir;

export const DB_PATH = process.env.DB_PATH || join(DATA_DIR, 'deeptalk.db');
export const UPLOADS_DIR = join(DATA_DIR, 'uploads');
export const PRIVATE_UPLOADS_DIR = join(DATA_DIR, 'private-uploads');
// Transfer slips show names, account numbers and amounts, so they're private:
// served only to the admin and through the emailed review link, never as a
// public /uploads file. Slips from before this moved here are moved on start
// (see moveOldSlips in routes/support.js).
export const SLIP_DIR = join(PRIVATE_UPLOADS_DIR, 'slips');
export const OLD_PUBLIC_SLIP_DIR = join(UPLOADS_DIR, 'slips');

// The data disk holds the DB and every upload, so a full disk stops the
// whole app (SQLite can't write). Uploads are refused while free space is
// under this floor, which leaves room for the database to keep working.
const MIN_FREE_BYTES = 200 * 1024 * 1024;

export function diskFreeBytes() {
  try {
    const s = fs.statfsSync(DATA_DIR);
    return s.bavail * s.bsize;
  } catch {
    return null;
  }
}

export const diskLow = () => {
  const free = diskFreeBytes();
  return free != null && free < MIN_FREE_BYTES;
};

// Route guard, placed before multer so nothing is written.
export function requireDiskSpace(req, res, next) {
  if (diskLow()) {
    console.error('[disk] free space under 200 MB, refusing upload');
    return res.status(507).json({ error: 'พื้นที่เก็บไฟล์ใกล้เต็ม ส่งรูปไม่ได้ชั่วคราว', error_code: 'STORAGE_FULL' });
  }
  next();
}
