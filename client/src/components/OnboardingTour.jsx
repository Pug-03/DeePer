import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../store/i18n.jsx';
import { useTutorial } from '../store/tutorial.jsx';
import { IcBack, IcCheck } from './icons.jsx';

// Each step's `route` says which page its target lives on. Steps stay in
// one flat list (not grouped per page) so the progress dots below count
// the whole Home -> Saved -> History tour, not a per-page subset — advancing
// past a step whose next step has a different route is what drives the tab
// switch (see goToStep in OnboardingTour below).
//
// savedItem/historyItem point at a REAL saved/answered entry (see the
// data-tut on the first card in Saved.jsx/History.jsx) — but a brand-new
// user (the tour's main trigger, right after signup) has neither yet.
// `requires` names the TutorialContext flag that must be true (not just
// "not yet known") for the step to be shown; goToStep skips over it
// otherwise instead of pointing at an element that doesn't exist.
const STEPS = [
  { id: 'add', route: '/app/home' },
  { id: 'cats', route: '/app/home' },
  { id: 'deck', route: '/app/home' },
  { id: 'actionSkip', route: '/app/home' },
  { id: 'actionSave', route: '/app/home' },
  { id: 'actionAnswer', route: '/app/home' },
  { id: 'navHome', route: '/app/home' },
  { id: 'navSaved', route: '/app/home' },
  { id: 'savedItem', route: '/app/saved', requires: 'savedHasItems' },
  { id: 'navHistory', route: '/app/saved' },
  { id: 'historyItem', route: '/app/history', requires: 'historyHasItems' },
  { id: 'navProfile', route: '/app/history' },
];
const PAD = 10;
const GAP = 16;
const EDGE = 16;
const EASE = [0.16, 1, 0.3, 1];
const SPOT_TRANSITION = { duration: 0.6, ease: EASE };
const TIP_TRANSITION = { duration: 0.5, ease: EASE };
const TIP_CONTENT_TRANSITION = { duration: 0.18, ease: EASE };
// Matches each target's own corner rounding (.btn, .pill, .qcard, .bottom-nav,
// .card-item) so the highlight frame hugs the real shape instead of a generic
// rounded box. Single controls (add, deck, savedItem, historyItem) use their
// exact real radius; rows of separate round buttons (cats, actions) read best
// as a full pill wrap around them. Anything unlisted falls through to the
// default radius below.
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
  savedItem: 22,
  historyItem: 22,
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

// True once every animation/transition affecting `el`'s position has reached
// its end state. Used instead of comparing consecutive measured rects: on an
// ease-out curve like staggerRise's cubic-bezier(0.16, 1, 0.3, 1), the tail
// moves by a fraction of a pixel per frame, so a few consecutive frames can
// measure as "the same rect" well before the animation has actually finished
// — which was the bug (the spotlight/tip locked onto a not-quite-settled
// position, landing a few px off from the header's true resting spot).
//
// Walks up the ancestor chain rather than just checking `el` itself — the
// page's own .stagger entrance is applied to `.stagger > *` (each direct
// child), but a data-tut target (e.g. "add") can be nested a level or two
// below that direct child (inside a .row-between, say). getAnimations() has
// no "include ancestors" option, so el.getAnimations() alone stayed
// permanently empty for such a target and isSettled() returned true on
// frame 1 (vacuous truth on an empty list) — capturing the rect mid-animation
// on the ancestor and never re-measuring, which read as a stuck-forever
// wrong position rather than a one-frame flash.
function isSettled(el) {
  let node = el;
  while (node instanceof Element) {
    if (typeof node.getAnimations === 'function') {
      const running = node
        .getAnimations()
        .some((a) => a.playState === 'running' || a.playState === 'pending');
      if (running) return false;
    }
    node = node.parentElement;
  }
  return true;
}

