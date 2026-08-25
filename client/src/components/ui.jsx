import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useI18n } from '../store/i18n.jsx';
import { IcAlertCircle, IcSeedling, IcTrash } from './icons.jsx';

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
      <div className="s-icon">
        <IcAlertCircle size={44} />
      </div>
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

export function EmptyState({ icon = <IcSeedling size={44} />, title, subtitle, action }) {
  return (
    <div className="state fade-up">
      <div className="s-icon">{icon}</div>
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
  const modalRef = useRef(null);
  const cancelBtnRef = useRef(null);

  const confirm = useCallback(
    (opts = {}) => new Promise((resolve) => setState({ ...opts, resolve })),
    [],
  );

  const close = (result) => {
    state?.resolve(result);
    setState(null);
  };

  // Every useConfirm() caller in the app shares this one dialog, so fixing
  // keyboard behavior here (focus on open, Escape to dismiss, Tab trapped
  // between the two buttons) covers all of them at once — including the
  // add-question dialog on Home, where arrow-key deck shortcuts underneath
  // used to leak through because nothing here ever took focus.
  useEffect(() => {
    if (!state) return;
    cancelBtnRef.current?.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        close(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = modalRef.current?.querySelectorAll('button');
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <div className="modal-overlay fade-in" onClick={() => close(false)}>
          <div
            ref={modalRef}
            className="modal glass glass--red pop-in"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-icon">{state.icon || <IcTrash size={36} />}</div>
            <h3 className="modal-title" id="confirm-modal-title">
              {state.title || t('confirm.deleteTitle')}
            </h3>
            {state.message && <p className="modal-msg">{state.message}</p>}
            <div className="modal-actions">
              <button ref={cancelBtnRef} className="btn btn--ghost" onClick={() => close(false)}>
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
