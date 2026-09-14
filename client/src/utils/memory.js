// Shared by the "on this day"-style memory notification (see Home.jsx,
// which shows it once a day on app entry) — kept independent of any one
// page since where it's surfaced has already moved once.

// SQLite stores "YYYY-MM-DD HH:MM:SS" in UTC — same parsing convention as
// formatDate in util.js.
const daysSince = (createdAt) => (Date.now() - new Date(createdAt.replace(' ', 'T') + 'Z')) / 86400000;

const dayOfYear = (d) => Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);

// Picks one past history entry to resurface: prefer whichever lands
// closest to exactly a year/month/week ago (within a tolerance), falling
// back to any entry at least a week old. The fallback picks by
// day-of-year modulo the candidate count rather than Math.random(), so it
// stays the same across repeat calls within a day instead of jumping
// around on every check.
export function pickMemory(items) {
  if (!items.length) return null;
  const withAge = items.map((it) => ({ it, days: daysSince(it.created_at) }));

  const closestNear = (targetDays, tolerance) =>
    withAge
      .filter(({ days }) => Math.abs(days - targetDays) <= tolerance)
      .sort((a, b) => Math.abs(a.days - targetDays) - Math.abs(b.days - targetDays))[0]?.it;

  const nearAnniversary = closestNear(365, 5) || closestNear(30, 4) || closestNear(7, 2);
  if (nearAnniversary) return nearAnniversary;

  const old = withAge.filter(({ days }) => days >= 7).map(({ it }) => it);
  if (!old.length) return null;
  return old[dayOfYear(new Date()) % old.length];
}

export function memoryRelativeLabel(t, createdAt) {
  const days = daysSince(createdAt);
  const years = Math.round(days / 365);
  if (years >= 1 && Math.abs(days - years * 365) <= 5) {
    return t(years === 1 ? 'history.memoryYearAgo' : 'history.memoryYearsAgo', { n: years });
  }
  const months = Math.round(days / 30);
  if (months >= 1 && Math.abs(days - months * 30) <= 4) {
    return t(months === 1 ? 'history.memoryMonthAgo' : 'history.memoryMonthsAgo', { n: months });
  }
  const wholeDays = Math.round(days);
  return t(wholeDays === 1 ? 'history.memoryDayAgo' : 'history.memoryDaysAgo', { n: wholeDays });
}
