// Sends errors that happen in the visitor's browser to the server (shown in
// the admin dashboard's Errors tab), so bugs nobody bothers to report still
// get seen. Best effort and quiet: a few per page load at most, each
// message once, and noise from browser extensions or other sites' scripts
// is skipped.
const MAX_PER_LOAD = 10;
const seen = new Set();

// Errors we can't do anything about.
const IGNORE = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i, // a cross-origin script, details hidden by the browser
  /Load failed|Failed to fetch|NetworkError/i, // the visitor's connection
];

function send(message, stack) {
  const msg = String(message || '').trim();
  if (!msg || IGNORE.some((re) => re.test(msg))) return;
  if (seen.has(msg) || seen.size >= MAX_PER_LOAD) return;
  seen.add(msg);
  const body = JSON.stringify({ message: msg, stack: String(stack || ''), url: location.pathname });
  try {
    fetch('/api/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* never let reporting an error cause another one */
  }
}

export function installErrorReporter() {
  if (import.meta.env.DEV) return;
  window.addEventListener('error', (e) => {
    // Scripts from other origins (extensions, embeds) aren't ours to fix.
    if (e.filename && !e.filename.startsWith(location.origin)) return;
    send(e.message, e.error?.stack);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    // A bare `reject()` has no reason at all; say so instead of "undefined".
    const message = r?.message || (r === undefined ? 'Promise rejected with no reason' : String(r));
    send(message, r?.stack);
  });
}
