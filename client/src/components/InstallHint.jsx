import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Share, SquarePlus, EllipsisVertical, X } from 'lucide-react';
import { useI18n } from '../store/i18n.jsx';
import { useTutorial } from '../store/tutorial.jsx';

// Adding DeePer to the phone's home screen: it then opens full screen in
// one tap, like an app (manifest.webmanifest, the apple-mobile-web-app tags
// in index.html). Two ways in: a small card above the bottom nav for people
// on a phone who haven't added it yet, and a row on the profile page that
// opens the same how-to whenever they like.

// Chrome / Android offer their own install prompt; it fires once, early,
// so it's caught here at load and kept for when someone taps "Install".
let deferredPrompt = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
  });
}

export function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
  );
}

function isIOS() {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac, but a Mac has no touch screen.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

const HIDE_KEY = 'deeper-install-hint-off';
const HIDE_DAYS = 21;
const SHOW_AFTER_MS = 12000;

function hiddenForNow() {
  try {
    const at = Number(localStorage.getItem(HIDE_KEY));
    return at && Date.now() - at < HIDE_DAYS * 864e5;
  } catch {
    return true;
  }
}

// The how-to itself: steps for the phone in hand, or the browser's own
// install button where there is one.
export function InstallGuide({ onClose }) {
  const { t } = useI18n();
  const closeRef = useRef(null);
  const [canPrompt, setCanPrompt] = useState(!!deferredPrompt);
  const ios = isIOS();
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const install = async () => {
    const p = deferredPrompt;
    if (!p) return setCanPrompt(false);
    p.prompt();
    const { outcome } = await p.userChoice;
    deferredPrompt = null;
    if (outcome === 'accepted') onClose();
    else setCanPrompt(false);
  };
  const steps = ios
    ? [
        [Share, t('install.ios1')],
        [SquarePlus, t('install.ios2')],
        [null, t('install.ios3')],
      ]
    : [
        [EllipsisVertical, t('install.android1')],
        [SquarePlus, t('install.android2')],
        [null, t('install.android3')],
      ];
  return (
    <div className="modal-overlay fade-in" onClick={onClose}>
      <div
        className="modal glass glass--red pop-in install-guide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-title"
        onClick={(e) => e.stopPropagation()}
      >
        <img className="install-icon" src="/icon-180.png" alt="" width="64" height="64" />
        <h3 className="modal-title" id="install-title">
          {t('install.title')}
        </h3>
        <p className="modal-msg">{t('install.sub')}</p>
        {canPrompt ? (
          <div className="modal-actions modal-actions--stacked">
            <button ref={closeRef} className="btn btn--ghost" onClick={onClose}>
              {t('install.later')}
            </button>
            <button className="btn btn--primary" onClick={install}>
              {t('install.now')}
            </button>
          </div>
        ) : (
          <>
            <ol className="install-steps">
              {steps.map(([Icon, text], i) => (
                <li key={i}>
                  <span className="install-step-n">{i + 1}</span>
                  <span className="install-step-text">
                    {text}
                    {Icon && (
                      <span className="install-step-ic" aria-hidden="true">
                        <Icon size={16} />
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
            <button ref={closeRef} className="btn btn--primary install-done" onClick={onClose}>
              {t('install.gotIt')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// The card above the bottom nav: only on a phone, only in the browser (not
// already opened from the home screen), not during the app tour, a little
// while after opening the app, and not again for three weeks once closed.
// Never on the deck: there it would sit over the skip / save / answer
// buttons, so it waits for the other tabs.
export default function InstallHint() {
  const { t } = useI18n();
  const tutorial = useTutorial();
  const { pathname } = useLocation();
  const [show, setShow] = useState(false);
  const [guide, setGuide] = useState(false);
  useEffect(() => {
    if (!window.matchMedia('(pointer: coarse)').matches || isStandalone() || hiddenForNow()) return undefined;
    const id = setTimeout(() => setShow(true), SHOW_AFTER_MS);
    return () => clearTimeout(id);
  }, []);
  const dismiss = () => {
    try {
      localStorage.setItem(HIDE_KEY, String(Date.now()));
    } catch {
      /* private mode: it just shows again next time */
    }
    setShow(false);
  };
  if (guide) {
    return (
      <InstallGuide
        onClose={() => {
          setGuide(false);
          dismiss();
        }}
      />
    );
  }
  if (!show || tutorial.active || pathname === '/app/home') return null;
  return (
    <div className="install-hint glass pop-in" role="region" aria-label={t('install.title')}>
      <img src="/icon-180.png" alt="" width="40" height="40" />
      <button type="button" className="install-hint-main" onClick={() => setGuide(true)}>
        <b>{t('install.hint')}</b>
        <span>{t('install.hintSub')}</span>
      </button>
      <button type="button" className="install-hint-close" onClick={dismiss} aria-label={t('install.close')}>
        <X size={18} />
      </button>
    </div>
  );
}
