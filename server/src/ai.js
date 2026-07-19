import Anthropic from '@anthropic-ai/sdk';
import { CATEGORY_LABELS } from './questions-bank.js';

// The Anthropic client resolves ANTHROPIC_API_KEY from the environment.
// If no key is configured, generation is disabled and callers fall back to the bank.
const hasKey = !!process.env.ANTHROPIC_API_KEY;
const client = hasKey ? new Anthropic() : null;

export const aiReady = hasKey;

const AUDIENCE_HINT = {
  couple: 'คู่รักที่กำลังคบหาหรือแต่งงานกัน',
  friends: 'เพื่อนสนิท',
  family: 'สมาชิกในครอบครัว',
};

export async function generateQuestions(category, count = 6, avoid = []) {
  if (!client) throw new Error('AI ยังไม่พร้อมใช้งาน (ไม่ได้ตั้งค่า ANTHROPIC_API_KEY)');

  const label = CATEGORY_LABELS[category] || category;
  const audience = AUDIENCE_HINT[category] || label;
  const avoidText = avoid.length
    ? `\n\nหลีกเลี่ยงคำถามที่ซ้ำหรือใกล้เคียงกับรายการนี้:\n${avoid.slice(0, 40).map((q) => `- ${q}`).join('\n')}`
    : '';

  const prompt =
    `ช่วยสร้างคำถามชวนคุยลึก ๆ ภาษาไทย จำนวน ${count} ข้อ สำหรับใช้พูดคุยระหว่าง${audience} (หมวด "${label}")\n\n` +
    `เงื่อนไข:\n` +
    `- โทนอบอุ่น อ่อนโยน ชวนเปิดใจ ไม่ก้าวร้าว ไม่ตัดสิน\n` +
    `- เป็นคำถามปลายเปิดที่กระตุ้นให้เล่าความรู้สึกหรือความทรงจำ\n` +
    `- แต่ละข้อสั้น กระชับ อ่านง่ายบนมือถือ ลงท้ายด้วยเครื่องหมายคำถาม\n` +
    `- เหมาะกับ${audience}โดยเฉพาะ${avoidText}\n\n` +
    `ตอบกลับเป็น JSON เท่านั้น รูปแบบ: {"questions": ["...", "..."]} โดยไม่มีข้อความอื่นนอกเหนือจาก JSON`;

  const resp = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = resp.content.find((b) => b.type === 'text');
  const raw = textBlock ? textBlock.text : '';
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI ตอบกลับในรูปแบบที่ไม่ถูกต้อง');

  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    throw new Error('ไม่สามารถอ่านคำตอบจาก AI ได้');
  }

  const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
  return questions
    .filter((q) => typeof q === 'string' && q.trim().length > 0)
    .map((q) => q.trim())
    .slice(0, count);
}
