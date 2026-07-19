import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { api } from '../api.js';
import { useToast } from '../components/ui.jsx';
import { Loading, ErrorState, EmptyState } from '../components/ui.jsx';
import { IcX, IcCheck, IcBookmark, IcPlus } from '../components/icons.jsx';

const CATS = [
  { v: 'couple', l: 'คู่รัก' },
  { v: 'friends', l: 'เพื่อน ๆ' },
  { v: 'family', l: 'ครอบครัว' },
];
const SWIPE_THRESHOLD = 110;

function TopCard({ q, onSkip, onAnswer }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-14, 14]);
  const noOp = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);
  const yesOp = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);

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

  const srcLabel = q.source === 'ai' ? 'AI' : q.source === 'user' ? 'ของเรา' : 'DeePer';

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
      <motion.span className="swipe-hint" style={{ opacity: noOp, color: '#fff', left: 22, right: 'auto' }}>
        ✕
      </motion.span>
      <motion.span className="swipe-hint" style={{ opacity: yesOp, color: 'var(--green)' }}>
        ✓
      </motion.span>
      <p className="q-text">{q.text}</p>
      {/* expose imperative fly via data-* not needed; buttons call parent */}
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

export default function Home() {
  const nav = useNavigate();
  const toast = useToast();

  const [category, setCategory] = useState(() => localStorage.getItem('dt_cat') || 'couple');
  const [deck, setDeck] = useState([]);
  const [idx, setIdx] = useState(0);
  const [status, setStatus] = useState('loading'); // loading | ready | error | empty
  const [error, setError] = useState('');
  const [aiEnabled, setAiEnabled] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newQ, setNewQ] = useState('');
  const seen = useRef(new Set());

  const fetchBatch = useCallback(
    async (cat, { reset = false } = {}) => {
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
        } else if (!fresh.length) {
          // nothing new to append
        }
        return fresh.length;
      } catch (e) {
        setError(e.message);
        setStatus('error');
        return 0;
      }
    },
    [],
  );

  useEffect(() => {
    fetchBatch(category, { reset: true });
  }, [category, fetchBatch]);

  const current = deck[idx];
  const remaining = deck.length - idx;

  // Top up when running low.
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
      toast('บันทึกคำถามแล้ว 🔖');
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
      toast('สร้างคำถามใหม่ด้วย AI แล้ว ✨');
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
      toast('เพิ่มคำถามของคุณแล้ว 💬');
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
        <button className="btn btn--sm btn--ghost" onClick={() => setAdding((a) => !a)}>
          <IcPlus size={18} /> เพิ่มคำถาม
        </button>
      </div>

      <div className="cat-row" style={{ marginBottom: 6 }}>
        {CATS.map((c) => (
          <button
            key={c.v}
            className={`pill ${category === c.v ? 'active' : ''}`}
            onClick={() => switchCat(c.v)}
          >
            {c.l}
          </button>
        ))}
      </div>

      {adding && (
        <form className="glass fade-up" style={{ padding: 14, margin: '14px 0' }} onSubmit={addOwn}>
          <textarea
            className="textarea"
            style={{ minHeight: 80 }}
            placeholder="พิมพ์คำถามของคุณเองสำหรับหมวดนี้..."
            value={newQ}
            onChange={(e) => setNewQ(e.target.value)}
            maxLength={200}
          />
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAdding(false)}>
              ยกเลิก
            </button>
            <button type="submit" className="btn btn--primary btn--sm" disabled={newQ.trim().length < 3}>
              เพิ่ม
            </button>
          </div>
        </form>
      )}

      {status === 'loading' && <Loading label="กำลังหยิบคำถามให้..." />}

      {status === 'error' && (
        <ErrorState message={error} onRetry={() => fetchBatch(category, { reset: true })} />
      )}

      {status === 'empty' && (
        <EmptyState
          emoji="🃏"
          title="คำถามในหมวดนี้หมดแล้ว"
          subtitle={
            aiEnabled
              ? 'ให้ AI ช่วยสร้างคำถามใหม่ หรือเปลี่ยนหมวดก็ได้'
              : 'ลองเปลี่ยนหมวด หรือเพิ่มคำถามของคุณเอง'
          }
          action={
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => fetchBatch(category, { reset: true })}
              >
                เริ่มใหม่
              </button>
              {aiEnabled && (
                <button className="btn btn--primary btn--sm" onClick={generateAi} disabled={generating}>
                  {generating ? 'กำลังสร้าง...' : '✨ สร้างด้วย AI'}
                </button>
              )}
            </div>
          }
        />
      )}

      {status === 'ready' && current && (
        <>
          <div className="deck">
            {/* card behind for depth */}
            {deck[idx + 1] && (
              <div
                className="qcard glass"
                style={{ transform: 'scale(0.94) translateY(14px)', opacity: 0.6 }}
              >
                <p className="q-text" style={{ opacity: 0.5 }}>
                  {deck[idx + 1].text}
                </p>
              </div>
            )}
            <TopCard key={current.id} q={current} onSkip={advance} onAnswer={goAnswer} />
          </div>

          <div className="actions">
            <button className="fab fab-md fab--x" onClick={doSkip} aria-label="ข้าม">
              <IcX size={26} />
            </button>
            <button className="fab fab-lg fab--save" onClick={save} aria-label="บันทึก">
              <IcBookmark size={28} />
            </button>
            <button className="fab fab-md fab--check" onClick={doAnswer} aria-label="ตอบ">
              <IcCheck size={26} />
            </button>
          </div>
          <div className="action-labels">
            <span>ข้าม</span>
            <span>บันทึก</span>
            <span>ตอบเลย</span>
          </div>
        </>
      )}
    </div>
  );
}
