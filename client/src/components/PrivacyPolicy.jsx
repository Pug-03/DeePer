import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck } from 'lucide-react';
import { useI18n } from '../store/i18n.jsx';
import { IcCheck } from './icons.jsx';
import { PRIVACY_POLICY } from '../utils/privacyPolicy.js';

// The full privacy policy text, in the app's language.
export function PrivacyPolicyBody() {
  const { lang } = useI18n();
  const p = PRIVACY_POLICY[lang] || PRIVACY_POLICY.th;
  return (
    <div className="privacy">
      <p className="privacy-updated">{p.updated}</p>
      <div className="privacy-intro">
        <span className="privacy-intro-ic" aria-hidden="true">
          <ShieldCheck size={18} />
        </span>
        <p>{p.intro}</p>
      </div>
      {p.sections.map((sec) => {
        // "3. Legal basis" → a number badge beside "Legal basis".
        const [, num, title] = sec.title.match(/^(\d+)\.\s*(.*)$/) || [null, null, sec.title];
        return (
          <section key={sec.title} className="privacy-section">
            <h2 className="privacy-h">
              {num && <span className="privacy-num">{num}</span>}
              {title}
            </h2>
            {sec.body.map((b, i) =>
              typeof b === 'string' ? (
                <p key={i}>{b}</p>
              ) : (
                <ul key={i}>
                  {b.list.map((li) => (
                    <li key={li}>{li}</li>
                  ))}
                </ul>
              ),
            )}
          </section>
        );
      })}
    </div>
  );
}

// "Read more" from the signup consent: the whole policy in a sheet over the
// form, so reading it doesn't leave signup and lose what's been typed.
// Accepting there ticks the consent box too.
// The sheet slides with plain CSS transitions on transform/opacity (see
// .privacy-overlay in styles.css), which the browser runs off the main
// thread. It used to mount the whole policy and start a framer-motion slide
// in the same frame, and lock page scrolling (a full-page re-layout) at the
// same moment — that first-frame work is what made it hitch opening and
// closing. Now it's rendered once, on first open, and kept; opening and
// closing only flip a class.
export function PrivacySheet({ open, onClose, onAccept }) {
  const { t, lang } = useI18n();
  const p = PRIVACY_POLICY[lang] || PRIVACY_POLICY.th;
  const [mounted, setMounted] = useState(false);
  // Shown a frame after mounting, so the slide-in has a start position.
  const [shown, setShown] = useState(false);
  // How far through the policy they've scrolled: a thin bar under the
  // title, and once they reach the end the accept button lights up with a
  // tick — a quiet nudge that it's been read, never a gate. The bar is set
  // straight on its element, so scrolling never re-renders the policy.
  const scrollRef = useRef(null);
  const barRef = useRef(null);
  const [finished, setFinished] = useState(false);
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    const read = max <= 0 ? 1 : Math.min(1, el.scrollTop / max);
    if (barRef.current) barRef.current.style.transform = `scaleX(${read})`;
    const done = read > 0.98;
    setFinished((f) => (f === done ? f : done));
  };

  useEffect(() => {
    if (open && !mounted) {
      setMounted(true);
      return undefined;
    }
    if (!open) {
      setShown(false);
      return undefined;
    }
    // Opening: back to the top, then slide in on the next frame.
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    if (barRef.current) barRef.current.style.transform = 'scaleX(0)';
    setFinished(false);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, mounted, onClose]);

  if (!mounted) return null;
  return createPortal(
    <div
      className={`privacy-overlay${shown ? ' is-open' : ''}`}
      onClick={onClose}
      aria-hidden={!shown}
    >
      <div
        className="share-sheet privacy-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={p.title}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="share-sheet-title">{p.title}</p>
        <div className="privacy-progress" aria-hidden="true">
          <span ref={barRef} />
        </div>
        <div className="privacy-sheet-scroll" ref={scrollRef} onScroll={onScroll}>
          <PrivacyPolicyBody />
        </div>
        <div className="privacy-sheet-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose} tabIndex={shown ? 0 : -1}>
            {t('common.close')}
          </button>
          <button
            type="button"
            className={`btn btn--primary privacy-accept${finished ? ' is-read' : ''}`}
            onClick={onAccept}
            tabIndex={shown ? 0 : -1}
          >
            {finished && (
              <span className="privacy-accept-tick" aria-hidden="true">
                <IcCheck size={18} />
              </span>
            )}
            {t('privacy.accept')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
