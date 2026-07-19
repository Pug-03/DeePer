export function pwScore(pw) {
  const rules = {
    len: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    digit: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
  const passed = [rules.upper, rules.lower, rules.digit, rules.special].filter(Boolean).length;
  const score = rules.len ? passed : Math.max(0, passed - 1);
  const valid = rules.len && rules.upper && rules.lower && rules.digit && rules.special;
  return { rules, score, valid };
}
