import { createContext, useContext, useState, useCallback, useRef } from 'react';

// ---------- Loading / Empty / Error state views ----------
export function Loading({ label = 'กำลังโหลด...' }) {
  return (
    <div className="state">
      <div className="spinner" />
      <p className="sub">{label}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="state fade-up">
      <div className="s-emoji">😢</div>
      <p className="h2">เกิดข้อผิดพลาด</p>
      <p className="sub">{message || 'ลองใหม่อีกครั้งนะ'}</p>
      {onRetry && (
        <button className="btn btn--ghost btn--sm" onClick={onRetry} style={{ marginTop: 6 }}>
          ลองอีกครั้ง
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
