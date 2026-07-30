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

const SUBJECTS = {
  register: 'รหัส OTP สำหรับสมัคร DeePer',
  reset: 'รหัส OTP สำหรับรีเซ็ตรหัสผ่าน DeePer',
};

export async function sendOtpEmail(to, code, purpose = 'register') {
  const from = process.env.SMTP_FROM || 'DeePer <no-reply@deeper.app>';
  const subject = SUBJECTS[purpose] || SUBJECTS.register;
  const text = `รหัสยืนยันของคุณคือ ${code}\nรหัสนี้จะหมดอายุใน 10 นาที`;

  if (!transporter) {
    // Dev fallback — visible in the terminal running the server.
    console.log(`\n========== [DeePer OTP] ==========`);
    console.log(`  ส่งถึง: ${to}`);
    console.log(`  รหัส OTP: ${code}`);
    console.log(`  (โหมดพัฒนา — ตั้งค่า SMTP_* เพื่อส่งอีเมลจริง)`);
    console.log(`====================================\n`);
    return { delivered: false, devCode: code };
  }

  await transporter.sendMail({ from, to, subject, text });
  return { delivered: true };
}

// Generic sender (used by the support digest). Falls back to console when SMTP
// isn't configured so the rest of the flow still works in development.
export async function sendMail({ to, subject, text, html, attachments }) {
  const from = process.env.SMTP_FROM || 'DeePer <no-reply@deeper.app>';
  if (!transporter) {
    console.log(`\n========== [DeePer mail — dev fallback] ==========`);
    console.log(`  ส่งถึง: ${to}`);
    console.log(`  หัวข้อ: ${subject}`);
    if (text) console.log(`\n${text}`);
    console.log(`  (โหมดพัฒนา — ตั้งค่า SMTP_* เพื่อส่งอีเมลจริง)`);
    console.log(`====================================================\n`);
    return { delivered: false };
  }
  await transporter.sendMail({ from, to, subject, text, html, attachments });
  return { delivered: true };
}
