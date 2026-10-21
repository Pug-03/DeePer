import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { getCachedList, setCachedList, fetchList } from '../utils/listCache.js';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import { displayName, questionText, partnerLabel } from '../util.js';
import { useToast } from '../components/ui.jsx';
import { IcBack, IcCheck } from '../components/icons.jsx';

export default function Answer() {
  const nav = useNavigate();
  const loc = useLocation();
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const toast = useToast();

  const q = loc.state?.question;
  const savedId = loc.state?.savedId || null;
  const preset = loc.state?.answers;

  const partnerDefault = t('answer.partnerDefault');
  const [turn, setTurn] = useState(loc.state?.turn || 'me'); // me | partner
  const [myAnswer, setMyAnswer] = useState(preset?.my_answer || '');
  const [partnerAnswer, setPartnerAnswer] = useState(preset?.partner_answer || '');
  // Each category has its own partner (set in Profile, not here) — look it
  // up by this question's own category rather than a single global slot.
  const partner = user?.partners?.[q?.category];
  // Partner's name is edited in Profile, not here — see Profile.jsx.
  // Stored as is; shown through partnerLabel so the default reads in the
  // current language.
  const partnerName = preset?.partner_name || partner?.name || '';
  // Color is set once in Profile, not per-answer here — see Profile.jsx.
  const partnerColor = preset?.partner_color || partner?.color || '#a78bfa';
  const [busy, setBusy] = useState(false);

  if (!q) {
    return (
      <div className="page stagger">
        <p className="sub">{t('answer.notFound')}</p>
        <button className="btn btn--ghost" onClick={() => nav('/app/home')}>
          {t('answer.backHome')}
        </button>
      </div>
    );
  }

  const myName = displayName(user, lang) || t('answer.we');
  const pName = partnerLabel(partnerName, t);

  const save = async () => {
    if (!myAnswer.trim() && !partnerAnswer.trim()) {
      toast(t('answer.needOne'));
      return;
    }
    setBusy(true);
    try {
      await api.post('/history', {
        question_text: q.text,
        category: q.category,
        my_answer: myAnswer,
        partner_answer: partnerAnswer,
        partner_name: partnerName || partnerDefault,
        partner_color: partnerColor,
        saved_id: savedId,
      });
      // Saved and History show the change on the next tap, not after a refresh.
      if (savedId) {
        const saved = getCachedList(user?.id, 'saved');
        if (saved) setCachedList(user?.id, 'saved', saved.filter((x) => x.id !== savedId));
      }
      fetchList(user?.id, 'history', { fresh: true }).catch(() => {});
      toast(
        <>
          <IcCheck size={16} /> {t('answer.saved')}
        </>,
      );
      nav('/app/home', { replace: true });
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page stagger">
      <button className="link back-btn" style={{ alignSelf: 'flex-start', marginBottom: 14 }} onClick={() => nav(-1)}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IcBack size={20} /> {t('common.back')}
        </span>
      </button>

      <div className="glass glass--red" style={{ padding: 22, marginBottom: 18 }}>
        <p style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.5, textAlign: 'center' }}>{questionText(q.text, q.text_en, lang)}</p>
      </div>

      {/* turn toggle — one device, take turns */}
      <div className="turn-tabs">
        <button
          className={`turn-tab ${turn === 'me' ? 'active' : ''}`}
          style={turn === 'me' ? { background: 'var(--red)' } : {}}
          onClick={() => setTurn('me')}
        >
          <span className="turn-dot" style={{ background: '#fff' }} />
          {displayName(user, lang) || t('answer.us')}
          {/* A tick once that person has written something. */}
          {myAnswer.trim() && <IcCheck size={14} />}
        </button>
        <button
          className={`turn-tab ${turn === 'partner' ? 'active' : ''}`}
          style={turn === 'partner' ? { background: partnerColor } : {}}
          onClick={() => setTurn('partner')}
        >
          <span className="turn-dot" style={{ background: partnerColor }} />
          {pName}
          {partnerAnswer.trim() && <IcCheck size={14} />}
        </button>
      </div>

      {turn === 'me' ? (
        <div className="field fade-up">
          <label>{t('answer.myAnswerOf', { name: myName })}</label>
          <textarea
            className="textarea answer-textarea"
            placeholder={t('answer.myAnswerPh')}
            value={myAnswer}
            onChange={(e) => setMyAnswer(e.target.value)}
            autoFocus
          />
          <button
            className="btn btn--ghost btn--sm"
            style={{ width: '100%', marginTop: 4 }}
            onClick={() => setTurn('partner')}
          >
            {t('answer.turnTo', { name: pName })}
          </button>
        </div>
      ) : (
        <div className="field fade-up">
          <label>{t('answer.myAnswerOf', { name: pName })}</label>
          <textarea
            className="textarea answer-textarea"
            placeholder={t('answer.partnerPh', { name: pName })}
            value={partnerAnswer}
            onChange={(e) => setPartnerAnswer(e.target.value)}
            autoFocus
          />

          {/* The name is already on the tab; just say where to change it
              (a read-only name box here looked like a broken field). */}
          <button
            type="button"
            className="link"
            style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 6, alignSelf: 'flex-start' }}
            onClick={() => {
              // Keep what's been typed: written into this page's own history
              // entry, so Back from the partner page brings both answers back.
              nav(loc.pathname, {
                replace: true,
                state: { ...loc.state, turn: 'partner', answers: { ...preset, my_answer: myAnswer, partner_answer: partnerAnswer } },
              });
              nav('/app/profile/partner');
            }}
          >
            {t('answer.partnerNameHint')}
          </button>
        </div>
      )}

      {/* Sits right under the answer field (its 16px margin is the only gap)
          instead of being pushed down with extra space above it. */}
      <div className="stack">
        <button className="btn btn--primary" onClick={save} disabled={busy}>
          {busy ? t('answer.saving') : t('answer.save')}
        </button>
      </div>
    </div>
  );
}
