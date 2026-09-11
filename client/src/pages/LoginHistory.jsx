import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useI18n } from '../store/i18n.jsx';
import { Loading, ErrorState, EmptyState } from '../components/ui.jsx';
import { formatDate } from '../util.js';
import { IcBack, IcHistory } from '../components/icons.jsx';

export default function LoginHistory() {
  const nav = useNavigate();
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const d = await api.get('/auth/me/login-history');
      setItems(d.login_history);
      setTotal(d.total);
      setStatus(d.login_history.length ? 'ready' : 'empty');
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const methodLabel = (m) => t(`loginHistory.method.${m}`);

  return (
    <div className="page stagger">
      <button className="link" style={{ alignSelf: 'flex-start', marginBottom: 18 }} onClick={() => nav(-1)}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IcBack size={18} /> {t('common.back')}
        </span>
      </button>

      <div className="header">
        <h1 className="h1">{t('loginHistory.title')}</h1>
        <p className="sub">{t('loginHistory.sub')}</p>
      </div>

      {status === 'loading' && <Loading />}
      {status === 'error' && <ErrorState message={error} onRetry={load} />}
      {status === 'empty' && (
        <EmptyState
          icon={<IcHistory size={44} />}
          title={t('loginHistory.emptyTitle')}
          subtitle={t('loginHistory.emptySub')}
        />
      )}

      {status === 'ready' && (
        <>
          <p className="faint" style={{ marginBottom: 14 }}>
            {t('loginHistory.count', { n: total })}
          </p>
          <div className="list stagger">
            {items.map((it) => (
              <div key={it.id} className="card-item glass">
                <p className="ci-q">{formatDate(it.created_at)}</p>
                <div className="ci-meta">
                  <span className="tag">{methodLabel(it.method)}</span>
                  {it.ip && <span>{it.ip}</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
