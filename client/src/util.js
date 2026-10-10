import { translate } from './i18n.js';
import { currentLang } from './store/i18n.jsx';

export const CATS = ['couple', 'friends', 'family'];

// The question's English when the app is in English and the bank has one
// (questions people wrote themselves don't), otherwise the stored Thai.
export function questionText(text, textEn, lang) {
  return (lang === 'en' && textEn) || text;
}

export function catLabel(c) {
  return translate(currentLang, `cat.${c}`);
}

// SQLite stores "YYYY-MM-DD HH:MM:SS" in UTC.
export function formatDate(s) {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  if (isNaN(d)) return s;
  const locale = currentLang === 'en' ? 'en-US' : 'th-TH';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (sameDay) return `${translate(currentLang, 'date.today')} ${time}`;
  return (
    d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) + ` ${time}`
  );
}

// The nickname is kept in Thai (`nickname`) and English (`nickname_en`);
// show the one matching the app language. Accounts from before English
// names existed fall back to the Thai one.
export function displayName(user, lang) {
  if (!user) return '';
  return (lang === 'en' && user.nickname_en) || user.nickname || '';
}

// Same rules as the server (nameError in server/src/routes/auth.js): the
// Thai name needs Thai script and no Latin letters; the English one only
// Latin letters plus space . ' -. Returns an i18n key, or '' when valid.
export function nicknameThError(v) {
  const s = v.trim();
  if (!s) return 'signup.needNickname';
  if (!/[\u0E00-\u0E7F]/.test(s) || /[A-Za-z]/.test(s)) return 'signup.nicknameThInvalid';
  return '';
}
export function nicknameEnError(v) {
  const s = v.trim();
  if (!s) return 'signup.needNicknameEn';
  if (!/^[A-Za-z][A-Za-z .'-]*$/.test(s)) return 'signup.nicknameEnInvalid';
  return '';
}
