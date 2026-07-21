import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../store/i18n.jsx';
import { IcBack } from './icons.jsx';

const STEPS = [
  'add',
  'cats',
  'deck',
  'actionSkip',
  'actionSave',
  'actionAnswer',
  'navHome',
  'navSaved',
  'navHistory',
  'navProfile',
];
const PAD = 10;
const GAP = 16;
const EDGE = 16;
const EASE = [0.16, 1, 0.3, 1];
const SPOT_TRANSITION = { duration: 0.6, ease: EASE };
const TIP_TRANSITION = { duration: 0.5, ease: EASE };
const TIP_CONTENT_TRANSITION = { duration: 0.18, ease: EASE };
// Matches each target's own corner rounding (.btn, .pill, .qcard, .bottom-nav)
// so the highlight frame hugs the real shape instead of a generic rounded box.
// Single controls (add, deck) use their exact real radius; rows of separate
// round buttons (cats, actions) read best as a full pill wrap around them.
const STEP_RADIUS = {
  add: 22,
  cats: 999,
  deck: 30,
  actionSkip: 999,
  actionSave: 999,
  actionAnswer: 999,
  navHome: 16,
  navSaved: 16,
  navHistory: 16,
  navProfile: 16,
};
const HIDDEN_STYLE = { position: 'fixed', top: -9999, left: 0, visibility: 'hidden', pointerEvents: 'none' };
// Steps that read as one connected set (the three action buttons, the four
// bottom-nav tabs) share a single tip height/position — using each step's own
// exact height would make the box visibly grow/shrink/jump as you hit Next.
const STEP_GROUP = {
  actionSkip: 'actions',
  actionSave: 'actions',
  actionAnswer: 'actions',
  navHome: 'nav',
  navSaved: 'nav',
  navHistory: 'nav',
  navProfile: 'nav',
};

function clamp(v, lo, hi) {
  return Math.min(Math.max(v, lo), hi);
}

function useTargetRect(selector) {
  const [rect, setRect] = useState(null);

  useEffect(() => {
    const target = document.querySelector(selector);
    target?.scrollIntoView({ block: 'center', behavior: 'instant' });

    const sameRect = (a, b) =>
      a && b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;

    let id;
    let prev = null;
    let stableFrames = 0;
    const start = performance.now();

    const measure = () => {
      const el = document.querySelector(selector);
      const next = el ? el.getBoundingClientRect() : null;
      setRect(next);

      // A target can still be mid-entrance-animation (e.g. the home page's
      // stagger-in) when this first runs — keep re-measuring every frame
      // until its position holds still, instead of freezing the spotlight
      // at a stale, still-animating position. Time-capped as a safety net.
      stableFrames = sameRect(prev, next) ? stableFrames + 1 : 0;
      prev = next;
      if (stableFrames < 4 && performance.now() - start < 1500) {
        id = requestAnimationFrame(measure);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [selector]);

  return rect;
}

// Measures every step's tooltip height up front (off-screen, same markup/width
// as the real tip) so positioning never has to guess using a stale height from
// whichever step came before — that's what let the tip land on top of the
// spotlight ring on steps with a taller tip.
function useStepHeights(t) {
  const refs = useRef({});
  const [heights, setHeights] = useState({});

  useLayoutEffect(() => {
    const measure = () => {
      const next = {};
      STEPS.forEach((s) => {
        if (refs.current[s]) next[s] = refs.current[s].offsetHeight;
      });
      const groupMax = {};
      STEPS.forEach((s) => {
        const g = STEP_GROUP[s];
        if (g && next[s] != null) groupMax[g] = Math.max(groupMax[g] ?? 0, next[s]);
      });
      STEPS.forEach((s) => {
        const g = STEP_GROUP[s];
        if (g) next[s] = groupMax[g];
      });
      setHeights(next);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [t]);

  return { heights, refs };
}

function TipBody({ id, step, isLast, t, onBack, onNext }) {
  return (
    <>
      <p className="tut-tip-title">{t(`tut.${id}Title`)}</p>
      <p className="tut-tip-desc">{t(`tut.${id}Desc`)}</p>
      <div className="tut-tip-foot">
        <div className="tut-dots">
          {STEPS.map((s, i) => (
            <span key={s} className={i === step ? 'on' : ''} />
          ))}
        </div>
        <div className="tut-actions">
          {step > 0 && (
            <button
              type="button"
              className="btn btn--ghost btn--sm tut-back-btn"
              onClick={onBack}
              aria-label={t('common.back')}
            >
              <IcBack size={18} />
            </button>
          )}
          <button className="btn btn--primary btn--sm" onClick={onNext}>
            {isLast ? t('tut.done') : t('tut.next')}
          </button>
        </div>
      </div>
    </>
  );
}

export default function HomeTutorial({ onDone }) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [closing, setClosing] = useState(false);
  const id = STEPS[step];
  const rect = useTargetRect(`[data-tut="${id}"]`);
  const isLast = step === STEPS.length - 1;
  const { heights, refs: measureRefs } = useStepHeights(t);
  const tipH = heights[id] ?? 150;

  const next = () => (isLast ? setClosing(true) : setStep((s) => s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const baseRadius = STEP_RADIUS[id] ?? 20;
  // Outsetting a rounded rect by PAD flattens its curve unless the radius
  // grows by the same amount — so the frame keeps the target's true shape
  // instead of looking like a plain rounded box once padded out.
  const spotRadius = baseRadius >= 500 ? baseRadius : baseRadius + PAD;

  const spot = rect && {
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  };

  let tipTop = null;
  if (spot) {
    const below = spot.top + spot.height + GAP;
    const above = spot.top - GAP - tipH;
    const fitsBelow = below + tipH + EDGE <= window.innerHeight;
    tipTop = clamp(fitsBelow ? below : above, EDGE, window.innerHeight - tipH - EDGE);
  }

  return (
    <AnimatePresence onExitComplete={onDone}>
      {!closing && (
        <motion.div
          className="tut-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
        >
          <div aria-hidden="true">
            {STEPS.map((s, i) => (
              <div
                key={s}
                ref={(el) => {
                  measureRefs.current[s] = el;
                }}
                className="tut-tip glass glass--red"
                style={HIDDEN_STYLE}
              >
                <TipBody
                  id={s}
                  step={i}
                  isLast={i === STEPS.length - 1}
                  t={t}
                  onBack={() => {}}
                  onNext={() => {}}
                />
              </div>
            ))}
          </div>

          {spot && (
            <motion.div
              className="tut-spot"
              initial={{
                opacity: 0,
                scale: 0.94,
                top: spot.top,
                left: spot.left,
                width: spot.width,
                height: spot.height,
                borderRadius: spotRadius,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                top: spot.top,
                left: spot.left,
                width: spot.width,
                height: spot.height,
                borderRadius: spotRadius,
              }}
              transition={SPOT_TRANSITION}
            />
          )}

          {spot && (
            <motion.div
              className="tut-tip glass glass--red"
              initial={{ opacity: 0, y: 16, top: tipTop }}
              animate={{ opacity: 1, y: 0, top: tipTop }}
              transition={TIP_TRANSITION}
              style={{ left: '50%', x: '-50%', height: tipH }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={id}
                  className="tut-tip-inner"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={TIP_CONTENT_TRANSITION}
                >
                  <TipBody id={id} step={step} isLast={isLast} t={t} onBack={back} onNext={next} />
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
