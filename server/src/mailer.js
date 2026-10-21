import nodemailer from 'nodemailer';

// If SMTP env vars are set, send real email. Otherwise fall back to logging the
// OTP to the server console so the app works out of the box during development.
let transporter = null;
const smtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

if (smtpConfigured) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

export const mailerReady = smtpConfigured;

// Who the mail says it's from. Mail providers only trust a sender address
// whose domain the sending server is allowed to send for (SPF/DKIM/DMARC).
// Sent through Gmail's SMTP as "no-reply@deeper.in.th" — a domain with none
// of those records — Gmail and others treated it as spoofed: straight to
// spam, or a red "this message might be dangerous" banner. So through a
// Gmail/Google SMTP login the From is the logged-in account itself unless
// SMTP_FROM is on that same domain; other providers (set up with DNS for
// the domain) keep SMTP_FROM as given.
const addressOf = (from) => (String(from).match(/<([^>]+)>/)?.[1] || String(from)).trim().toLowerCase();
const domainOf = (address) => address.split('@')[1] || '';
function resolveFrom() {
  const user = String(process.env.SMTP_USER || '').trim();
  const fallback = user.includes('@') ? `DeePer <${user}>` : 'DeePer <no-reply@deeper.in.th>';
  const configured = process.env.SMTP_FROM;
  if (!configured) return fallback;
  const viaGoogle = /(^|\.)(gmail|googlemail|google)\.com$/i.test(String(process.env.SMTP_HOST || ''));
  if (viaGoogle && user.includes('@') && domainOf(addressOf(configured)) !== domainOf(user.toLowerCase())) {
    console.warn(
      `[mailer] SMTP_FROM (${addressOf(configured)}) isn't on the Gmail account's domain; sending as ${user} so mail isn't flagged as spoofed.`,
    );
    return fallback;
  }
  return configured;
}
const FROM = resolveFrom();
// Optional: where replies go (e.g. the team inbox) when From is a no-reply.
const REPLY_TO = process.env.SMTP_REPLY_TO || undefined;

const SUBJECTS = {
  register: 'รหัสยืนยันการสมัคร DeePer',
  reset: 'รหัสยืนยันการรีเซ็ตรหัสผ่าน DeePer',
};
const INTROS = {
  register: 'ใช้รหัสนี้เพื่อยืนยันอีเมลและสมัครใช้งาน DeePer',
  reset: 'ใช้รหัสนี้เพื่อตั้งรหัสผ่านใหม่ของบัญชี DeePer',
};

// The code email in both plain text and simple HTML (a text-only mail with
// just a number in it scores as spammier), with no links or images — links
// in a code email are what phishing filters look for.
function otpBodies(code, purpose) {
  const intro = INTROS[purpose] || INTROS.register;
  const ignore = 'ถ้าคุณไม่ได้ขอรหัสนี้ ไม่ต้องทำอะไร และอย่าส่งรหัสนี้ให้ใคร';
  const text = `${intro}\n\nรหัสยืนยัน: ${code}\nรหัสนี้หมดอายุใน 10 นาที\n\n${ignore}\n\nDeePer`;
  const html = `<!doctype html><html lang="th"><body style="margin:0;padding:24px;background:#f6f3f4;font-family:Arial,Helvetica,sans-serif;color:#241a1d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border-radius:12px;padding:28px">
<tr><td style="font-size:18px;font-weight:bold;color:#d6304f;padding-bottom:16px">DeePer</td></tr>
<tr><td style="font-size:15px;line-height:1.6;padding-bottom:18px">${intro}</td></tr>
<tr><td style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:14px 0;text-align:center;background:#f6f3f4;border-radius:8px">${code}</td></tr>
<tr><td style="font-size:13px;color:#6d5c61;line-height:1.6;padding-top:18px">รหัสนี้หมดอายุใน 10 นาที<br>${ignore}</td></tr>
</table></td></tr></table></body></html>`;
  return { text, html };
}

export async function sendOtpEmail(to, code, purpose = 'register') {
  const subject = SUBJECTS[purpose] || SUBJECTS.register;
  const { text, html } = otpBodies(code, purpose);

  if (!transporter) {
    // Dev fallback — visible in the terminal running the server.
    console.log(`\n========== [DeePer OTP] ==========`);
    console.log(`  ส่งถึง: ${to}`);
    console.log(`  รหัส OTP: ${code}`);
    console.log(`  (โหมดพัฒนา — ตั้งค่า SMTP_* เพื่อส่งอีเมลจริง)`);
    console.log(`====================================\n`);
    // The code still prints to the server console above regardless — this
    // field is only for the client to surface it inline during local dev.
    // Never ship it in a response in production: if SMTP is ever left
    // unconfigured there, this is the difference between "OTP flow is
    // broken" and "anyone can read anyone's OTP straight off the API".
    return { delivered: false, devCode: process.env.NODE_ENV === 'production' ? undefined : code };
  }

  await transporter.sendMail({ from: FROM, replyTo: REPLY_TO, to, subject, text, html });
  return { delivered: true };
}

// Generic sender (used by the support digest). Falls back to console when SMTP
// isn't configured so the rest of the flow still works in development.
export async function sendMail({ to, subject, text, html, attachments }) {
  // Subjects can carry user-typed text (a report's first line, an org or
  // donor name) — keep them to one line.
  subject = String(subject).replace(/[\r\n]+/g, ' ');
  if (!transporter) {
    console.log(`\n========== [DeePer mail — dev fallback] ==========`);
    console.log(`  ส่งถึง: ${to}`);
    console.log(`  หัวข้อ: ${subject}`);
    if (text) console.log(`\n${text}`);
    console.log(`  (โหมดพัฒนา — ตั้งค่า SMTP_* เพื่อส่งอีเมลจริง)`);
    console.log(`====================================================\n`);
    return { delivered: false };
  }
  await transporter.sendMail({ from: FROM, replyTo: REPLY_TO, to, subject, text, html, attachments });
  return { delivered: true };
}