function useTargetRect(selector) {
  const [rect, setRect] = useState(null);

  // useLayoutEffect (not useEffect) so the first measurement for a new step
  // lands before the browser paints — otherwise the spotlight briefly paints
  // at the PREVIOUS step's position/size while already shaped for the new
  // one (useEffect runs after paint), a one-frame glitch that's invisible
  // tapping slowly but visibly flashes/jumps when advancing steps quickly —
  // including the moment a step change also navigates to a different tab.
  useLayoutEffect(() => {
    const target = document.querySelector(selector);
    target?.scrollIntoView({ block: 'center', behavior: 'instant' });

    let id;
    // Requires 2 consecutive "settled" frames, not just 1 — playState can
    // flip to 'finished' a frame before the browser actually commits the
    // final paint, so one extra frame guards against grabbing a rect from
    // that in-between moment.
    let settledStreak = 0;
    const start = performance.now();

    const measure = () => {
      const el = document.querySelector(selector);
      if (!el) {
        setRect(null);
        settledStreak = 0;
        // The target's page may still be on its way in (the tour can start
        // on another page and navigate here), so keep looking for a moment.
        if (performance.now() - start < 1500) id = requestAnimationFrame(measure);
        return;
      }

      // Only commit a rect once the target is settled (or the 1500ms safety
      // net expires) — NOT on every intermediate frame. Landing on this step
      // right as the page itself first mounts (e.g. jumping straight into
      // the tour, target still riding its own .stagger entrance animation)
      // used to setRect() on every in-flight frame too, so the spotlight
      // visibly chased the target from its mid-animation position to the
      // final one instead of just appearing there.
      settledStreak = isSettled(el) ? settledStreak + 1 : 0;
      if (settledStreak >= 2 || performance.now() - start >= 1500) {
        setRect(el.getBoundingClientRect());
        return;
      }
      id = requestAnimationFrame(measure);
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
      STEPS.forEach(({ id }) => {
        if (refs.current[id]) next[id] = refs.current[id].offsetHeight;
      });
      const groupMax = {};
      STEPS.forEach(({ id }) => {
        const g = STEP_GROUP[id];
        if (g && next[id] != null) groupMax[g] = Math.max(groupMax[g] ?? 0, next[id]);
      });
      STEPS.forEach(({ id }) => {
        const g = STEP_GROUP[id];
        if (g) next[id] = groupMax[g];
      });
      setHeights(next);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [t]);

  return { heights, refs };
}

function TipBody({ id, step, isLast, t, onBack, onNext, onSkip }) {
  return (
    <>
      <div className="tut-tip-head">
        <p className="tut-tip-title">{t(`tut.${id}Title`)}</p>
        <button type="button" className="tut-skip-btn" onClick={onSkip}>
          {t('tut.skip')}
        </button>
      </div>
      <p className="tut-tip-desc">{t(`tut.${id}Desc`)}</p>
      <div className="tut-tip-foot">
        <div className="tut-dots">
          {STEPS.map(({ id: sid }, i) => (
            <span key={sid} className={i === step ? 'on' : ''} />
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
              <IcBack size={20} />
            </button>
          )}
          <button className="btn btn--primary btn--sm tut-next-btn" onClick={onNext}>
            {isLast && <IcCheck size={18} />}
            {isLast ? t('tut.done') : t('tut.next')}
          </button>
        </div>
      </div>
    </>
  );
}

export default function OnboardingTour() {
  const { t } = useI18n();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const tutorial = useTutorial();
  const step = tutorial.step;
  const [closing, setClosing] = useState(false);
  const lastSpot = useRef(null);
  const id = STEPS[step].id;
  const rect = useTargetRect(`[data-tut="${id}"]`);
  const isLast = step === STEPS.length - 1;
  const { heights, refs: measureRefs } = useStepHeights(t);
  const tipH = heights[id] ?? 150;

  // A step with `requires` is only shown once that flag is positively true
  // (not just "unknown yet") — see the STEPS comment above.
  const isStepAllowed = (s) => !s.requires || tutorial[s.requires] === true;

  // Advancing/going back onto a step whose target lives on a different page
  // is what drives the Home -> Saved -> History handoff — the step change
  // and the navigation land in the same render, so the spotlight animates
  // straight from its old position to the new page's target (see the
  // useLayoutEffect note above) instead of flashing empty in between.
  //
  // `dir` keeps walking past any not-allowed step (savedItem/historyItem
  // with nothing to point at) in the direction the user was already
  // moving, so Back from navHistory lands on navSaved, not on a step
  // that got skipped on the way there.
  const stepRef = useRef(step);
  stepRef.current = step;
  const goToStep = (rawIndex, dir) => {
    let idx = rawIndex;
    while (idx > 0 && idx < STEPS.length - 1 && !isStepAllowed(STEPS[idx])) idx += dir;
    const target = STEPS[idx];
    // Updated right away so a second tap before the re-render builds on
    // this step, not the one before it.
    stepRef.current = idx;
    tutorial.setStep(idx);
    if (target.route !== window.location.pathname) nav(target.route);
  };

  // Read the step from a ref, not this render's closure: while a step's
  // content cross-fades, the outgoing copy's buttons are still on screen
  // with the old handlers, so a quick tap there used to re-open the step
  // you were already on and feel like the button didn't respond.
  const next = () => {
    const cur = stepRef.current;
    if (cur === STEPS.length - 1) setClosing(true);
    else goToStep(cur + 1, 1);
  };
  const back = () => goToStep(Math.max(0, stepRef.current - 1), -1);
  const skip = () => setClosing(true);

  // Safety net beyond the `requires` check above: if a step's target still
  // hasn't been found once useTargetRect's own ~1.5s stabilization window
  // has passed (e.g. the savedHasItems flag was still null — fetch not
  // resolved yet — when this step was reached, and it turns out empty),
  // move on automatically rather than stranding the user on a blank
  // overlay with no reachable Next/Skip button (TipBody only renders once
  // `spot` is truthy).
  useEffect(() => {
    if (rect) return undefined;
    const timer = setTimeout(() => {
      if (isLast) setClosing(true);
      else goToStep(step + 1, 1);
    }, 1700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, rect]);

  const pad = id.startsWith('nav') ? 4 : PAD;
  const baseRadius = STEP_RADIUS[id] ?? 20;
  // Outsetting a rounded rect by PAD flattens its curve unless the radius
  // grows by the same amount — so the frame keeps the target's true shape
  // instead of looking like a plain rounded box once padded out.
  const targetSpot = rect && {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
    borderRadius: baseRadius >= 500 ? baseRadius : baseRadius + pad,
  };
  // Keep the old opening and its corner shape until the next target appears,
  // so the spotlight glides between pages instead of vanishing mid-handoff.
  if (targetSpot) lastSpot.current = targetSpot;
  const spot = targetSpot || lastSpot.current;
  const spotRadius = spot?.borderRadius ?? 20;

  let tipTop = null;
  if (spot) {
    const below = spot.top + spot.height + GAP;
    const above = spot.top - GAP - tipH;
    const fitsBelow = below + tipH + EDGE <= window.innerHeight;
    tipTop = clamp(fitsBelow ? below : above, EDGE, window.innerHeight - tipH - EDGE);
  }

  return (
    // Finishing or skipping the tour lands back on Home — it otherwise ends
    // on whatever page its last step was on (History, Saved, ...).
    <AnimatePresence
      onExitComplete={() => {
        tutorial.stop();
        if (pathname !== '/app/home') nav('/app/home');
      }}
    >
      {!closing && (
        <motion.div
          className="tut-overlay"
          // Appears at full strength: the dim layer inside already starts
          // dark to take over from the confirm dialog's backdrop, and fading
          // the whole overlay in on top of that let the page flash through.
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
        >
          <div aria-hidden="true">
            {STEPS.map(({ id: sid }, i) => (
              <div
                key={sid}
                ref={(el) => {
                  measureRefs.current[sid] = el;
                }}
                className="tut-tip glass glass--red"
                style={HIDDEN_STYLE}
              >
                <TipBody
                  id={sid}
                  step={i}
                  isLast={i === STEPS.length - 1}
                  t={t}
                  onBack={() => {}}
                  onNext={() => {}}
                  onSkip={() => {}}
                />
              </div>
            ))}
          </div>

          {/* Plain dim layer while there's no spotlight yet (tour just
              started, its first page still coming in). Starts fully dark —
              it picks up right where the confirm dialog's own backdrop
              leaves off, so nothing flashes bright in between — then
              crossfades into the spotlight's dim as the hole opens. */}
          <motion.div
            className="tut-dim"
            initial={{ opacity: 1 }}
            animate={{ opacity: spot ? 0 : 1 }}
            transition={{ duration: 0.4, ease: EASE }}
          />

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
                  <TipBody
                    id={id}
                    step={step}
                    isLast={isLast}
                    t={t}
                    onBack={back}
                    onNext={next}
                    onSkip={skip}
                  />
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
