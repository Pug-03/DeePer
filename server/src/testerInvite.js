// The email that sends a tester their invite code. Built here so the admin
// dashboard can show exactly what will go out before the admin presses
// send, and the send itself uses the same words.
export const TESTER_SOURCES = ['instagram', 'tiktok', 'friend', 'google', 'other'];

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// The mail's frame: dark on purpose, the brand's own night-water look, so it
// reads the same whether the inbox is in light or dark mode (mail apps leave
// a dark mail alone instead of inverting it). Inline styles and tables only;
// mail apps drop most else.
function frame(rows) {
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<style>:root{color-scheme:dark}a{color:#ff8aa0}</style></head>
<body style="margin:0;padding:0;background:#0b0709" bgcolor="#0b0709">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0b0709" style="background:#0b0709;font-family:Arial,Helvetica,sans-serif"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="padding:0 4px 18px"><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#ff1d5a;box-shadow:0 0 14px 4px rgba(255,29,90,0.6);vertical-align:middle"></span><span style="padding-left:10px;font-size:24px;font-weight:bold;letter-spacing:-0.3px;color:#ffffff;vertical-align:middle">Dee<span style="color:#ff5a72">Per</span></span></td></tr>
<tr><td bgcolor="#150c10" style="background:#150c10;border:1px solid #3a1a24;border-radius:22px;padding:32px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${rows}
</table></td></tr>
<tr><td align="center" style="padding:20px 8px 0;font-size:12px;line-height:1.6;color:#6f676d">DeePer · การ์ดคำถามชวนคุยลึก ๆ · Deep-conversation cards · <a href="https://deeper.in.th" style="color:#9a8b91">deeper.in.th</a></td></tr>
</table></td></tr></table></body></html>`;
}

// Plain text plus a simple HTML part, like the OTP mail: a text-only mail
// with a code and a link scores as spammier, and so do emoji.
// English and Thai together (we don't know which the person reads): the
// whole mail in English, then a rule, then the whole mail again in Thai.
export function testerInviteEmail({ nickname, code }) {
  const shownCode = code || '(ยังไม่ได้ตั้งรหัสเชิญ)';
  const LANGS = [
    {
      hi: `สวัสดี ${nickname}`,
      thanks: 'ขอบคุณที่สนใจร่วมทดลองใช้ DeePer ก่อนใครนะ',
      codeLabel: 'รหัสเชิญของคุณ',
      cta: 'เปิด DeePer แล้วกรอกรหัส',
      howTo: 'วิธีเริ่มใช้งาน',
      steps: ['เปิด deeper.in.th/signup', 'กรอกรหัสเชิญ 6 หลักด้านบน', 'สมัครด้วย Google หรืออีเมล แล้วเริ่มคุยกันได้เลย'],
      feedback:
        'ระหว่างทดลอง ถ้าเจอปัญหาหรือมีไอเดีย บอกเราได้ที่เมนู "แจ้งปัญหาหรือเสนอแนะ" ในหน้าโปรไฟล์ ' +
        'ทุกความเห็นช่วยให้ DeePer ดีขึ้นก่อนเปิดตัวจริงวันที่ 11/11/2569 เวลา 11:11 น.',
      thankYou: 'ขอบคุณมาก',
      team: 'ทีม DeePer',
    },
    {
      hi: `Hi ${nickname},`,
      thanks: 'Thanks for joining the DeePer test before anyone else.',
      codeLabel: 'Your invite code',
      cta: 'Open DeePer',
      howTo: 'How to start',
      steps: ['Open deeper.in.th/signup', 'Enter the 6-digit invite code above', 'Sign up with Google or email, and start talking'],
      feedback:
        'During the test, if something breaks or you have an idea, tell us through "Report or suggest" on your profile. ' +
        'Every note helps make DeePer better before it opens to everyone on 11 Nov 2026 at 11:11 (GMT+7).',
      thankYou: 'Thank you',
      team: 'The DeePer team',
    },
  ];
  const text = [LANGS[1], LANGS[0]].map(
    (l) =>
      `${l.hi}\n\n${l.thanks}\n\n${l.codeLabel}: ${shownCode}\n\n${l.howTo}\n` +
      l.steps.map((st, i) => `${i + 1}. ${st}`).join('\n') +
      `\n\n${l.feedback}\n\n${l.thankYou}\n${l.team}`,
  ).join('\n\n— ภาษาไทย —\n\n');
  const section = (l) => `<tr><td style="padding:0 0 6px;font-size:26px;line-height:1.4;font-weight:bold;color:#ffffff">${escapeHtml(l.hi)}</td></tr>
<tr><td style="padding:0 0 26px;font-size:15px;line-height:1.7;color:#cbbec3">${escapeHtml(l.thanks)}</td></tr>
<tr><td style="padding:0 0 26px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1e0d14" style="background:#1e0d14;border:1px solid #5a1f33;border-radius:16px">
    <tr><td align="center" style="padding:22px 16px 6px;font-size:13px;color:#ff8aa0">${escapeHtml(l.codeLabel)}</td></tr>
    <tr><td align="center" style="padding:0 16px 22px 28px;font-size:40px;line-height:1.2;font-weight:bold;letter-spacing:12px;color:#ffffff;font-family:'Courier New',Courier,monospace">${escapeHtml(shownCode)}</td></tr>
  </table>
</td></tr>
<tr><td align="center" style="padding:0 0 30px">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td bgcolor="#ff1d5a" style="background:#ff1d5a;border-radius:999px">
      <a href="https://deeper.in.th/signup" style="display:inline-block;padding:15px 36px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none">${escapeHtml(l.cta)} &rarr;</a>
    </td>
  </tr></table>
</td></tr>
<tr><td style="padding:0 0 12px;font-size:14px;font-weight:bold;color:#ffffff">${escapeHtml(l.howTo)}</td></tr>
${l.steps
  .map(
    (st, i) => `<tr><td style="padding:0 0 10px">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td valign="top" width="30" style="padding-top:1px"><span style="display:inline-block;width:22px;height:22px;line-height:22px;border-radius:50%;background:#3a1522;color:#ff8aa0;font-size:12px;font-weight:bold;text-align:center">${i + 1}</span></td>
    <td style="font-size:15px;line-height:1.6;color:#e9e1e4">${escapeHtml(st)}</td>
  </tr></table>
</td></tr>`,
  )
  .join('')}
<tr><td style="padding:16px 0 0;border-top:1px solid #2c1820;font-size:13px;line-height:1.7;color:#9a8b91">${escapeHtml(l.feedback)}</td></tr>
<tr><td style="padding:22px 0 0;font-size:15px;line-height:1.6;color:#e9e1e4">${escapeHtml(l.thankYou)}<br><span style="color:#ff5a72;font-weight:bold">${escapeHtml(l.team)}</span></td></tr>`;
  const html = frame(
    section(LANGS[1]) +
      `<tr><td style="padding:36px 0 32px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
  <td style="border-top:1px solid #3a1a24;font-size:0;line-height:0">&nbsp;</td>
  <td width="1" style="padding:0 14px;font-size:12px;color:#6f676d;white-space:nowrap">ภาษาไทย</td>
  <td style="border-top:1px solid #3a1a24;font-size:0;line-height:0">&nbsp;</td>
</tr></table></td></tr>` +
      section(LANGS[0]),
  );
  return { subject: 'Your DeePer invite code · รหัสเชิญทดลองใช้ DeePer ของคุณ', text, html };
}

// The same mail after the admin has edited its words in the dashboard: their
// subject and text as typed, and an HTML part in the same frame (the text's
// line breaks kept, nothing else formatted).
export function editedInviteEmail({ subject, text }) {
  const html = frame(
    `<tr><td style="font-size:15px;line-height:1.75;color:#e9e1e4">${escapeHtml(text).replace(/\n/g, '<br>')}</td></tr>`,
  );
  return { subject, text, html };
}
