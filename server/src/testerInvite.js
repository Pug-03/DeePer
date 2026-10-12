// The email that sends a tester their invite code. Built here so the admin
// dashboard can show exactly what will go out before the admin presses
// send, and the send itself uses the same words.
export const TESTER_SOURCES = ['instagram', 'tiktok', 'friend', 'google', 'other'];

export function testerInviteEmail({ nickname, code }) {
  return {
    subject: 'รหัสเชิญทดลองใช้ DeePer ของคุณ',
    text:
      `สวัสดี ${nickname} 👋\n\n` +
      'ขอบคุณที่สนใจร่วมทดลองใช้ DeePer ก่อนใครนะ\n\n' +
      `รหัสเชิญของคุณคือ: ${code || '(ยังไม่ได้ตั้งรหัสเชิญ)'}\n\n` +
      'วิธีเริ่มใช้งาน\n' +
      '1. เปิด https://deeper.in.th/signup\n' +
      '2. กรอกรหัสเชิญ 6 หลักด้านบน\n' +
      '3. สมัครด้วย Google หรืออีเมล แล้วเริ่มคุยกันได้เลย\n\n' +
      'ระหว่างทดลอง ถ้าเจอปัญหาหรือมีไอเดีย บอกเราได้ที่เมนู "แจ้งปัญหาหรือเสนอแนะ" ในหน้าโปรไฟล์ ' +
      'ทุกความเห็นช่วยให้ DeePer ดีขึ้นก่อนเปิดตัวจริงวันที่ 11/11/2569 เวลา 11:11 น.\n\n' +
      'ขอบคุณมาก\nทีม DeePer',
  };
}
