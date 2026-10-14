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
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `${translate(currentLang, 'date.today')} ${time}`;
  return (
    d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) + ` ${time}`
  );
}

// One nickname, in whatever language the person wrote it. Accounts from
// when there was a separate English name fall back to it only if the main
// one is missing. `lang` is kept for callers; the name doesn't change with it.
// eslint-disable-next-line no-unused-vars
export function displayName(user, lang) {
  if (!user) return '';
  return user.nickname || user.nickname_en || '';
}

// Same rule as the server (nameError in server/src/routes/auth.js): just
// required. Returns an i18n key, or '' when valid.
export function nicknameError(v) {
  return v.trim() ? '' : 'signup.needNickname';
}

// The partner's name as shown. Accounts made before names were optional
// store the Thai default "อีกฝ่าย" itself, which read oddly in English
// ("อีกฝ่าย's answer"), so that and an empty name both show the default in
// the current language.
export function partnerLabel(name, t) {
  const n = String(name ?? '').trim();
  return !n || n === 'อีกฝ่าย' ? t('answer.partnerDefault') : n;
}
