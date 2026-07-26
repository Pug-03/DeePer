import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
  animate,
} from 'framer-motion';
import { api } from '../api.js';
import { useI18n } from '../store/i18n.jsx';
import { useToast } from '../components/ui.jsx';
import { Loading, ErrorState, EmptyState } from '../components/ui.jsx';
import { IcX, IcCheck, IcBookmark, IcPlus, IcCards, IcSparkle, IcChat } from '../components/icons.jsx';
import HomeTutorial from '../components/HomeTutorial.jsx';

const CATS = ['couple', 'friends', 'family'];
const SWIPE_THRESHOLD = 110;
const CARD_SPRING = { type: 'spring', stiffness: 420, damping: 22, mass: 0.9 };
const FLY_EASE = [0.16, 1, 0.3, 1];
// The outgoing card's slide is a spring (bouncy, exact), but its fade should
// feel soft rather than snap to the spring's precision — ease it out on its
// own timing instead of tying opacity to the same physics as the slide.
const CARD_EXIT_TRANSITION = { ...CARD_SPRING, opacity: { duration: 0.32, ease: FLY_EASE } };
// Matches the resting look of the "next" preview card behind the deck
// (see backScale/backY/backOpacity below) so promoting it to the top card
// reads as a continuous rise instead of an instant pop into place.
const REST_BEHIND = { scale: 0.94, y: 14, opacity: 0.6 };
const CARD_REST = { x: '0%', scale: 1, y: 0, opacity: 1 };
const RISE_SPRING = { type: 'spring', stiffness: 380, damping: 28, mass: 0.8 };

// A second tap within this window counts as a double-tap; slow enough for a
// deliberate double-tap, tight enough that two separate taps don't merge.
const DOUBLE_TAP_MS = 300;

