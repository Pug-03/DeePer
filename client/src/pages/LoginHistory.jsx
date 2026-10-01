import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import { Loading, ErrorState, EmptyState, useToast, useConfirm } from '../components/ui.jsx';
import { formatDate } from '../util.js';
import { describeUserAgent } from '../utils/userAgent.js';
import { IcBack, IcHistory, IcCheck } from '../components/icons.jsx';

export default function LoginHistory() {
  const nav = useNavigate();
  const { logout } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [currentId, setCurrentId] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [logoutOthersBusy, setLogoutOthersBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const d = await api.get('/auth/me/login-history');
      setItems(d.login_history);
      setTotal(d.total);
      setCurrentId(d.current_id);
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

  const logoutDevice = async (it) => {
    const isSelf = it.id === currentId;
    const ok = await confirm({
      message: isSelf ? t('loginHistory.logoutDeviceConfirmSelf') : t('loginHistory.logoutDeviceConfirm'),
    });
    if (!ok) return;
    setBusyId(it.id);
    try {
      await api.del(`/auth/me/login-history/${it.id}`);
      if (isSelf) {
        logout();
        nav('/login', { replace: true });
        return;
      }
      toast(
        <>
          <IcCheck size={16} /> {t('loginHistory.logoutDeviceDone')}
        </>,
      );
      await load();
    } catch (e) {
      toast(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const logoutOtherDevices = async () => {
    const ok = await confirm({ message: t('loginHistory.logoutOthersConfirm') });
    if (!ok) return;
    setLogoutOthersBusy(true);
    try {
      await api.post('/auth/me/logout-other-devices');
      toast(
        <>
          <IcCheck size={16} /> {t('loginHistory.logoutOthersDone')}
        </>,
      );
      await load();
    } catch (e) {
      toast(e.message);
    } finally {
      setLogoutOthersBusy(false);
    }
  };

  return (
    <div className="page stagger">
      <button className="link back-btn" style={{ alignSelf: 'flex-start', marginBottom: 18 }} onClick={() => nav(-1)}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IcBack size={20} /> {t('common.back')}
        </span>
      </button>

      <div className="header">
        <h1 className="h1">{t('loginHistory.title')}</h1>
        <p className="sub">{t('loginHistory.sub')}</p>
      </div>

      {status === 'ready' && (
        <button
          className="btn btn--ghost btn--sm"
          style={{ marginBottom: 18 }}
          onClick={logoutOtherDevices}
          disabled={logoutOthersBusy}
        >
          {t('loginHistory.logoutOthers')}
        </button>
      )}

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
            {items.map((it) => {
              const device = describeUserAgent(it.user_agent);
              return (
                <div key={it.id} className="card-item glass">
                  <p className="ci-q">{formatDate(it.created_at)}</p>
                  <div className="ci-meta" style={{ flexWrap: 'wrap' }}>
                    <span className="tag">{methodLabel(it.method)}</span>
                    {device && <span className="tag">{device}</span>}
                    {it.id === currentId && <span className="tag">{t('loginHistory.thisDevice')}</span>}
                  </div>
                  <div className="row-between" style={{ marginTop: 10 }}>
                    {it.revoked_at ? (
                      <span className="faint">{t('loginHistory.revoked')}</span>
                    ) : (
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => logoutDevice(it)}
                        disabled={busyId === it.id}
                      >
                        {t('loginHistory.logoutDevice')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
