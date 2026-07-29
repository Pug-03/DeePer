export function pwScore(pw) {
  const rules = {
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    digit: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
  const passed = [rules.upper, rules.lower, rules.digit, rules.special].filter(Boolean).length;
  const score = passed;
  const valid = rules.upper && rules.lower && rules.digit && rules.special;
  return { rules, score, valid };
}
