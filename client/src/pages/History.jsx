import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import { useTutorial } from '../store/tutorial.jsx';
import { Loading, ErrorState, EmptyState, useToast, useConfirm } from '../components/ui.jsx';
import CatFilter from '../components/CatFilter.jsx';
import { catLabel, formatDate } from '../util.js';
import { IcTrash, IcHistory, IcSparkle } from '../components/icons.jsx';

// SQLite stores "YYYY-MM-DD HH:MM:SS" in UTC — same parsing convention as
// formatDate in util.js.
const daysSince = (createdAt) => (Date.now() - new Date(createdAt.replace(' ', 'T') + 'Z')) / 86400000;

const dayOfYear = (d) => Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);

// Picks one past entry to resurface as "on this day"-style memory: prefer
// whichever came back near exactly a year/month/week ago (closest match
// within a tolerance), falling back to any entry at least a week old.
// The fallback picks by day-of-year modulo the candidate count rather than
// Math.random(), so it stays the same across reloads within a day instead
// of jumping around every time the page is revisited.
function pickMemory(items) {
  if (!items.length) return null;
  const withAge = items.map((it) => ({ it, days: daysSince(it.created_at) }));

  const closestNear = (targetDays, tolerance) =>
    withAge
      .filter(({ days }) => Math.abs(days - targetDays) <= tolerance)
      .sort((a, b) => Math.abs(a.days - targetDays) - Math.abs(b.days - targetDays))[0]?.it;

  const nearAnniversary = closestNear(365, 5) || closestNear(30, 4) || closestNear(7, 2);
  if (nearAnniversary) return nearAnniversary;

  const old = withAge.filter(({ days }) => days >= 7).map(({ it }) => it);
  if (!old.length) return null;
  return old[dayOfYear(new Date()) % old.length];
}

function memoryRelativeLabel(t, createdAt) {
  const days = daysSince(createdAt);
  const years = Math.round(days / 365);
  if (years >= 1 && Math.abs(days - years * 365) <= 5) {
    return t(years === 1 ? 'history.memoryYearAgo' : 'history.memoryYearsAgo', { n: years });
  }
  const months = Math.round(days / 30);
  if (months >= 1 && Math.abs(days - months * 30) <= 4) {
    return t(months === 1 ? 'history.memoryMonthAgo' : 'history.memoryMonthsAgo', { n: months });
  }
  const wholeDays = Math.round(days);
  return t(wholeDays === 1 ? 'history.memoryDayAgo' : 'history.memoryDaysAgo', { n: wholeDays });
}

export default function History() {
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const { t } = useI18n();
  const tutorial = useTutorial();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const [catFilter, setCatFilter] = useState('all');
  const memory = useMemo(() => pickMemory(items), [items]);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const d = await api.get('/history');
      setItems(d.history);
      setStatus(d.history.length ? 'ready' : 'empty');
      tutorial.setHistoryHasItems(d.history.length > 0);
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
    // See Saved.jsx's load() for why this depends on the setter directly
    // rather than the whole `tutorial` object.
  }, [tutorial.setHistoryHasItems]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (e, id) => {
    e.stopPropagation();
    const ok = await confirm({ message: t('confirm.historyMsg') });
    if (!ok) return;
    try {
      await api.del(`/history/${id}`);
      setItems((prev) => prev.filter((x) => x.id !== id));
      toast(t('history.removed'));
    } catch (e2) {
      toast(e2.message);
    }
  };

  const filtered = catFilter === 'all' ? items : items.filter((it) => it.category === catFilter);

  return (
    <div className="page page--tab stagger">
      <div className="header" data-tut="historyIntro">
        <h1 className="h1">{t('history.title')}</h1>
        <p className="sub">{t('history.sub')}</p>
      </div>

      {status === 'loading' && <Loading />}
      {status === 'error' && <ErrorState message={error} onRetry={load} />}
      {status === 'empty' && (
        <EmptyState
          icon={<IcHistory size={44} />}
          title={t('history.emptyTitle')}
          subtitle={t('history.emptySub')}
          action={
            <button
              className="btn btn--primary btn--sm"
              style={{ marginTop: 8 }}
              onClick={() => nav('/app/home')}
            >
              {t('history.start')}
            </button>
          }
        />
      )}

      {status === 'ready' && memory && (
        <div className="card-item glass glass--red" style={{ marginBottom: 16 }}>
          <div className="ci-meta" style={{ marginBottom: 6 }}>
            <IcSparkle size={14} />
            <span className="tag">{t('history.memoryEyebrow')}</span>
            <span>{memoryRelativeLabel(t, memory.created_at)}</span>
          </div>
          <p className="ci-q">{memory.question_text}</p>
          {memory.my_answer && (
            <div className="answer-block" style={{ borderLeftColor: 'var(--red)' }}>
              <div className="ab-name" style={{ color: 'var(--red-bright)' }}>
                {user?.nickname || t('answer.we')}
              </div>
              <div className="ab-text">{memory.my_answer}</div>
            </div>
          )}
          {memory.partner_answer && (
            <div className="answer-block" style={{ borderLeftColor: memory.partner_color || 'var(--red)' }}>
              <div className="ab-name" style={{ color: memory.partner_color || 'var(--red-bright)' }}>
                {memory.partner_name || t('answer.partnerDefault')}
              </div>
              <div className="ab-text">{memory.partner_answer}</div>
            </div>
          )}
        </div>
      )}

      {status === 'ready' && <CatFilter value={catFilter} onChange={setCatFilter} />}

      {status === 'ready' && filtered.length === 0 && (
        <p className="sub" style={{ marginTop: 24, textAlign: 'center' }}>
          {t('history.emptyFilter')}
        </p>
      )}

      {status === 'ready' && filtered.length > 0 && (
        <div className="list stagger">
          {filtered.map((it, index) => {
            const isOpen = open === it.id;
            return (
              <div
                key={it.id}
                className="card-item glass"
                // Anchor for the tour's "here's a real history entry" step —
                // only the first card (see historyItem in OnboardingTour.jsx).
                data-tut={index === 0 ? 'historyItem' : undefined}
                onClick={() => setOpen(isOpen ? null : it.id)}
              >
                <p className="ci-q">{it.question_text}</p>
                <div className="ci-meta">
                  <span className="tag">{catLabel(it.category)}</span>
                  <span>{formatDate(it.created_at)}</span>
                  <button className="icon-del" onClick={(e) => remove(e, it.id)} aria-label="delete">
                    <IcTrash size={18} />
                  </button>
                </div>

                {isOpen && (
                  <div className="fade-up">
                    {it.my_answer && (
                      <div className="answer-block" style={{ borderLeftColor: 'var(--red)' }}>
                        <div className="ab-name" style={{ color: 'var(--red-bright)' }}>
                          {user?.nickname || t('answer.we')}
                        </div>
                        <div className="ab-text">{it.my_answer}</div>
                      </div>
                    )}
                    {it.partner_answer && (
                      <div
                        className="answer-block"
                        style={{ borderLeftColor: it.partner_color || 'var(--red)' }}
                      >
                        <div
                          className="ab-name"
                          style={{ color: it.partner_color || 'var(--red-bright)' }}
                        >
                          {it.partner_name || t('answer.partnerDefault')}
                        </div>
                        <div className="ab-text">{it.partner_answer}</div>
                      </div>
                    )}
                    {!it.my_answer && !it.partner_answer && (
                      <p className="faint" style={{ marginTop: 10 }}>
                        {t('history.noAnswers')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
