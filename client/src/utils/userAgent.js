// Small, dependency-free User-Agent summarizer — just enough to turn a raw
// UA string into something like "Chrome · Windows" for the login history
// list. Order matters within each list (checked top to bottom): e.g. Edge
// and OPR also contain "Chrome" in their UA, and iPad/iPhone must be
// checked before the generic "Mac OS X" that iOS UAs also contain.
const BROWSERS = [
  ['Edg', 'Edge'],
  ['OPR', 'Opera'],
  ['SamsungBrowser', 'Samsung Internet'],
  ['Firefox', 'Firefox'],
  ['Chrome', 'Chrome'],
  ['CriOS', 'Chrome'],
  ['FxiOS', 'Firefox'],
  ['Safari', 'Safari'],
];

const OS_LIST = [
  ['iPhone', 'iOS'],
  ['iPad', 'iPadOS'],
  ['Android', 'Android'],
  ['Windows', 'Windows'],
  ['Mac OS X', 'macOS'],
  ['CrOS', 'ChromeOS'],
  ['Linux', 'Linux'],
];

export function describeUserAgent(ua) {
  if (!ua) return null;
  const browser = BROWSERS.find(([needle]) => ua.includes(needle))?.[1];
  const os = OS_LIST.find(([needle]) => ua.includes(needle))?.[1];
  if (browser && os) return `${browser} · ${os}`;
  return browser || os || null;
}
