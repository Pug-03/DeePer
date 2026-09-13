import { translate } from './i18n.js';
import { currentLang } from './store/i18n.jsx';

export const CATS = ['couple', 'friends', 'family'];

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
