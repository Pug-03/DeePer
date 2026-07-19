import { useRef, useEffect } from 'react';

// 4-digit OTP box row. Fully controlled: `value` is an array of 4 chars,
// `onChange(index, digit)` updates one box. Pass a changing `key` from the
// parent (e.g. bump a counter on resend) to force a remount that re-focuses
// the first box and clears input.
export default function OtpInput({ value, onChange, autoFocus = true }) {
  const refs = useRef([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const handleChange = (i, raw) => {
    const digit = raw.replace(/\D/g, '').slice(-1);
    onChange(i, digit);
    if (digit && i < value.length - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) refs.current[i - 1]?.focus();
  };

  return (
    <div className="otp-row">
      {value.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className="otp-box"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
        />
      ))}
    </div>
  );
}
