import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useI18n } from '../store/i18n.jsx';
import { useToast } from './ui.jsx';
import { CATS } from '../util.js';
import { IcChat } from './icons.jsx';

const MIN = 10;
const MAX = 200;

// The "Review DeePer" form, on its own page (pages/Review.jsx, opened from
// Profile). One review per user; saving (a new one or an edit) sends it to
// the admin, and it only appears on the landing page once approved.
export default function ReviewForm() {
  const { t } = useI18n();
  const toast = useToast();
  const [mine, setMine] = useState(undefined); // undefined = loading, null = none yet
  const [text, setText] = useState('');
  const [relation, setRelation] = useState(CATS[0]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get('/reviews/mine')
      .then((d) => {
        setMine(d.review);
        if (d.review) {
          setText(d.review.text);
          setRelation(d.review.relation);
        }
      })
      .catch(() => setMine(null));
  }, []);

  const len = text.trim().length;
  const submit = async () => {
    setBusy(true);
    try {
      const d = await api.post('/reviews/mine', { text, relation });
      setMine(d.review);
      setEditing(false);
      toast(t('review.sent'));
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (mine === undefined) return null;
  const showForm = !mine || editing;

  return (
    <div className="glass support-card review-form">
      <div className="support-head">
        <span className="support-head-ic">
          <IcChat size={18} />
        </span>
        <span className="support-head-title">{t('review.formTitle')}</span>
      </div>
      {showForm ? (
        <>
          {/* Short deck names (คู่รัก / เพื่อน ๆ / ครอบครัว) under one label, so
              all three fit on a single row like Home's category tabs. */}
          <label className="review-with-label">{t('review.withLabel')}</label>
          <div className="filter-row review-with" style={{ marginBottom: 12 }}>
            {CATS.map((c) => (
              <button key={c} type="button" className={`pill ${relation === c ? 'active' : ''}`} onClick={() => setRelation(c)}>
                {t(`cat.${c}`)}
              </button>
            ))}
          </div>
          <textarea
            className="textarea"
            placeholder={t('review.placeholder')}
            value={text}
            maxLength={MAX}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="review-form-foot">
            <span className={`faint ${len > 0 && len < MIN ? 'review-short' : ''}`}>
              {len}/{MAX}
            </span>
            <button className="btn btn--primary btn--sm" type="button" disabled={busy || len < MIN} onClick={submit}>
              {busy ? t('review.sending') : t('review.send')}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className={`review-status review-status--${mine.status}`}>{t(`review.status.${mine.status}`)}</p>
          <blockquote className="review-mine">“{mine.text}”</blockquote>
          <button className="btn btn--ghost btn--sm" type="button" onClick={() => setEditing(true)}>
            {t('review.edit')}
          </button>
        </>
      )}
    </div>
  );
}
