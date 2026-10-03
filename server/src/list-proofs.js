// Quick back-office view: print everyone who submitted transfer proof.
// Run from the server folder:  npm run proofs
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';
import { db } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SLIP_DIR = join(__dirname, '..', 'uploads', 'slips');

// SELECT * (not an explicit column list) because fresh installs no longer
// have the legacy transfer_at column at all — only pre-split-field databases
// carry it, via the migration in db.js.
const rows = db.prepare('SELECT * FROM support_proofs ORDER BY created_at DESC').all();

const pending = rows.filter((r) => !r.notified).length;

console.log(`\n===== ผู้สนับสนุนที่ส่งหลักฐาน =====`);
console.log(`ทั้งหมด: ${rows.length} ราย   |   รอส่งเข้าอีเมลสรุป: ${pending} ราย\n`);

if (rows.length === 0) {
  console.log('(ยังไม่มีใครส่งหลักฐาน)\n');
} else {
  for (const r of rows) {
    const amount = r.amount != null ? `${r.amount} บาท` : 'ไม่ระบุ';
    console.log(`#${r.id}  ${r.display_name}`);
    console.log(`     จำนวนเงิน : ${amount}`);
    console.log(`     โอนเมื่อ  : ${r.transfer_date} ${r.transfer_time}`);
    console.log(`     ส่งเมื่อ  : ${r.created_at}  ${r.notified ? '✓ ส่งเข้าอีเมลสรุปแล้ว' : '• รอส่งเข้าอีเมลสรุป'}`);
    console.log(
      `     หน้าเว็บ  : ${r.approved_at ? `✓ ขึ้นชื่อแล้ว (อนุมัติ ${r.approved_at})` : `• ยังไม่ขึ้น — อนุมัติด้วย npm run approve -- ${r.id}`}`,
    );
    console.log(`     สลิป      : ${join(SLIP_DIR, basename(r.slip_path))}`);
    console.log('');
  }
}
