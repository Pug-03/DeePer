import { useRef, useEffect } from 'react';
import { IcCheck } from './icons.jsx';
import { useI18n } from '../store/i18n.jsx';

// OTP box row with idle/error/success states. Fully controlled: `value` is
// an array of chars, `onChange(index, digit)` updates one box. Pass a
// changing `key` from the parent (e.g. bump a counter on resend, or on an
// error auto-clear) to force a remount that re-focuses the first box and
// clears input. `statusText` renders under the boxes with a state dot,
// e.g. a hint while idle, the server's error message on 'error', or a
// success line on 'success'.
// `statusError` keeps statusText red after an error has played out and the
// boxes are back to idle, so the message stays readable until they type.
// A pasted (or phone-autofilled) code fills every box at once through
// `onFill(digits)`; without it, each box goes through `onChange` in turn.
export default function OtpInput({
  value,
  onChange,
  onFill,
  autoFocus = true,
  status = 'idle',
  statusText,
  statusError = false,
}) {
  const { t } = useI18n();
  const refs = useRef([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  // Spreads several digits over the boxes from box `from` on.
  const fill = (from, digits) => {
    const next = value.map((d, i) => (i >= from && digits[i - from] ? digits[i - from] : d));
    if (onFill) onFill(next);
    else next.forEach((d, i) => d !== value[i] && onChange(i, d));
    refs.current[Math.min(from + digits.length, value.length - 1)]?.focus();
  };

  const handleChange = (i, raw) => {
    const digits = raw.replace(/\D/g, '');
    // Two digits is typing over a filled box; more is an autofilled code.
    if (digits.length > 2) return fill(i, digits);
    const digit = digits.slice(-1);
    onChange(i, digit);
    if (digit && i < value.length - 1) refs.current[i + 1]?.focus();
  };

  const handlePaste = (i, e) => {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '');
    if (!digits) return;
    e.preventDefault();
    fill(i, digits);
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
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              aria-label={t('otp.digit', { n: i + 1, total: value.length })}
              value={d}
              disabled={status !== 'idle'}
              style={{ transitionDelay: status === 'success' ? `${i * 70}ms` : '0ms' }}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={(e) => handlePaste(i, e)}
              onFocus={(e) => e.target.select()}
            />
            <span className="otp-box-check" style={{ transitionDelay: status === 'success' ? `${i * 70}ms` : '0ms' }}>
              <IcCheck size={20} />
            </span>
          </div>
        ))}
      </div>
      {statusText && (
        <p
          className={`otp-status${
            status !== 'idle' ? ` otp-status--${status}` : statusError ? ' otp-status--error' : ''
          }`}
        >
          <span className="otp-status-dot" />
          {statusText}
        </p>
      )}
    </div>
  );
}
