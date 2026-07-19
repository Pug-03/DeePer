import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useI18n } from '../store/i18n.jsx';

// ---------- Loading / Empty / Error state views ----------
export function Loading({ label }) {
  const { t } = useI18n();
  return (
    <div className="state">
      <div className="spinner" />
      <p className="sub">{label || t('common.loading')}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  const { t } = useI18n();
  return (
    <div className="state fade-up">
      <div className="s-emoji">😢</div>
      <p className="h2">{t('common.error')}</p>
      <p className="sub">{message || t('common.errorSub')}</p>
      {onRetry && (
        <button className="btn btn--ghost btn--sm" onClick={onRetry} style={{ marginTop: 6 }}>
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}

export function EmptyState({ emoji = '🌱', title, subtitle, action }) {
  return (
    <div className="state fade-up">
      <div className="s-emoji">{emoji}</div>
      <p className="h2">{title}</p>
      {subtitle && <p className="sub">{subtitle}</p>}
      {action}
    </div>
  );
}

// ---------- Toast ----------
const ToastCtx = createContext(() => {});
export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null);
  const timer = useRef(null);
  const show = useCallback((text) => {
    setMsg(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <div className="toast fade-up">{msg}</div>}
    </ToastCtx.Provider>
  );
}

// ---------- Confirm dialog ----------
// Promise-based: `const ok = await confirm({ title, message, ... })`.
const ConfirmCtx = createContext(() => Promise.resolve(false));
export function useConfirm() {
  return useContext(ConfirmCtx);
}

export function ConfirmProvider({ children }) {
  const { t } = useI18n();
  const [state, setState] = useState(null); // { title, message, confirmText, danger, resolve }

  const confirm = useCallback(
    (opts = {}) => new Promise((resolve) => setState({ ...opts, resolve })),
    [],
  );

  const close = (result) => {
    state?.resolve(result);
    setState(null);
  };

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <div className="modal-overlay fade-in" onClick={() => close(false)}>
          <div className="modal glass glass--red pop-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-emoji">{state.emoji || '🗑️'}</div>
            <h3 className="modal-title">{state.title || t('confirm.deleteTitle')}</h3>
            {state.message && <p className="modal-msg">{state.message}</p>}
            <div className="modal-actions">
              <button className="btn btn--ghost" onClick={() => close(false)}>
                {state.cancelText || t('common.cancel')}
              </button>
              <button
                className={`btn ${state.danger === false ? 'btn--primary' : 'btn--danger'}`}
                onClick={() => close(true)}
              >
                {state.confirmText || t('confirm.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}
