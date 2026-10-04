// Approve (or take back) a supporter's transfer proof so their name shows
// in the "ผู้สนับสนุนรายบุคคล" tier on the landing page. Check the slip first —
// list everything with `npm run proofs`. Run from the server folder:
//   npm run approve -- 12 15          approve proofs #12 and #15
//   npm run approve -- --revoke 12    hide #12 again
import { approveProofs, revokeProofs } from './supporters.js';

const args = process.argv.slice(2);
const revoke = args.includes('--revoke');
const ids = args.filter((a) => a !== '--revoke').map(Number).filter(Number.isInteger);

if (ids.length === 0) {
  console.log('ใช้แบบนี้:  npm run approve -- <id> [<id> ...]   หรือ   npm run approve -- --revoke <id>');
  console.log('ดูเลข id ได้จาก  npm run proofs');
  process.exit(1);
}

const done = revoke ? revokeProofs(ids) : approveProofs(ids);
const missing = ids.filter((id) => !done.includes(id));
if (done.length) {
  console.log(
    revoke
      ? `ซ่อนชื่อออกจากหน้าเว็บแล้ว: #${done.join(', #')}`
      : `อนุมัติแล้ว ชื่อจะขึ้นในหน้าเว็บ: #${done.join(', #')}`,
  );
}
if (missing.length) console.log(`ไม่พบหลักฐานเลข: #${missing.join(', #')}`);
