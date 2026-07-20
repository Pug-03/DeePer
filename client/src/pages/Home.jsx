import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useMotionValueEvent, useTransform, animate } from 'framer-motion';
import { api } from '../api.js';
import { useI18n } from '../store/i18n.jsx';
import { useToast } from '../components/ui.jsx';
import { Loading, ErrorState, EmptyState } from '../components/ui.jsx';
import { IcX, IcCheck, IcBookmark, IcPlus, IcCards, IcSparkle, IcChat } from '../components/icons.jsx';
import HomeTutorial from '../components/HomeTutorial.jsx';

const CATS = ['couple', 'friends', 'family'];
const SWIPE_THRESHOLD = 110;

function TopCard({ q, onSkip, onAnswer, onDragProgress }) {
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
  useLayoutEffect(() => {
    onDragProgress?.(0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useMotionValueEvent(x, 'change', (v) => onDragProgress?.(v));

  const fly = (dir) => {
    if (dir === 'skip') {
      animate(y, 600, { duration: 0.32 });
      animate(x, -60, { duration: 0.32 });
      setTimeout(onSkip, 240);
    } else {
      animate(x, 480, { duration: 0.32 });
      setTimeout(onAnswer, 240);
    }
  };

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
      <FlyBridge fly={fly} />
    </motion.div>
  );
}

// Lets the parent's action buttons trigger the same fly animation as swipes.
function FlyBridge({ fly }) {
  const ref = useRef(fly);
  ref.current = fly;
  useEffect(() => {
    FlyBridge.current = (dir) => ref.current(dir);
    return () => {
      FlyBridge.current = null;
    };
  });
  return null;
}
FlyBridge.current = null;

function DeckStack({ current, next, onSkip, onAnswer }) {
  const progress = useMotionValue(0);
  const backScale = useTransform(progress, [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD], [1, 0.94, 1]);
  const backY = useTransform(progress, [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD], [0, 14, 0]);
  const backOpacity = useTransform(progress, [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD], [1, 0.6, 1]);

  return (
    <div className="deck" data-tut="deck">
      {next && (
        <motion.div className="qcard glass" style={{ scale: backScale, y: backY, opacity: backOpacity }}>
          <p className="q-text" style={{ opacity: 0.5 }}>
            {next.text}
          </p>
        </motion.div>
      )}
      <TopCard
        key={current.id}
        q={current}
        onSkip={onSkip}
        onAnswer={onAnswer}
        onDragProgress={(v) => progress.set(v)}
      />
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
  const seen = useRef(new Set());

  const fetchBatch = useCallback(async (cat, { reset = false } = {}) => {
    try {
      if (reset) {
        seen.current = new Set();
        setStatus('loading');
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
    fetchBatch(category, { reset: true });
  }, [category, fetchBatch]);

  const current = deck[idx];
  const remaining = deck.length - idx;

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
    localStorage.setItem('dt_cat', v);
    setCategory(v);
  };

  const advance = useCallback(() => setIdx((i) => i + 1), []);
  const doSkip = () => FlyBridge.current?.('skip');
  const doAnswer = () => FlyBridge.current?.('yes');

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
    <div className="page page--tab">
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
        {CATS.map((c) => (
          <button
            key={c}
            className={`pill ${category === c ? 'active' : ''}`}
            onClick={() => switchCat(c)}
          >
            {t(`cat.${c}`)}
          </button>
        ))}
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
          <DeckStack current={current} next={deck[idx + 1]} onSkip={advance} onAnswer={goAnswer} />

          <div className="actions" data-tut="actions">
            <button className="fab fab-md fab--x" onClick={doSkip} aria-label={t('home.aSkip')}>
              <IcX size={26} />
            </button>
            <button className="fab fab-lg fab--save" onClick={save} aria-label={t('home.aSave')}>
              <IcBookmark size={28} />
            </button>
            <button className="fab fab-md fab--check" onClick={doAnswer} aria-label={t('home.aAnswer')}>
              <IcCheck size={26} />
            </button>
          </div>
          <div className="action-labels">
            <span>{t('home.aSkip')}</span>
            <span>{t('home.aSave')}</span>
            <span>{t('home.aAnswer')}</span>
          </div>
        </>
      )}

      {showTutorial && status === 'ready' && current && (
        <HomeTutorial
          onDone={() => {
            localStorage.removeItem('dt_tutorial_pending');
            setShowTutorial(false);
          }}
        />
      )}
    </div>
  );
}
