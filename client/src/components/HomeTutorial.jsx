import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useI18n } from '../store/i18n.jsx';
import { IcBookmark, IcCheck, IcHome, IcHistory, IcUser, IcX } from './icons.jsx';

const STEPS = ['cats', 'deck', 'actions', 'add', 'nav'];
const PAD = 10;
const GAP = 16;
const EDGE = 16;

function clamp(v, lo, hi) {
  return Math.min(Math.max(v, lo), hi);
}

function useTargetRect(selector) {
  const [rect, setRect] = useState(null);

  useEffect(() => {
    const measure = () => {
      const el = document.querySelector(selector);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    const id = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [selector]);

  return rect;
}

export default function HomeTutorial({ onDone }) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const id = STEPS[step];
  const rect = useTargetRect(`[data-tut="${id}"]`);
  const isLast = step === STEPS.length - 1;
  const tipRef = useRef(null);
  const [tipH, setTipH] = useState(150);

  useLayoutEffect(() => {
    if (tipRef.current) setTipH(tipRef.current.offsetHeight);
  }, [id, rect]);

  useEffect(() => {
    const onResize = () => tipRef.current && setTipH(tipRef.current.offsetHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const next = () => (isLast ? onDone() : setStep((s) => s + 1));

  const spot = rect && {
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  };

  let tipTop = null;
  if (spot) {
    const below = spot.top + spot.height + GAP;
    const above = spot.top - GAP - tipH;
    const fitsBelow = below + tipH + EDGE <= window.innerHeight;
    tipTop = clamp(fitsBelow ? below : above, EDGE, window.innerHeight - tipH - EDGE);
  }

  return (
    <div className="tut-overlay">
      {spot && (
        <div
          className="tut-spot"
          style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
        />
      )}

      {spot && (
        <div
          ref={tipRef}
          key={id}
          className="tut-tip glass glass--red"
          style={{ top: tipTop, left: '50%', transform: 'translateX(-50%)' }}
        >
          <p className="tut-tip-title">{t(`tut.${id}Title`)}</p>
          <p className="tut-tip-desc">{t(`tut.${id}Desc`)}</p>
          {id === 'actions' && (
            <div className="tut-icon-row">
              <span>
                <IcX size={16} /> {t('home.aSkip')}
              </span>
              <span>
                <IcBookmark size={16} /> {t('home.aSave')}
              </span>
              <span>
                <IcCheck size={16} /> {t('home.aAnswer')}
              </span>
            </div>
          )}
          {id === 'nav' && (
            <div className="tut-icon-row">
              <span>
                <IcHome size={16} /> {t('nav.home')}
              </span>
              <span>
                <IcBookmark size={16} /> {t('nav.saved')}
              </span>
              <span>
                <IcHistory size={16} /> {t('nav.history')}
              </span>
              <span>
                <IcUser size={16} /> {t('nav.profile')}
              </span>
            </div>
          )}
          <div className="tut-tip-foot">
            <div className="tut-dots">
              {STEPS.map((s, i) => (
                <span key={s} className={i === step ? 'on' : ''} />
              ))}
            </div>
            <button className="btn btn--primary btn--sm" onClick={next}>
              {isLast ? t('tut.done') : t('tut.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
