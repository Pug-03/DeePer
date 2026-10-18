import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { COUNTDOWN_UNITS } from '../launch.js';

// Digit columns for the launch countdown. Leading units that have run out
// are dropped (no "00 days" once under a day, no hours under an hour…) and
// the columns that remain get bigger — the last minute is one big seconds
// number. Each digit sits in its own slot and rolls when it changes, like a
// counter: the old digit sinks out below as the new one comes down from
// above, both through a soft blur so the change glides rather than snaps.
// Digits that didn't change stay put.
const ROLL = {
  initial: { y: '-55%', opacity: 0, filter: 'blur(10px)' },
  animate: { y: 0, opacity: 1, filter: 'blur(0px)' },
  exit: { y: '55%', opacity: 0, filter: 'blur(10px)' },
  transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
};
export default function Countdown({ remaining, t, className = '' }) {
  const reduced = useReducedMotion();
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
                <span className="cd-slot" key={text.length - i}>
                  <AnimatePresence initial={false} mode="popLayout">
                    <motion.span
                      className="cd-digit"
                      key={d}
                      initial={ROLL.initial}
                      animate={ROLL.animate}
                      exit={ROLL.exit}
                      transition={reduced ? { duration: 0 } : ROLL.transition}
                    >
                      {d}
                    </motion.span>
                  </AnimatePresence>
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
