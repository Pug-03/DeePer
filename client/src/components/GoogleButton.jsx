import { useEffect, useRef } from 'react';
import { IcGoogle } from './icons.jsx';

let gisPromise = null;
function loadGis() {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('โหลด Google Sign-In ไม่สำเร็จ'));
    document.head.appendChild(s);
  });
  return gisPromise;
}

/**
 * Google button styled to match the email `.method-btn` card.
 * The real Google button is rendered transparently on top of the card (the
 * click target), while the card underneath provides our own design.
 */
export default function GoogleButton({
  clientId,
  onCredential,
  label = 'ดำเนินการต่อด้วย Google',
  sub = 'ปลอดภัย ไม่ต้องตั้งรหัสผ่าน',
}) {
  const cardRef = useRef(null);
  const hitRef = useRef(null);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    loadGis()
      .then(() => {
        if (cancelled || !hitRef.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (resp) => onCredential(resp.credential),
        });
        const w = Math.min(400, Math.max(220, cardRef.current?.clientWidth || 320));
        hitRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(hitRef.current, {
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          width: w,
          locale: 'th',
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [clientId, onCredential]);

  return (
    <div className="method-btn gbtn" ref={cardRef}>
      <span className="m-ic">
        <IcGoogle />
      </span>
      <span>
        <div className="m-title">{label}</div>
        <div className="m-sub">{sub}</div>
      </span>
      {/* transparent real Google button covering the whole card */}
      <div className="gbtn-hit" ref={hitRef} aria-hidden="false" />
    </div>
  );
}
