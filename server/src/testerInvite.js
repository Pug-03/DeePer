// The email that sends a tester their invite code. Built here so the admin
// dashboard can show exactly what will go out before the admin presses
// send, and the send itself uses the same words.
export const TESTER_SOURCES = ['instagram', 'tiktok', 'friend', 'google', 'other'];

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Plain text plus a simple HTML part, like the OTP mail: a text-only mail
// with a code and a link scores as spammier, and so do emoji.
export function testerInviteEmail({ nickname, code }) {
  const shownCode = code || '(ยังไม่ได้ตั้งรหัสเชิญ)';
  const steps = [
    'เปิด deeper.in.th/signup',
    'กรอกรหัสเชิญ 6 หลักด้านบน',
    'สมัครด้วย Google หรืออีเมล แล้วเริ่มคุยกันได้เลย',
  ];
  const feedback =
    'ระหว่างทดลอง ถ้าเจอปัญหาหรือมีไอเดีย บอกเราได้ที่เมนู "แจ้งปัญหาหรือเสนอแนะ" ในหน้าโปรไฟล์ ' +
    'ทุกความเห็นช่วยให้ DeePer ดีขึ้นก่อนเปิดตัวจริงวันที่ 11/11/2569 เวลา 11:11 น.';
  const text =
    `สวัสดี ${nickname}\n\n` +
    'ขอบคุณที่สนใจร่วมทดลองใช้ DeePer ก่อนใครนะ\n\n' +
    `รหัสเชิญของคุณคือ: ${shownCode}\n\n` +
    'วิธีเริ่มใช้งาน\n' +
    steps.map((s, i) => `${i + 1}. ${s}`).join('\n') +
    `\n\n${feedback}\n\nขอบคุณมาก\nทีม DeePer`;
  const html = `<!doctype html><html lang="th"><body style="margin:0;padding:24px;background:#f6f3f4;font-family:Arial,Helvetica,sans-serif;color:#241a1d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;padding:28px">
<tr><td style="font-size:18px;font-weight:bold;color:#d6304f;padding-bottom:16px">DeePer</td></tr>
<tr><td style="font-size:15px;line-height:1.6;padding-bottom:18px">สวัสดี ${escapeHtml(nickname)}<br>ขอบคุณที่สนใจร่วมทดลองใช้ DeePer ก่อนใครนะ</td></tr>
<tr><td style="font-size:13px;color:#6d5c61;padding-bottom:6px">รหัสเชิญของคุณ</td></tr>
<tr><td style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:14px 0;text-align:center;background:#f6f3f4;border-radius:8px">${escapeHtml(shownCode)}</td></tr>
<tr><td style="font-size:15px;line-height:1.7;padding-top:20px"><b>วิธีเริ่มใช้งาน</b><br>${steps.map((s, i) => `${i + 1}. ${escapeHtml(s)}`).join('<br>')}</td></tr>
<tr><td style="font-size:13px;color:#6d5c61;line-height:1.6;padding-top:18px">${escapeHtml(feedback)}</td></tr>
<tr><td style="font-size:15px;line-height:1.6;padding-top:18px">ขอบคุณมาก<br>ทีม DeePer</td></tr>
</table></td></tr></table></body></html>`;
  return { subject: 'รหัสเชิญทดลองใช้ DeePer ของคุณ', text, html };
}
