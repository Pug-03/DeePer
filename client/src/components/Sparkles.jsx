import { motion, useReducedMotion } from 'framer-motion';
import { IcSparkle } from './icons.jsx';

// Small twinkling star accents — originally built for the landing page's
// "20+" stat number, pulled out here so any page can anchor the same
// twinkle to its own element instead of re-implementing it. The parent
// needs `position: relative` (see .sparkle-anchor in styles.css) since each
// point is positioned absolutely against it via top/right/bottom/left.
export default function Sparkles({ points }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;
  return (
    <>
      {points.map((pos, i) => (
        <motion.span
          key={i}
          className="sparkle"
          style={{ top: pos.top, right: pos.right, bottom: pos.bottom, left: pos.left }}
          initial={{ opacity: 0, scale: 0.5, rotate: 0 }}
          animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5], rotate: [0, 20, 0] }}
          transition={{
            duration: 2.6,
            delay: pos.delay,
            repeat: Infinity,
            repeatDelay: 1.4,
            ease: 'easeInOut',
          }}
        >
          <IcSparkle size={pos.size} />
        </motion.span>
      ))}
    </>
  );
}
