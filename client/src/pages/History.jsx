import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import { useTutorial } from '../store/tutorial.jsx';
import { Loading, ErrorState, EmptyState, useToast, useConfirm } from '../components/ui.jsx';
import CatFilter from '../components/CatFilter.jsx';
import { fetchList, getCachedList, setCachedList } from '../utils/listCache.js';
import { catLabel, displayName, formatDate, questionText, partnerLabel } from '../util.js';
import { IcTrash, IcHistory } from '../components/icons.jsx';

export default function History() {
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const tutorial = useTutorial();
  // Last list seen this session shows at once; load() refreshes it quietly.
  const cached = getCachedList(user?.id, 'history');
  const [items, setItemsState] = useState(cached ?? []);
  const [status, setStatus] = useState(cached ? (cached.length ? 'ready' : 'empty') : 'loading');
  const setItems = (update) =>
    setItemsState((prev) => {
      const next = typeof update === 'function' ? update(prev) : update;
      setCachedList(user?.id, 'history', next);
      return next;
    });
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const [catFilter, setCatFilter] = useState('all');

  const load = useCallback(async () => {
    const hadCache = getCachedList(user?.id, 'history') !== undefined;
    if (!hadCache) setStatus('loading');
    try {
      const list = await fetchList(user?.id, 'history');
      setItemsState(list);
      setStatus(list.length ? 'ready' : 'empty');
      tutorial.setHistoryHasItems(list.length > 0);
    } catch (e) {
      // A failed background refresh keeps the list already on screen.
      if (hadCache) return;
      setError(e.message);
      setStatus('error');
    }
    // See Saved.jsx's load() for why this depends on the setter directly
    // rather than the whole `tutorial` object.
  }, [tutorial.setHistoryHasItems, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (e, id) => {
    e.stopPropagation();
    const ok = await confirm({ message: t('confirm.historyMsg') });
    if (!ok) return;
    try {
      await api.del(`/history/${id}`);
      setItems((prev) => {
        const next = prev.filter((x) => x.id !== id);
        if (!next.length) setStatus('empty');
        return next;
      });
      toast(t('history.removed'));
    } catch (e2) {
      toast(e2.message);
    }
  };

  const filtered = catFilter === 'all' ? items : items.filter((it) => it.category === catFilter);

  return (
    <div className="page page--tab stagger">
      <div className="header">
        <h1 className="h1">{t('history.title')}</h1>
        <p className="sub">{t('history.sub')}</p>
      </div>

      {status === 'loading' && <Loading />}
      {status === 'error' && <ErrorState message={error} onRetry={load} />}
      {status === 'empty' && (
        <EmptyState
          icon={<IcHistory size={44} />}
          title={t('history.emptyTitle')}
          subtitle={t('history.emptySub')}
          action={
            <button
              className="btn btn--primary btn--sm"
              style={{ marginTop: 8 }}
              onClick={() => nav('/app/home')}
            >
              {t('history.start')}
            </button>
          }
        />
      )}

      {status === 'ready' && <CatFilter value={catFilter} onChange={setCatFilter} />}

      {status === 'ready' && filtered.length === 0 && (
        <p className="sub" style={{ marginTop: 24, textAlign: 'center' }}>
          {t('history.emptyFilter')}
        </p>
      )}

      {status === 'ready' && filtered.length > 0 && (
        <div className="list stagger">
          {filtered.map((it, index) => {
            const isOpen = open === it.id;
            return (
              <div
                key={it.id}
                className="card-item qitem"
                style={{ '--cat': `var(--cat-${it.category})` }}
                // Anchor for the tour's "here's a real history entry" step —
                // only the first card (see historyItem in OnboardingTour.jsx).
                data-tut={index === 0 ? 'historyItem' : undefined}
                onClick={() => setOpen(isOpen ? null : it.id)}
              >
                <span className="qitem-cat">{catLabel(it.category)}</span>
                <p className="ci-q">{questionText(it.question_text, it.question_text_en, lang)}</p>
                <div className="ci-meta">
                  <span>{formatDate(it.created_at)}</span>
                  <span className="qitem-actions">
                    {/* Shows the row opens, and which way it's turned. */}
                    <span className={`qitem-toggle${isOpen ? ' open' : ''}`}>
                      {isOpen ? t('history.hideAnswers') : t('history.showAnswers')}
                      <ChevronDown size={15} />
                    </span>
                    <button className="icon-del" onClick={(e) => remove(e, it.id)} aria-label="delete">
                      <IcTrash size={18} />
                    </button>
                  </span>
                </div>

                {/* Opens and closes smoothly instead of the rows below
                    jumping by the answers' full height in one frame. */}
                <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    className="qitem-answers"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {it.my_answer && (
                      <div className="answer-block" style={{ borderLeftColor: 'var(--red)' }}>
                        <div className="ab-name" style={{ color: 'var(--red-bright)' }}>
                          {displayName(user, lang) || t('answer.we')}
                        </div>
                        <div className="ab-text">{it.my_answer}</div>
                      </div>
                    )}
                    {it.partner_answer && (
                      <div
                        className="answer-block"
                        style={{ borderLeftColor: it.partner_color || 'var(--red)' }}
                      >
                        <div
                          className="ab-name"
                          style={{ color: it.partner_color || 'var(--red-bright)' }}
                        >
                          {partnerLabel(it.partner_name, t)}
                        </div>
                        <div className="ab-text">{it.partner_answer}</div>
                      </div>
                    )}
                    {!it.my_answer && !it.partner_answer && (
                      <p className="faint" style={{ marginTop: 10 }}>
                        {t('history.noAnswers')}
                      </p>
                    )}
                  </motion.div>
                )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
