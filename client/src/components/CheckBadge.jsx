import { motion } from 'framer-motion';

// Animated success mark — the ring draws itself, then the check strokes in —
// followed by a rise-in helper for the content under it. Shared by the
// post-login welcome and the report-sent screen so both read the same.
// `size` shrinks it for tighter spots (the added-question dialog on Home)
// while keeping the same drawing and timing.
const EASE = [0.16, 1, 0.3, 1];
const CIRCLE_DURATION = 0.9;
const CHECK_DELAY = 0.75;
const CHECK_DURATION = 0.5;

export default function CheckBadge({ size = 128 }) {
  const svgSize = Math.round(size * 0.72);
  // A small badge (inside a dialog) draws quicker, so it's done before a
  // tap — the full-size one keeps the slower, ceremonial pace.
  const quick = size < 128;
  const circle = quick ? 0.5 : CIRCLE_DURATION;
  const checkDelay = quick ? 0.35 : CHECK_DELAY;
  const checkDuration = quick ? 0.3 : CHECK_DURATION;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="glass glass--red"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        margin: `0 auto ${size >= 128 ? 24 : 14}px`,
        color: 'var(--red-bright)',
      }}
    >
      <svg width={svgSize} height={svgSize} viewBox="0 0 84 84" fill="none">
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
          transition={{ duration: circle, ease: 'easeInOut' }}
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
          transition={{ duration: checkDuration, delay: checkDelay, ease: 'easeInOut' }}
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
