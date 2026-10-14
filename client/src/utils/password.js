// Same rules as the server (validatePassword in server/src/auth.js).
export const PW_MIN_LENGTH = 8;

export function pwScore(pw) {
  const rules = {
    length: pw.length >= PW_MIN_LENGTH,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    digit: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
  const valid = Object.values(rules).every(Boolean);
  // The meter has four segments: full only once every rule passes.
  const passed = Object.values(rules).filter(Boolean).length;
  const score = valid ? 4 : Math.min(3, passed);
  return { rules, score, valid };
}
