import { COUNTDOWN_UNITS } from '../launch.js';

// Four digit columns (days / hours / min / sec) for the launch countdown.
export default function Countdown({ remaining, t, className = '' }) {
  return (
    <div className={`countdown ${className}`.trim()} role="timer" aria-live="off">
      {COUNTDOWN_UNITS.map((unit) => (
        <div className="countdown-cell" key={unit}>
          <span className="countdown-num">{String(remaining[unit]).padStart(2, '0')}</span>
          <span className="countdown-unit">{t(`welcome.launch.${unit}`)}</span>
        </div>
      ))}
    </div>
  );
}
