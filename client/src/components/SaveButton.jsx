import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IcCheck } from './icons.jsx';

// "Saved" confirmation shown on the button itself for a moment, instead of
// a toast. `flash()` after a successful save; `done` is true while it shows.
export function useSavedFlash(ms = 1600) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return undefined;
    const id = setTimeout(() => setDone(false), ms);
    return () => clearTimeout(id);
  }, [done, ms]);
  const flash = useCallback(() => setDone(true), []);
  return { done, flash };
}

// Save button for forms that stay on screen after saving: its label swaps
// between idle, busy and a ticked "saved" (from useSavedFlash).
export default function SaveButton({ busy, done, label, busyLabel, doneLabel, disabled, className = 'btn btn--primary', ...rest }) {
  return (
    <button className={className} disabled={busy || (disabled && !done)} {...rest}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={done ? 'done' : busy ? 'busy' : 'idle'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
        >
          {done ? (
            <>
              <IcCheck size={18} /> {doneLabel}
            </>
          ) : busy ? (
            busyLabel
          ) : (
            label
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
