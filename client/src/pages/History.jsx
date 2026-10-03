import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import { useTutorial } from '../store/tutorial.jsx';
import { Loading, ErrorState, EmptyState, useToast, useConfirm } from '../components/ui.jsx';
import CatFilter from '../components/CatFilter.jsx';
import { catLabel, formatDate } from '../util.js';
import { IcTrash, IcHistory } from '../components/icons.jsx';

export default function History() {
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const { t } = useI18n();
  const tutorial = useTutorial();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const [catFilter, setCatFilter] = useState('all');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const d = await api.get('/history');
      setItems(d.history);
      setStatus(d.history.length ? 'ready' : 'empty');
      tutorial.setHistoryHasItems(d.history.length > 0);
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
    // See Saved.jsx's load() for why this depends on the setter directly
    // rather than the whole `tutorial` object.
  }, [tutorial.setHistoryHasItems]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (e, id) => {
    e.stopPropagation();
    const ok = await confirm({ message: t('confirm.historyMsg') });
    if (!ok) return;
    try {
      await api.del(`/history/${id}`);
      setItems((prev) => prev.filter((x) => x.id !== id));
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
                className="card-item glass"
                // Anchor for the tour's "here's a real history entry" step —
                // only the first card (see historyItem in OnboardingTour.jsx).
                data-tut={index === 0 ? 'historyItem' : undefined}
                onClick={() => setOpen(isOpen ? null : it.id)}
              >
                <p className="ci-q">{it.question_text}</p>
                <div className="ci-meta">
                  <span className="tag">{catLabel(it.category)}</span>
                  <span>{formatDate(it.created_at)}</span>
                  <button className="icon-del" onClick={(e) => remove(e, it.id)} aria-label="delete">
                    <IcTrash size={18} />
                  </button>
                </div>

                {isOpen && (
                  <div className="fade-up">
                    {it.my_answer && (
                      <div className="answer-block" style={{ borderLeftColor: 'var(--red)' }}>
                        <div className="ab-name" style={{ color: 'var(--red-bright)' }}>
                          {user?.nickname || t('answer.we')}
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
                          {it.partner_name || t('answer.partnerDefault')}
                        </div>
                        <div className="ab-text">{it.partner_answer}</div>
                      </div>
                    )}
                    {!it.my_answer && !it.partner_answer && (
                      <p className="faint" style={{ marginTop: 10 }}>
                        {t('history.noAnswers')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
