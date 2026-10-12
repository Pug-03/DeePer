import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

// The box itself wipes in from its top edge down (a CSS animation on
// .award-contact.is-open — see styles.css), and only once it's fully open
// do the title and rows rise in one after another, instead of an empty
// frame sitting there while its contents arrive.
const BOX_OPEN_SECONDS = 0.8;
const boxVariants = {
  hidden: {},
  visible: { transition: { delayChildren: BOX_OPEN_SECONDS, staggerChildren: 0.16 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
};

export function ContactReveal({ title, children, ready = true }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const open = ready && inView;

  // inView is watched on an unclipped wrapper: a fully clipped box counts
  // as not visible to IntersectionObserver, so it would never open.
  return (
    <div ref={ref} className="award-contact-wrap">
      <motion.div
        className={`award-contact${open ? ' is-open' : ''}`}
        initial="hidden"
        animate={open ? 'visible' : 'hidden'}
        variants={boxVariants}
      >
        <motion.p className="eyebrow" variants={itemVariants}>{title}</motion.p>
        {children}
      </motion.div>
    </div>
  );
}

export function ContactLink({ children, ...props }) {
  return (
    <motion.a className="link award-contact-row" variants={itemVariants} {...props}>
      {children}
    </motion.a>
  );
}
