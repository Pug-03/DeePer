import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
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

function TopCard({ q, onSkip, onAnswer, onDragProgress, flyRegistry }) {
  const { t } = useI18n();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-14, 14]);
  const noOp = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);
  const yesOp = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);

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
    </motion.div>
  );
}

function DeckStack({ current, next, onSkip, onAnswer, enterDir, flyRegistry }) {
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

  const save = async () => {
    if (!current) return;
    try {
      await api.post('/saved', { question_text: current.text, category });
      toast(
        <>
          <IcBookmark size={16} /> {t('home.saved')}
        </>,
      );
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
    </>
  );
}
