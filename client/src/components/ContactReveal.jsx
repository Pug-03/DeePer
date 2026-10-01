import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
};

export function ContactReveal({ title, children, ready = true }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <motion.div
      ref={ref}
      className="award-contact"
      initial="hidden"
      animate={ready && inView ? 'visible' : 'hidden'}
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.16 } } }}
    >
      <motion.p className="eyebrow" variants={itemVariants}>{title}</motion.p>
      {children}
    </motion.div>
  );
}

export function ContactLink({ children, ...props }) {
  return (
    <motion.a className="link award-contact-row" variants={itemVariants} {...props}>
      {children}
    </motion.a>
  );
}
