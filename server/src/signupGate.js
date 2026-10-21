// Before launch, signing up needs an invite code; from launch on anyone can
// sign up, with no deploy needed to flip it. Logging in to an existing
// account is never gated.
//
// - SIGNUP_OPENS_AT: when signups open to everyone. Defaults to the launch,
//   11/11/2569 11:11 Bangkok time (same instant as client/src/launch.js).
// - INVITE_CODE: the 6-digit code testers type before then (typed into six
//   OTP-style boxes on the signup page). Left unset, nobody can sign up
//   before launch.
//
// Both are read on every request, so changing them in the host's settings
// takes effect without touching the code.
const LAUNCH = '2026-11-11T11:11:00+07:00';

export function signupOpensAt() {
  return Date.parse(process.env.SIGNUP_OPENS_AT || LAUNCH);
}

export function inviteRequired() {
  return Date.now() < signupOpensAt();
}

const normalise = (code) => String(code ?? '').trim().toLowerCase();

// Wrong invite codes, counted per visitor (IP): the 4th wrong try in a row
// locks them out for 30 seconds, the 6th for 15 minutes. A right code
// clears the count; so does 15 minutes without a wrong try. Kept in memory
// — a restart forgets it, which is fine for a brake on guessing.
const SHORT_LOCK_AT = 4;
const SHORT_LOCK_MS = 30 * 1000;
const LONG_LOCK_AT = 6;
const LONG_LOCK_MS = 15 * 60 * 1000;
const attempts = new Map(); // ip -> { fails, lockedUntil, lastFail }

function lockedFor(ip, now) {
  const a = attempts.get(ip);
  if (!a) return 0;
  if (now - a.lastFail > LONG_LOCK_MS && now >= a.lockedUntil) {
    attempts.delete(ip);
    return 0;
  }
  return Math.max(0, a.lockedUntil - now);
}

// Entries are otherwise only dropped when the same IP comes back, so
// sweep stale ones once the map gets big.
function sweep(now) {
  if (attempts.size < 1000) return;
  for (const [ip, a] of attempts) if (now - a.lastFail > LONG_LOCK_MS && now >= a.lockedUntil) attempts.delete(ip);
}

function recordFail(ip, now) {
  sweep(now);
  const a = attempts.get(ip) || { fails: 0, lockedUntil: 0, lastFail: 0 };
  a.fails += 1;
  a.lastFail = now;
  if (a.fails >= LONG_LOCK_AT) a.lockedUntil = now + LONG_LOCK_MS;
  else if (a.fails === SHORT_LOCK_AT) a.lockedUntil = now + SHORT_LOCK_MS;
  attempts.set(ip, a);
  return Math.max(0, a.lockedUntil - now);
}

const lockedError = (ms) => {
  const seconds = Math.ceil(ms / 1000);
  return {
    status: 429,
    body: {
      error: `ใส่รหัสเชิญผิดหลายครั้ง ลองใหม่ได้ในอีก ${seconds} วินาที`,
      error_code: 'INVITE_LOCKED',
      retry_after: seconds,
    },
  };
};

// null when this signup may go ahead, otherwise { status, body } to send
// back. `ip` is the visitor's address (req.ip), for the wrong-code count.
export function signupGateError(inviteCode, ip = '') {
  if (!inviteRequired()) return null;
  const now = Date.now();
  const wait = lockedFor(ip, now);
  if (wait) return lockedError(wait);
  const expected = normalise(process.env.INVITE_CODE);
  const given = normalise(inviteCode);
  if (!given) return { status: 403, body: { error: 'ยังไม่เปิดรับสมัคร ต้องมีรหัสเชิญ', error_code: 'INVITE_REQUIRED' } };
  if (expected && given === expected) {
    attempts.delete(ip);
    return null;
  }
  const locked = recordFail(ip, now);
  if (locked) return lockedError(locked);
  // Wrong tries left before the next lock (30 s, then 15 min).
  const { fails } = attempts.get(ip);
  const triesLeft = fails < SHORT_LOCK_AT ? SHORT_LOCK_AT - fails : LONG_LOCK_AT - fails;
  return {
    status: 403,
    body: { error: 'รหัสเชิญไม่ถูกต้อง', error_code: 'INVITE_INVALID', tries_left: triesLeft },
  };
}

// Tests only: forget every wrong-code count.
export function resetInviteAttempts() {
  attempts.clear();
}
