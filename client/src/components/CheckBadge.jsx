import { motion } from 'framer-motion';

// Animated success mark — the ring draws itself, then the check strokes in —
// followed by a rise-in helper for the content under it. Shared by the
// post-login welcome and the report-sent screen so both read the same.
const EASE = [0.16, 1, 0.3, 1];
const CIRCLE_DURATION = 0.9;
const CHECK_DELAY = 0.75;
const CHECK_DURATION = 0.5;

export default function CheckBadge() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="glass glass--red"
      style={{
        width: 128,
        height: 128,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        margin: '0 auto 24px',
        color: 'var(--red-bright)',
      }}
    >
      <svg width={92} height={92} viewBox="0 0 84 84" fill="none">
        <motion.circle
          cx="42"
          cy="42"
          r="34"
          stroke="currentColor"
          strokeWidth={4}
          strokeLinecap="round"
          transform="rotate(-90 42 42)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: CIRCLE_DURATION, ease: 'easeInOut' }}
        />
        {/* checkmark strokes bottom-vertex last, reading as a rise from bottom to top */}
        <motion.path
          d="M25 44 37 56 60 27"
          stroke="currentColor"
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: CHECK_DURATION, delay: CHECK_DELAY, ease: 'easeInOut' }}
        />
      </svg>
    </motion.div>
  );
}

export const rise = (delay) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: EASE },
  // A no-op onUpdate forces this off Framer's hardware-accelerated (WAAPI)
  // animation path onto its main-thread one — WAAPI hands off to a plain
  // inline style right as a delayed opacity+transform tween completes, and
  // that handoff drops one frame back to the pre-animation value, flashing.
  onUpdate: () => {},
});
