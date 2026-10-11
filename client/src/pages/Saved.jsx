import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import { useTutorial } from '../store/tutorial.jsx';
import { Loading, ErrorState, EmptyState, useToast, useConfirm } from '../components/ui.jsx';
import CatFilter from '../components/CatFilter.jsx';
import { fetchList, getCachedList, setCachedList } from '../utils/listCache.js';
import { catLabel, formatDate, questionText } from '../util.js';
import { IcTrash, IcBookmark } from '../components/icons.jsx';

// One saved question. The list fades its cards up in a short top-to-bottom
// cascade when the page opens (.list.stagger, plain CSS, played once) — the
// same as History. It used to pop each card in from small with a script
// animation that replayed every time a card scrolled into view, which
// looked different from History and cost more on phones.
function SavedItem({ it, index, onAnswer, onRemove }) {
  const { lang } = useI18n();

  return (
    <div
      className="card-item qitem"
      style={{ '--cat': `var(--cat-${it.category})` }}
      // Anchor for the tour's "here's a real saved item" step (only ever
      // the first card, see the .map below).
      data-tut={index === 0 ? 'savedItem' : undefined}
      onClick={() => onAnswer(it)}
    >
      <span className="qitem-cat">{catLabel(it.category)}</span>
      <p className="ci-q">{questionText(it.question_text, it.question_text_en, lang)}</p>
      <div className="ci-meta">
        <span>{formatDate(it.created_at)}</span>
        <button className="icon-del" onClick={(e) => onRemove(e, it.id)} aria-label="delete">
          <IcTrash size={18} />
        </button>
      </div>
    </div>
  );
}

export default function Saved() {
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { t } = useI18n();
  const tutorial = useTutorial();
  const { user } = useAuth();
  // Last list seen this session shows at once; load() refreshes it quietly.
  const cached = getCachedList(user?.id, 'saved');
  const [items, setItemsState] = useState(cached ?? []);
  const [status, setStatus] = useState(cached ? (cached.length ? 'ready' : 'empty') : 'loading');
  const setItems = (update) =>
    setItemsState((prev) => {
      const next = typeof update === 'function' ? update(prev) : update;
      setCachedList(user?.id, 'saved', next);
      return next;
    });
  const [error, setError] = useState('');
  const [catFilter, setCatFilter] = useState('all');

  const load = useCallback(async () => {
    const hadCache = getCachedList(user?.id, 'saved') !== undefined;
    if (!hadCache) setStatus('loading');
    try {
      const list = await fetchList(user?.id, 'saved');
      setItemsState(list);
      setStatus(list.length ? 'ready' : 'empty');
      tutorial.setSavedHasItems(list.length > 0);
    } catch (e) {
      // A failed background refresh keeps the list already on screen.
      if (hadCache) return;
      setError(e.message);
      setStatus('error');
    }
    // setSavedHasItems (a useState setter) is referentially stable, unlike
    // the `tutorial` context object itself — depending on the whole object
    // would recreate `load` (and re-trigger the effect below) on every
    // unrelated tutorial state change, re-fetching /saved for no reason.
  }, [tutorial.setSavedHasItems, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const answer = (it) => {
    nav('/app/answer', {
      state: {
        question: { text: it.question_text, text_en: it.question_text_en, category: it.category },
        savedId: it.id,
      },
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
      <div className="header">
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
            <div className="list stagger">
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
