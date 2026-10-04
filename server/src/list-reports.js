// Quick back-office view: print every bug / problem / idea report.
// Run from the server folder:  npm run reports
import { join } from 'node:path';
import { db } from './db.js';
import { REPORT_DIR } from './routes/reports.js';

const LABEL = { bug: 'บัค', problem: 'ปัญหาการใช้งาน', idea: 'ข้อเสนอแนะ' };

const rows = db
  .prepare(
    `SELECT r.*, u.nickname, u.email FROM bug_reports r
     LEFT JOIN users u ON u.id = r.user_id
     ORDER BY r.created_at DESC`,
  )
  .all();

console.log(`\n===== รายงานปัญหา / บัค =====`);
console.log(`ทั้งหมด: ${rows.length} รายการ\n`);

if (rows.length === 0) {
  console.log('(ยังไม่มีรายงาน)\n');
} else {
  for (const r of rows) {
    const who = r.user_id ? `${r.nickname} <${r.email || 'ไม่มีอีเมล'}>` : 'ผู้ใช้ที่ยังไม่ล็อกอิน';
    console.log(`#${r.id}  [${LABEL[r.category] || r.category}]  ${r.created_at}`);
    console.log(`     จาก      : ${who}`);
    if (r.contact) console.log(`     ติดต่อกลับ : ${r.contact}`);
    if (r.page) console.log(`     หน้า      : ${r.page}`);
    console.log(`     อุปกรณ์   : ${r.user_agent || 'ไม่ทราบ'}`);
    if (r.screenshot_path) console.log(`     รูป       : ${join(REPORT_DIR, r.screenshot_path)}`);
    console.log(`     ${r.message.replace(/\n/g, '\n     ')}`);
    console.log('');
  }
}
