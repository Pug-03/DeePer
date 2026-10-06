import { COUNTDOWN_UNITS } from '../launch.js';

// Digit columns for the launch countdown. Leading units that have run out
// are dropped (no "00 days" once under a day, no hours under an hour…) and
// the columns that remain get bigger — the last minute is one big seconds
// number. Each digit is keyed by its value, so only the digit that just
// changed remounts and plays its little drop-in tick (see .cd-digit).
export default function Countdown({ remaining, t, className = '' }) {
  const first = COUNTDOWN_UNITS.findIndex((u) => remaining[u] > 0);
  const units = COUNTDOWN_UNITS.slice(first === -1 ? COUNTDOWN_UNITS.length - 1 : first);
  return (
    <div className={`countdown countdown--n${units.length} ${className}`.trim()} role="timer" aria-live="off">
      {units.map((unit, idx) => {
        // The leading column shows its plain number ("9", not "09").
        const text = idx === 0 ? String(remaining[unit]) : String(remaining[unit]).padStart(2, '0');
        return (
          <div className="countdown-cell" key={unit}>
            <span className="countdown-num">
              {[...text].map((d, i) => (
                <span className="cd-digit" key={`${text.length - i}-${d}`}>
                  {d}
                </span>
              ))}
            </span>
            <span className="countdown-unit">{t(`welcome.launch.${unit}`)}</span>
          </div>
        );
      })}
    </div>
  );
}