function TopCard({ q, onSkip, onAnswer, onSave, onDragProgress, flyRegistry }) {
  const { t } = useI18n();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-14, 14]);
  const noOp = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);
  const yesOp = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);

  // Double-tap-to-save, mirroring the "double-tap to like" gesture from
  // photo/video feeds — here it saves the question instead. onTap (rather
  // than onClick) is framer-motion's tap gesture, so it only fires for a
  // real tap and not at the end of a drag/swipe.
  const [burst, setBurst] = useState(false);
  const lastTap = useRef(0);
  const burstTimer = useRef(null);
  useEffect(() => () => clearTimeout(burstTimer.current), []);
  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      onSave?.();
      setBurst(true);
      clearTimeout(burstTimer.current);
      burstTimer.current = setTimeout(() => setBurst(false), 450);
    } else {
      lastTap.current = now;
    }
  };

  // Mirror this card's live drag offset up to the deck so the card behind it
  // can rise/scale in sync. A fresh TopCard always starts at rest, so reset
  // the mirrored value on mount rather than trusting the outgoing card's
  // in-flight fly-out animation to have finished settling it.
  const flying = useRef(false);
  useLayoutEffect(() => {
    flying.current = false;
    onDragProgress?.(0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useMotionValueEvent(x, 'change', (v) => {
    if (!flying.current) onDragProgress?.(v);
  });

  const fly = (dir) => {
    // The fly-out overshoots well past the swipe threshold, so once a swipe
    // is confirmed, snap the card behind straight to its fully-risen look
    // and stop following x — otherwise it sits fully grown while this card
    // finishes flying off, then (once this card unmounts) the promoted card
    // would restart its rise from scratch, reading as a double-bounce.
    flying.current = true;
    onDragProgress?.(SWIPE_THRESHOLD);
    if (dir === 'skip') {
      animate(y, 600, { duration: 0.36, ease: FLY_EASE });
      animate(x, -80, { duration: 0.36, ease: FLY_EASE });
      setTimeout(onSkip, 240);
    } else {
      animate(x, 520, { duration: 0.36, ease: FLY_EASE });
      animate(y, -20, { duration: 0.36, ease: FLY_EASE });
      setTimeout(onAnswer, 240);
    }
  };

  // Lets the parent's action buttons (and keyboard shortcuts) trigger the
  // same fly animation as a swipe. Re-registers every render so it's always
  // this card's latest fly closure — guarded by q.id so a still-exiting
  // card's delayed cleanup can never clobber a newer card's registration
  // (AnimatePresence keeps the outgoing card mounted for its exit animation,
  // so both can briefly coexist).
  useEffect(() => {
    flyRegistry.current = { id: q.id, fly };
    return () => {
      if (flyRegistry.current?.id === q.id) flyRegistry.current = null;
    };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const onDragEnd = (_e, info) => {
    if (info.offset.x < -SWIPE_THRESHOLD) fly('skip');
    else if (info.offset.x > SWIPE_THRESHOLD) fly('yes');
    else {
      animate(x, 0, { type: 'spring', stiffness: 320, damping: 26 });
      animate(y, 0, { type: 'spring', stiffness: 320, damping: 26 });
    }
  };

  const srcLabel =
    q.source === 'ai' ? t('home.srcAi') : q.source === 'user' ? t('home.srcUser') : 'DeePer';

  return (
    <motion.div
      className="qcard glass glass--red"
      style={{ x, y, rotate }}
      drag
      dragElastic={0.7}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      onDragEnd={onDragEnd}
      onTap={handleTap}
      whileTap={{ cursor: 'grabbing' }}
    >
      <span className="q-source">{srcLabel}</span>
      <motion.span
        className="swipe-hint"
        style={{ opacity: noOp, color: '#fff', left: 22, right: 'auto' }}
      >
        <IcX size={34} sw={3} />
      </motion.span>
      <motion.span className="swipe-hint" style={{ opacity: yesOp, color: 'var(--green)' }}>
        <IcCheck size={34} sw={3} />
      </motion.span>
      <p className="q-text">{q.text}</p>
      <AnimatePresence>
        {burst && (
          <motion.div
            className="tap-burst"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.25, opacity: 0 }}
            transition={{ duration: 0.28, ease: FLY_EASE }}
          >
            <IcBookmark size={72} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DeckStack({ current, next, onSkip, onAnswer, onSave, enterDir, flyRegistry }) {
  const progress = useMotionValue(0);
  const backScale = useTransform(progress, [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD], [1, 0.94, 1]);
  const backY = useTransform(progress, [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD], [0, 14, 0]);
  const backOpacity = useTransform(progress, [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD], [1, 0.6, 1]);

  // If the outgoing card actually flew away (a real swipe, as opposed to the
  // save button or the very first card), the card behind has already risen
  // to CARD_REST by now via the mirrored progress above — mount it there
  // directly instead of replaying the rise, so the swap reads as one
  // continuous motion rather than a shrink back to REST_BEHIND and regrow.
  const seamless = !enterDir && Math.abs(progress.get()) >= SWIPE_THRESHOLD;

  return (
    <div className="deck" data-tut="deck">
      {next && (
        // Outer wrapper fades in once on mount (opacity multiplies with the
        // inner style-bound one below). Delayed to start only once the
        // current card's own rise (RISE_SPRING, settles in ~0.3s) has
        // essentially finished — fading it in from t=0 still overlapped
        // visually with that rise the whole time, which read as the same
        // flash even smoothed out. Starting after avoids any window where
        // both cards are visible together. Since this only plays on mount
        // (not on every re-render), swipe-driven updates aren't affected.
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.32, ease: FLY_EASE }}
          style={{ position: 'absolute', inset: 0 }}
        >
          <motion.div className="qcard glass" style={{ scale: backScale, y: backY, opacity: backOpacity }}>
            <p className="q-text" style={{ opacity: 0.5 }}>
              {next.text}
            </p>
          </motion.div>
        </motion.div>
      )}
      <AnimatePresence initial={false}>
        <motion.div
          key={current.id}
          initial={enterDir ? { x: `${-enterDir * 100}%` } : seamless ? CARD_REST : REST_BEHIND}
          animate={CARD_REST}
          exit={enterDir ? { x: `${enterDir * 100}%`, opacity: 0 } : undefined}
          transition={enterDir ? CARD_EXIT_TRANSITION : seamless ? { duration: 0 } : RISE_SPRING}
          style={{ position: 'absolute', inset: 0 }}
        >
          <TopCard
            q={current}
            onSkip={onSkip}
            onAnswer={onAnswer}
            onSave={onSave}
            onDragProgress={(v) => progress.set(v)}
            flyRegistry={flyRegistry}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default function Home() {
  const nav = useNavigate();
  const toast = useToast();
  const { t } = useI18n();

  const [category, setCategory] = useState(() => localStorage.getItem('dt_cat') || 'couple');
  const [deck, setDeck] = useState([]);
  const [idx, setIdx] = useState(0);
  const [status, setStatus] = useState('loading'); // loading | ready | error | empty
  const [error, setError] = useState('');
  const [aiEnabled, setAiEnabled] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newQ, setNewQ] = useState('');
  const [showTutorial, setShowTutorial] = useState(
    () => localStorage.getItem('dt_tutorial_pending') === '1',
  );
  const [enterDir, setEnterDir] = useState(0);
  const [genie, setGenie] = useState(null);
  const seen = useRef(new Set());
  const firstLoad = useRef(true);
  const flyRegistry = useRef(null);

  const fetchBatch = useCallback(async (cat, { reset = false, silent = false } = {}) => {
    try {
      if (reset) {
        seen.current = new Set();
        if (!silent) setStatus('loading');
      }
      const exclude = [...seen.current].join(',');
      const d = await api.get(`/questions/?category=${cat}&limit=20&exclude=${exclude}`);
      setAiEnabled(d.ai_enabled);
      const fresh = d.questions.filter((q) => !seen.current.has(q.id));
      fresh.forEach((q) => seen.current.add(q.id));
      setDeck((prev) => (reset ? fresh : [...prev, ...fresh]));
      if (reset) {
        setIdx(0);
        setStatus(fresh.length ? 'ready' : 'empty');
      }
      return fresh.length;
    } catch (e) {
      setError(e.message);
      setStatus('error');
      return 0;
    }
  }, []);

  useEffect(() => {
    fetchBatch(category, { reset: true, silent: !firstLoad.current });
    firstLoad.current = false;
  }, [category, fetchBatch]);

  const current = deck[idx];
  const remaining = deck.length - idx;

  // enterDir only needs to drive the one card-slide transition right after a
  // category switch — clear it once that card has been rendered so normal
  // swipe-driven advances go back to their plain (non-sliding) transition.
  useEffect(() => {
    if (enterDir !== 0) setEnterDir(0);
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status === 'ready' && remaining > 0 && remaining <= 4) {
      fetchBatch(category);
    }
    if (status === 'ready' && remaining === 0) {
      setStatus('empty');
    }
  }, [remaining, status, category, fetchBatch]);

  const switchCat = (v) => {
    if (v === category) return;
    setEnterDir(CATS.indexOf(v) > CATS.indexOf(category) ? 1 : -1);
    localStorage.setItem('dt_cat', v);
    setCategory(v);
  };

  const advance = useCallback(() => setIdx((i) => i + 1), []);
  const doSkip = () => {
    if (flyRegistry.current?.id === current?.id) flyRegistry.current.fly('skip');
  };
  const doAnswer = () => {
    if (flyRegistry.current?.id === current?.id) flyRegistry.current.fly('yes');
  };

  const goAnswer = () => {
    if (!current) return;
    nav('/app/answer', { state: { question: { text: current.text, category } } });
  };

  // Flies the actual card (its real text, in its own glass--red look) down
  // into the bottom nav's Saved icon, genie-minimize style, instead of a
  // toast — the nav icon itself is the confirmation.
  const launchGenie = () => {
    const fromEl = document.querySelector('[data-tut="deck"]');
    // Target the <svg> glyph itself, not its wrapping .nav-ic span — a span
    // around an inline-replaced element (the svg) picks up the usual
    // few-px baseline gap below it, which throws off getBoundingClientRect
    // just enough that the funnel visibly overshoots past the real icon.
    // The svg's own rect has no such slop.
    const toEl = document.querySelector('[data-tut="navSaved"] .nav-ic svg');
    if (!fromEl || !toEl || !current) return;
    setGenie({
      id: Date.now(),
      text: current.text,
      from: fromEl.getBoundingClientRect(),
      to: toEl.getBoundingClientRect(),
    });
  };

  const save = async () => {
    if (!current) return;
    try {
      await api.post('/saved', { question_text: current.text, category });
      launchGenie();
      advance();
    } catch (e) {
      toast(e.message);
    }
  };

  // Desktop keyboard shortcuts for the card deck: ←/→ mirror the swipe
  // gestures (skip/answer), ↑ mirrors the save button. Kept in a ref so the
  // listener is attached once instead of re-subscribing on every render.
  const keyStateRef = useRef();
  keyStateRef.current = { status, current, showTutorial, doSkip, doAnswer, save };
  useEffect(() => {
    const onKeyDown = (e) => {
      const { status, current, showTutorial, doSkip, doAnswer, save } = keyStateRef.current;
      if (status !== 'ready' || !current || showTutorial) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        doSkip();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        doAnswer();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const generateAi = async () => {
    setGenerating(true);
    try {
      const d = await api.post('/questions/generate', { category, count: 6 });
      const fresh = d.questions.filter((q) => !seen.current.has(q.id));
      fresh.forEach((q) => seen.current.add(q.id));
      setDeck((prev) => [...prev, ...fresh]);
      setStatus('ready');
      toast(
        <>
          <IcSparkle size={16} /> {t('home.aiDone')}
        </>,
      );
    } catch (e) {
      toast(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const addOwn = async (e) => {
    e.preventDefault();
    const text = newQ.trim();
    if (text.length < 3) return;
    try {
      const d = await api.post('/questions', { category, text });
      seen.current.add(d.question.id);
      setDeck((prev) => [...prev, d.question]);
      setStatus('ready');
      setNewQ('');
      setAdding(false);
      toast(
        <>
          <IcChat size={16} /> {t('home.added')}
        </>,
      );
    } catch (e2) {
      toast(e2.message);
    }
  };

  // True macOS-genie shape (not just scale/translate): a fixed "stage" box
  // spans from the card down to the nav icon, and a clip-path polygon warps
  // the card's own rectangle into a narrowing funnel. The bottom edge is
  // pulled toward the icon first (fast), the top edge only catches up near
  // the end (slow-then-snap) — same lag order the real genie uses — and the
  // sides curve in past a straight taper (a "waist") rather than a flat
  // trapezoid, which is what actually reads as liquid instead of geometric.
  // Memoized on `genie` itself (not recomputed every render): save() calls
  // advance() right after launchGenie(), which re-renders Home repeatedly
  // while the genie is mid-flight. Recomputing this inline on every render
  // handed framer-motion a new `frames` array reference each time, which it
  // read as a brand new animation target and restarted from scratch — so
  // the shape kept snapping back near the start instead of ever finishing
  // its run down to the icon.
  const genieStage = useMemo(() => genie && (() => {
    const { from, to } = genie;
    const left = Math.min(from.left, to.left) - 24;
    const top = from.top;
    const right = Math.max(from.left + from.width, to.left + to.width) + 24;
    const bottom = to.top + to.height;
    const width = right - left;
    const height = bottom - top;
    const pctX = (x) => ((x - left) / width) * 100;
    const pctY = (y) => ((y - top) / height) * 100;
    const lerp = (a, b, t) => a + (b - a) * t;

    const cardCx = from.left + from.width / 2;
    const cardW = from.width;
    const cardT = from.top;
    const cardB = from.top + from.height;
    const iconCx = to.left + to.width / 2;
    const iconW = to.width;
    const iconT = to.top;
    const iconB = to.top + to.height;

    const SIDE_STEPS = 8; // vertical samples per side — higher = smoother waist curve
    const waistPx = Math.min(cardW, 220) * 0.22;

    const shapeAt = (p) => {
      const eBottom = Math.pow(p, 0.55); // leads the pull
      const eTop = Math.pow(p, 2.4); // lags, then snaps shut at the end
      const topY = lerp(cardT, iconT, eTop);
      const botY = lerp(cardB, iconB, eBottom);
      const topCx = lerp(cardCx, iconCx, eTop);
      const botCx = lerp(cardCx, iconCx, eBottom);
      const topW = lerp(cardW, iconW, eTop);
      const botW = lerp(cardW, iconW, eBottom);
      const pinch = 4 * p * (1 - p) * waistPx; // peaks mid-pull, gone at rest/landed

      const leftPts = [];
      const rightPts = [];
      for (let i = 0; i <= SIDE_STEPS; i++) {
        const f = i / SIDE_STEPS;
        const y = lerp(topY, botY, f);
        const cx = lerp(topCx, botCx, f);
        const halfW = Math.max(lerp(topW, botW, f) - pinch * Math.sin(f * Math.PI), 2) / 2;
        leftPts.push(`${pctX(cx - halfW)}% ${pctY(y)}%`);
        rightPts.push(`${pctX(cx + halfW)}% ${pctY(y)}%`);
      }
      return `polygon(${leftPts.join(', ')}, ${rightPts.reverse().join(', ')})`;
    };

    return {
      left,
      top,
      width,
      height,
      frames: [0, 0.25, 0.5, 0.75, 1].map(shapeAt),
      // Where the card's own text sits, in stage-relative coordinates — the
      // text stays put here while the clip-path mask above it narrows and
      // slides away, so it reads as the card's content being consumed by
      // the funnel rather than a separate label riding along with it.
      textBox: { left: from.left - left, top: from.top - top, width: from.width, height: from.height },
    };
  })(), [genie]);

  return (
    <>
      <div className="page page--tab stagger">
        <div className="row-between" style={{ marginBottom: 16 }}>
          <div className="brand-mark">
            <span className="dot" />
            <span style={{ fontSize: 22, fontWeight: 700 }}>DeePer</span>
          </div>
          <button
            className="btn btn--sm btn--ghost"
            data-tut="add"
            onClick={() => setAdding((a) => !a)}
          >
            <IcPlus size={18} /> {t('home.addQuestion')}
          </button>
        </div>

        <div className="cat-row" data-tut="cats" style={{ marginBottom: 6 }}>
          {CATS.map((c) => {
            const isActive = category === c;
            return (
              <button
                key={c}
                className={`pill ${isActive ? 'active' : ''}`}
                onClick={() => switchCat(c)}
              >
                {isActive && (
                  <motion.span
                    layoutId="cat-pill-bg"
                    className="pill-bg"
                    transition={{ type: 'spring', stiffness: 420, damping: 22, mass: 0.9 }}
                  />
                )}
                <motion.span
                  key={isActive ? 'on' : 'off'}
                  className="pill-label"
                  initial={isActive ? { scale: 0.82 } : false}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 14 }}
                >
                  {t(`cat.${c}`)}
                </motion.span>
              </button>
            );
          })}
        </div>

        {adding && (
          <form className="glass fade-up" style={{ padding: 14, margin: '14px 0' }} onSubmit={addOwn}>
            <textarea
              className="textarea"
              style={{ minHeight: 80 }}
              placeholder={t('home.addPh')}
              value={newQ}
              onChange={(e) => setNewQ(e.target.value)}
              maxLength={200}
            />
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAdding(false)}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn btn--primary btn--sm" disabled={newQ.trim().length < 3}>
                {t('home.add')}
              </button>
            </div>
          </form>
        )}

        {status === 'loading' && <Loading label={t('home.loading')} />}

        {status === 'error' && (
          <ErrorState message={error} onRetry={() => fetchBatch(category, { reset: true })} />
        )}

        {status === 'empty' && (
          <EmptyState
            icon={<IcCards size={44} />}
            title={t('home.emptyTitle')}
            subtitle={aiEnabled ? t('home.emptySubAi') : t('home.emptySub')}
            action={
              <div className="btn-row" style={{ marginTop: 10 }}>
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => fetchBatch(category, { reset: true })}
                >
                  {t('home.restart')}
                </button>
                {aiEnabled && (
                  <button className="btn btn--primary btn--sm" onClick={generateAi} disabled={generating}>
                    {generating ? (
                      t('home.generating')
                    ) : (
                      <>
                        <IcSparkle size={16} /> {t('home.genAi')}
                      </>
                    )}
                  </button>
                )}
              </div>
            }
          />
        )}

        {status === 'ready' && current && (
          <>
            <DeckStack
              current={current}
              next={deck[idx + 1]}
              onSkip={advance}
              onAnswer={goAnswer}
              onSave={save}
              enterDir={enterDir}
              flyRegistry={flyRegistry}
            />

            <div className="actions">
              <button
                className="fab fab-md fab--x"
                data-tut="actionSkip"
                onClick={doSkip}
                aria-label={t('home.aSkip')}
              >
                <IcX size={26} />
              </button>
              <button
                className="fab fab-md fab--save"
                data-tut="actionSave"
                onClick={save}
                aria-label={t('home.aSave')}
              >
                <IcBookmark size={26} />
              </button>
              <button
                className="fab fab-md fab--check"
                data-tut="actionAnswer"
                onClick={doAnswer}
                aria-label={t('home.aAnswer')}
              >
                <IcCheck size={26} />
              </button>
            </div>
          </>
        )}
      </div>

      {showTutorial && status === 'ready' && current && (
        <HomeTutorial
          onDone={() => {
            localStorage.removeItem('dt_tutorial_pending');
            setShowTutorial(false);
          }}
        />
      )}

      <AnimatePresence>
        {genie && genieStage && (
          <motion.div
            key={genie.id}
            className="genie-fly glass glass--red"
            style={{
              left: genieStage.left,
              top: genieStage.top,
              width: genieStage.width,
              height: genieStage.height,
            }}
            initial={{ clipPath: genieStage.frames[0], opacity: 1 }}
            animate={{
              clipPath: genieStage.frames,
              opacity: [1, 1, 1, 0.9, 0],
            }}
            transition={{ duration: 0.62, ease: 'easeInOut' }}
            onAnimationComplete={() => setGenie(null)}
          >
            <div className="genie-fly-textbox" style={genieStage.textBox}>
              <motion.p
                className="genie-fly-text"
                initial={{ opacity: 1 }}
                animate={{ opacity: [1, 1, 0] }}
                transition={{ duration: 0.62, times: [0, 0.72, 1], ease: 'easeIn' }}
              >
                {genie.text}
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
