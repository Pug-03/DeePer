const CAT_LABEL = { couple: 'คู่รัก', friends: 'เพื่อน ๆ', family: 'ครอบครัว' };

export function catLabel(c) {
  return CAT_LABEL[c] || c;
}

// SQLite stores "YYYY-MM-DD HH:MM:SS" in UTC.
export function formatDate(s) {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  if (isNaN(d)) return s;
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `วันนี้ ${time}`;
  return (
    d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ` ${time}`
  );
}
