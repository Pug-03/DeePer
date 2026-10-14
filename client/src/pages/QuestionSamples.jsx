import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import { Loading } from '../components/ui.jsx';
import { IcBack } from '../components/icons.jsx';
import { CATS, questionText } from '../util.js';

const LEVELS = ['open', 'mid', 'deep'];

// Public sample questions, open to guests: /questions lists the categories,
// /questions/:category shows a fixed sample from that category. These are
// the pages people land on from a search, so each ends in a sign-up
// button. The server writes the same list into the HTML for crawlers (see
// server/src/seo.js).
export default function QuestionSamples() {
  const { category } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [questions, setQuestions] = useState(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const valid = !category || CATS.includes(category);

  useEffect(() => {
    if (!category || !valid) return;
    setQuestions(null);
    setFailed(false);
    api
      .get(`/questions/samples/${category}`, { auth: false })
      .then((d) => setQuestions(d.questions))
      .catch(() => setFailed(true));
  }, [category, valid, attempt]);

  useEffect(() => {
    document.title = `${category ? t(`samples.title.${category}`) : t('samples.hubTitle')} | DeePer`;
  }, [category, t]);

  if (!valid) return <Navigate to="/questions" replace />;

  // Opened straight from a search result there's no app page to go back to.
  const goBack = () => (location.key !== 'default' ? nav(-1) : nav('/', { replace: true }));
  const others = CATS.filter((c) => c !== category);

  return (
    <div className="page stagger">
      <button className="link back-btn" style={{ alignSelf: 'flex-start', marginBottom: 18 }} onClick={goBack}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IcBack size={20} /> {t('common.back')}
        </span>
      </button>

      <div className="header">
        <h1 className="h1">{category ? t(`samples.title.${category}`) : t('samples.hubTitle')}</h1>
        <p className="sub">{category ? t(`samples.intro.${category}`) : t('samples.hubSub')}</p>
      </div>

      {category && failed && (
        <div className="glass samples-card samples-error">
          <p>{t('common.netError')}</p>
          <button className="btn btn--ghost btn--sm" type="button" onClick={() => setAttempt((n) => n + 1)}>
            {t('common.retry')}
          </button>
        </div>
      )}

      {category &&
        !failed &&
        (questions === null ? (
          <Loading />
        ) : (
          LEVELS.map((level) => {
            const items = questions.filter((q) => q.level === level);
            if (!items.length) return null;
            return (
              <section key={level} className="glass samples-card">
                <h2 className="samples-level">{t('samples.level', { level: t(`home.level.${level}`) })}</h2>
                <ol className="samples-list">
                  {items.map((q) => (
                    <li key={q.text}>{questionText(q.text, q.text_en, lang)}</li>
                  ))}
                </ol>
              </section>
            );
          })
        ))}

      {/* On the hub the categories come first (as rows, like Profile's), the
          sign-up button after; on a category page it's the other way round. */}
      {category && (
        <button className="btn btn--primary samples-cta" type="button" onClick={() => nav(user ? '/app/home' : '/signup')}>
          {user ? t('samples.ctaSignedIn') : t('samples.cta')}
        </button>
      )}

      {category && <p className="samples-others-title">{t('samples.others')}</p>}
      <div className="glass samples-cats">
        {(category ? others : CATS).map((c) => (
          <Link key={c} className="samples-cat-row" to={`/questions/${c}`} style={{ '--cat': `var(--cat-${c})` }}>
            <span className="samples-cat-dot" />
            <span className="samples-cat-text">
              <span className="samples-cat-name">{t(`cat.${c}`)}</span>
              <span className="samples-cat-sub">{t(`samples.title.${c}`)}</span>
            </span>
            <ChevronRight size={18} className="samples-cat-chev" />
          </Link>
        ))}
      </div>

      {!category && (
        <button className="btn btn--primary samples-cta samples-cta--after" type="button" onClick={() => nav(user ? '/app/home' : '/signup')}>
          {user ? t('samples.ctaSignedIn') : t('samples.cta')}
        </button>
      )}
    </div>
  );
}
