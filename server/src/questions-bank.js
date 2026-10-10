// คลังคำถาม DeePer — 3 หมวด × 3 ระดับ ทั้งภาษาไทยและอังกฤษ
// ตัวคำถามอยู่ใน questions/<หมวด>.js เป็นคู่ [ไทย, English]
import * as couple from './questions/couple.js';
import * as friends from './questions/friends.js';
import * as family from './questions/family.js';

export const CATEGORIES = ['couple', 'friends', 'family'];

export const CATEGORY_LABELS = {
  couple: 'คู่รัก',
  friends: 'เพื่อน ๆ',
  family: 'ครอบครัว',
};

// From light to deep: open (easy conversation starters), mid (memories and
// values), deep (deeper, more psychological). The deck's default order walks
// through them in this order.
export const LEVELS = ['open', 'mid', 'deep'];

const BY_CATEGORY = { couple, friends, family };

export function bankRows() {
  const rows = [];
  for (const category of CATEGORIES) {
    for (const level of LEVELS) {
      for (const [text, textEn] of BY_CATEGORY[category][level]) {
        rows.push({ category, level, text, text_en: textEn });
      }
    }
  }
  return rows;
}

// Thai text -> English, for rows that only stored the Thai text (saved
// questions, history).
const EN_BY_TEXT = new Map(bankRows().map((r) => [r.text, r.text_en]));
export const englishFor = (text) => EN_BY_TEXT.get(text) ?? null;
