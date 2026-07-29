import { useRef, useEffect } from 'react';
import { IcCheck } from './icons.jsx';

// OTP box row with idle/error/success states. Fully controlled: `value` is
// an array of chars, `onChange(index, digit)` updates one box. Pass a
// changing `key` from the parent (e.g. bump a counter on resend, or on an
// error auto-clear) to force a remount that re-focuses the first box and
// clears input. `statusText` renders under the boxes with a state dot,
// e.g. a hint while idle, the server's error message on 'error', or a
// success line on 'success'.
export default function OtpInput({ value, onChange, autoFocus = true, status = 'idle', statusText }) {
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

  const rowClass = ['otp-row', status !== 'idle' && `otp-row--${status}`].filter(Boolean).join(' ');

  return (
    <div>
      <div className={rowClass}>
        {value.map((d, i) => (
          <div className="otp-box-wrap" key={i}>
            <input
              ref={(el) => (refs.current[i] = el)}
              className="otp-box"
              inputMode="numeric"
              maxLength={1}
              value={d}
              disabled={status !== 'idle'}
              style={{ transitionDelay: status !== 'idle' ? `${i * 180}ms` : '0ms' }}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
            />
            <span className="otp-box-check" style={{ transitionDelay: status === 'success' ? `${i * 180}ms` : '0ms' }}>
              <IcCheck size={20} />
            </span>
          </div>
        ))}
      </div>
      {statusText && (
        <p className={`otp-status${status !== 'idle' ? ` otp-status--${status}` : ''}`}>
          <span className="otp-status-dot" />
          {statusText}
        </p>
      )}
    </div>
  );
}
