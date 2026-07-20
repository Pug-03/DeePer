import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../store/i18n.jsx';
import { IcBack, IcBookmark, IcCheck, IcHome, IcHistory, IcUser, IcX } from './icons.jsx';

const STEPS = ['add', 'cats', 'deck', 'actions', 'nav'];
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
const STEP_RADIUS = { add: 22, cats: 999, deck: 30, actions: 999, nav: 24 };

function clamp(v, lo, hi) {
  return Math.min(Math.max(v, lo), hi);
}

function useTargetRect(selector) {
  const [rect, setRect] = useState(null);

  useEffect(() => {
    const target = document.querySelector(selector);
    target?.scrollIntoView({ block: 'center', behavior: 'instant' });

    const measure = () => {
      const el = document.querySelector(selector);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    const id = requestAnimationFrame(measure);
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

export default function HomeTutorial({ onDone }) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [closing, setClosing] = useState(false);
  const id = STEPS[step];
  const rect = useTargetRect(`[data-tut="${id}"]`);
  const isLast = step === STEPS.length - 1;
  const tipRef = useRef(null);
  const [tipH, setTipH] = useState(150);

  useLayoutEffect(() => {
    if (tipRef.current) setTipH(tipRef.current.offsetHeight);
  }, [id, rect]);

  useEffect(() => {
    const onResize = () => tipRef.current && setTipH(tipRef.current.offsetHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
              ref={tipRef}
              className="tut-tip glass glass--red"
              initial={{ opacity: 0, y: 16, top: tipTop }}
              animate={{ opacity: 1, y: 0, top: tipTop }}
              transition={TIP_TRANSITION}
              style={{ left: '50%', x: '-50%' }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={TIP_CONTENT_TRANSITION}
                >
                  <p className="tut-tip-title">{t(`tut.${id}Title`)}</p>
                  <p className="tut-tip-desc">{t(`tut.${id}Desc`)}</p>
                  {id === 'actions' && (
                    <div className="tut-icon-row">
                      <span>
                        <IcX size={16} /> {t('home.aSkip')}
                      </span>
                      <span>
                        <IcBookmark size={16} /> {t('home.aSave')}
                      </span>
                      <span>
                        <IcCheck size={16} /> {t('home.aAnswer')}
                      </span>
                    </div>
                  )}
                  {id === 'nav' && (
                    <div className="tut-icon-row">
                      <span>
                        <IcHome size={16} /> {t('nav.home')}
                      </span>
                      <span>
                        <IcBookmark size={16} /> {t('nav.saved')}
                      </span>
                      <span>
                        <IcHistory size={16} /> {t('nav.history')}
                      </span>
                      <span>
                        <IcUser size={16} /> {t('nav.profile')}
                      </span>
                    </div>
                  )}
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
                          onClick={back}
                          aria-label={t('common.back')}
                        >
                          <IcBack size={18} />
                        </button>
                      )}
                      <button className="btn btn--primary btn--sm" onClick={next}>
                        {isLast ? t('tut.done') : t('tut.next')}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
