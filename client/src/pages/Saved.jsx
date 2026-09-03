import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { api } from '../api.js';
import { useI18n } from '../store/i18n.jsx';
import { useTutorial } from '../store/tutorial.jsx';
import { Loading, ErrorState, EmptyState, useToast, useConfirm } from '../components/ui.jsx';
import CatFilter from '../components/CatFilter.jsx';
import { catLabel, formatDate } from '../util.js';
import { IcTrash, IcBookmark } from '../components/icons.jsx';

// Same top-to-bottom cascade the page-load stagger uses, but driven by
// scroll position instead of a mount-time CSS animation: each card pops in
// (scale + fade) as it enters the viewport, and replays every time it does
// (once: false) — so scrolling back up to re-reveal a card plays it again,
// same as scrolling down into a fresh one below the fold.
function SavedItem({ it, index, onAnswer, onRemove }) {
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.4, once: false });
  const delay = Math.min(index * 0.04, 0.24);

  return (
    <motion.div
      ref={ref}
      className="card-item glass"
      // Anchor for the tour's "here's a real saved item" step (only ever
      // the first card, see the .map below) — kept off SavedItem's own
      // className/logic so this stays a one-line addition, not a behavior
      // change to the card itself.
      data-tut={index === 0 ? 'savedItem' : undefined}
      onClick={() => onAnswer(it)}
      initial={{ scale: 0.7, opacity: 0 }}
      animate={inView ? { scale: 1, opacity: 1 } : { scale: 0.7, opacity: 0 }}
      transition={{ duration: 0.15, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      <p className="ci-q">{it.question_text}</p>
      <div className="ci-meta">
        <span className="tag">{catLabel(it.category)}</span>
        <span>{formatDate(it.created_at)}</span>
        <button className="icon-del" onClick={(e) => onRemove(e, it.id)} aria-label="delete">
          <IcTrash size={18} />
        </button>
      </div>
    </motion.div>
  );
}

export default function Saved() {
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { t } = useI18n();
  const tutorial = useTutorial();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [catFilter, setCatFilter] = useState('all');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const d = await api.get('/saved');
      setItems(d.saved);
      setStatus(d.saved.length ? 'ready' : 'empty');
      tutorial.setSavedHasItems(d.saved.length > 0);
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
    // setSavedHasItems (a useState setter) is referentially stable, unlike
    // the `tutorial` context object itself — depending on the whole object
    // would recreate `load` (and re-trigger the effect below) on every
    // unrelated tutorial state change, re-fetching /saved for no reason.
  }, [tutorial.setSavedHasItems]);

  useEffect(() => {
    load();
  }, [load]);

  const answer = (it) => {
    nav('/app/answer', {
      state: { question: { text: it.question_text, category: it.category }, savedId: it.id },
    });
  };

  const remove = async (e, id) => {
    e.stopPropagation();
    const ok = await confirm({ message: t('confirm.savedMsg') });
    if (!ok) return;
    try {
      await api.del(`/saved/${id}`);
      setItems((prev) => prev.filter((x) => x.id !== id));
      toast(t('saved.removed'));
    } catch (e2) {
      toast(e2.message);
    }
  };

  const filtered = catFilter === 'all' ? items : items.filter((it) => it.category === catFilter);

  return (
    <div className="page page--tab stagger">
      <div className="header" data-tut="savedIntro">
        <h1 className="h1">{t('saved.title')}</h1>
        <p className="sub">{t('saved.sub')}</p>
      </div>

      {status === 'loading' && <Loading />}
      {status === 'error' && <ErrorState message={error} onRetry={load} />}
      {status === 'empty' && (
        <EmptyState
          icon={<IcBookmark size={44} />}
          title={t('saved.emptyTitle')}
          subtitle={t('saved.emptySub')}
          action={
            <button
              className="btn btn--primary btn--sm"
              style={{ marginTop: 8 }}
              onClick={() => nav('/app/home')}
            >
              {t('saved.goHome')}
            </button>
          }
        />
      )}

      {status === 'ready' && (
        <>
          <CatFilter value={catFilter} onChange={setCatFilter} />
          {filtered.length === 0 ? (
            <p className="sub" style={{ marginTop: 24, textAlign: 'center' }}>
              {t('saved.emptyFilter')}
            </p>
          ) : (
            <div className="list">
              {filtered.map((it, index) => (
                <SavedItem key={it.id} it={it} index={index} onAnswer={answer} onRemove={remove} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
