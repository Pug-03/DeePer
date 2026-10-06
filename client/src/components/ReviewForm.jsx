import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useI18n } from '../store/i18n.jsx';
import { useToast } from './ui.jsx';
import { CATS } from '../util.js';

const MIN = 10;
const MAX = 200;

// "Review DeePer" card on the profile page. One review per user; saving
// (a new one or an edit) sends it to the admin, and it only appears on the
// landing page once approved.
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
    <div className="glass review-form" style={{ padding: 18, marginBottom: 14 }}>
      <h2 className="h2" style={{ marginBottom: 6, fontSize: 17 }}>
        {t('review.title')}
      </h2>
      {showForm ? (
        <>
          <p className="faint" style={{ margin: '0 0 14px' }}>
            {t('review.hint')}
          </p>
          <div className="filter-row" style={{ marginBottom: 12 }}>
            {CATS.map((c) => (
              <button key={c} type="button" className={`pill ${relation === c ? 'active' : ''}`} onClick={() => setRelation(c)}>
                {t(`review.with.${c}`)}
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
