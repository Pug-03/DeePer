import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useI18n } from '../store/i18n.jsx';
import { Loading, ErrorState, EmptyState, useToast, useConfirm } from '../components/ui.jsx';
import { catLabel, formatDate } from '../util.js';
import { IcTrash } from '../components/icons.jsx';

export default function Saved() {
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const d = await api.get('/saved');
      setItems(d.saved);
      setStatus(d.saved.length ? 'ready' : 'empty');
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  }, []);

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

  return (
    <div className="page page--tab">
      <div className="header">
        <h1 className="h1">{t('saved.title')}</h1>
        <p className="sub">{t('saved.sub')}</p>
      </div>

      {status === 'loading' && <Loading />}
      {status === 'error' && <ErrorState message={error} onRetry={load} />}
      {status === 'empty' && (
        <EmptyState
          emoji="🔖"
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
        <div className="list">
          {items.map((it) => (
            <div key={it.id} className="card-item glass fade-up" onClick={() => answer(it)}>
              <p className="ci-q">{it.question_text}</p>
              <div className="ci-meta">
                <span className="tag">{catLabel(it.category)}</span>
                <span>{formatDate(it.created_at)}</span>
                <button className="icon-del" onClick={(e) => remove(e, it.id)} aria-label="delete">
                  <IcTrash size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
