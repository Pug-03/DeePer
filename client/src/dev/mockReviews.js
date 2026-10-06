// DEV-ONLY FIXTURE — never real data, never shipped to production.
//
// Previews the landing page's reviews section before any real review has
// been approved. Names are obviously-fake numbered placeholders, never a
// name that could pass as a real person. Reachable only from Welcome.jsx
// behind `import.meta.env.DEV` (stripped from production builds) AND an
// explicit `?mockReviews=<count>` query flag, same as mockSupporters.js.
const TEXTS = [
  ['couple', 'ได้คุยเรื่องที่ไม่เคยคุยกับแฟนมาก่อน รู้จักกันมากขึ้นเยอะเลย', 'We talked about things we never had before and got so much closer.'],
  ['friends', 'เล่นกับแก๊งเพื่อนตอนไปเที่ยว คุยกันยาวจนลืมดูเวลา', 'Played it with my friends on a trip and lost track of time.'],
  ['family', 'ถามแม่ไปข้อเดียว ได้ฟังเรื่องตอนแม่เด็ก ๆ ที่ไม่เคยรู้มาก่อน', 'One question to my mom and I heard childhood stories I never knew.'],
  ['couple', 'คำถามไม่ยากเกินไป แต่ทำให้คิดตามได้จริง ชอบมาก', 'Easy to start, but the questions really make you think.'],
  ['friends', 'เพื่อนที่รู้จักมาสิบปี ยังมีเรื่องให้เซอร์ไพรส์อีกเยอะ', 'Ten years of friendship and they still surprised me.'],
];
export function makeMockReviewsDevOnly(count, lang) {
  return Array.from({ length: count }, (_, i) => {
    const [relation, th, en] = TEXTS[i % TEXTS.length];
    const n = String(i + 1).padStart(2, '0');
    return { id: -1 - i, relation, text: lang === 'en' ? en : th, nickname: `ผู้ทดสอบ ${n}`, nickname_en: `Tester ${n}` };
  });
}
