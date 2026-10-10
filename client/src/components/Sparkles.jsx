import { useReducedMotion } from 'framer-motion';
import { IcSparkle } from './icons.jsx';

// Small twinkling star accents — originally built for the landing page's
// "20+" stat number, pulled out here so any page can anchor the same
// twinkle to its own element instead of re-implementing it. The parent
// needs `position: relative` (see .sparkle-anchor in styles.css) since each
// point is positioned absolutely against it via top/right/bottom/left.
export default function Sparkles({ points }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;
  // A CSS animation (sparkleTwinkle in styles.css), not framer-motion: it
  // only touches opacity and transform, so the browser runs it off the main
  // thread, and it costs nothing while scrolled off screen. Driven from JS
  // it rewrote each star's style every frame, the whole time the page was
  // open, which ate into scrolling smoothness.
  return (
    <>
      {points.map((pos, i) => (
        <span
          key={i}
          className="sparkle"
          style={{ top: pos.top, right: pos.right, bottom: pos.bottom, left: pos.left, animationDelay: `${pos.delay || 0}s` }}
        >
          <IcSparkle size={pos.size} />
        </span>
      ))}
    </>
  );
}
