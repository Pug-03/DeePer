// Quick back-office view: print everyone who submitted transfer proof.
// Run from the server folder:  npm run proofs
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';
import { db } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SLIP_DIR = join(__dirname, '..', 'uploads', 'slips');

const rows = db
  .prepare(
    'SELECT id, display_name, transfer_at, slip_path, notified, created_at FROM support_proofs ORDER BY created_at DESC',
  )
  .all();

const pending = rows.filter((r) => !r.notified).length;

console.log(`\n===== ผู้สนับสนุนที่ส่งหลักฐาน =====`);
console.log(`ทั้งหมด: ${rows.length} ราย   |   รอส่งเข้าอีเมลสรุป: ${pending} ราย\n`);

if (rows.length === 0) {
  console.log('(ยังไม่มีใครส่งหลักฐาน)\n');
} else {
  for (const r of rows) {
    console.log(`#${r.id}  ${r.display_name}`);
    console.log(`     โอนเมื่อ : ${r.transfer_at}`);
    console.log(`     ส่งเมื่อ  : ${r.created_at}  ${r.notified ? '✓ ส่งเข้าอีเมลสรุปแล้ว' : '• รอส่งเข้าอีเมลสรุป'}`);
    console.log(`     สลิป     : ${join(SLIP_DIR, basename(r.slip_path))}`);
    console.log('');
  }
}
