import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import { useToast } from '../components/ui.jsx';
import { IcBack, IcCheck } from '../components/icons.jsx';

const COLORS = ['#f43f5e', '#fb923c', '#eab308', '#34d399', '#38bdf8', '#a78bfa', '#f472b6'];

export default function Answer() {
  const nav = useNavigate();
  const loc = useLocation();
  const { user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();

  const q = loc.state?.question;
  const savedId = loc.state?.savedId || null;
  const preset = loc.state?.answers;

  const partnerDefault = t('answer.partnerDefault');
  const [turn, setTurn] = useState('me'); // me | partner
  const [myAnswer, setMyAnswer] = useState(preset?.my_answer || '');
  const [partnerAnswer, setPartnerAnswer] = useState(preset?.partner_answer || '');
  const [partnerName, setPartnerName] = useState(
    preset?.partner_name || user?.partner_name || partnerDefault,
  );
  const [partnerColor, setPartnerColor] = useState(
    preset?.partner_color || user?.partner_color || '#f43f5e',
  );
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

  const myName = user?.nickname || t('answer.we');
  const pName = partnerName || partnerDefault;

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
        partner_name: partnerName,
        partner_color: partnerColor,
        saved_id: savedId,
      });
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
      <button className="link" style={{ alignSelf: 'flex-start', marginBottom: 14 }} onClick={() => nav(-1)}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IcBack size={18} /> {t('common.back')}
        </span>
      </button>

      <div className="glass glass--red" style={{ padding: 22, marginBottom: 18 }}>
        <p style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.5, textAlign: 'center' }}>{q.text}</p>
      </div>

      {/* turn toggle — one device, take turns */}
      <div className="turn-tabs">
        <button
          className="turn-tab"
          style={turn === 'me' ? { background: 'var(--red)', borderColor: 'transparent' } : {}}
          onClick={() => setTurn('me')}
        >
          <span className="turn-dot" style={{ background: '#fff' }} />
          {user?.nickname || t('answer.us')}
        </button>
        <button
          className="turn-tab"
          style={turn === 'partner' ? { background: partnerColor, borderColor: 'transparent' } : {}}
          onClick={() => setTurn('partner')}
        >
          <span className="turn-dot" style={{ background: partnerColor }} />
          {pName}
        </button>
      </div>

      {turn === 'me' ? (
        <div className="field fade-up">
          <label>{t('answer.myAnswerOf', { name: myName })}</label>
          <textarea
            className="textarea"
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
            className="textarea"
            placeholder={t('answer.partnerPh', { name: pName })}
            value={partnerAnswer}
            onChange={(e) => setPartnerAnswer(e.target.value)}
            autoFocus
          />

          <div className="field" style={{ marginTop: 10 }}>
            <label>{t('answer.partnerName')}</label>
            <input
              className="input"
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
              placeholder={t('answer.partnerNamePh')}
              maxLength={30}
            />
          </div>
          <label style={{ fontSize: 14, color: 'var(--text-dim)', paddingLeft: 4 }}>
            {t('answer.color')}
          </label>
          <div className="color-swatches" style={{ marginTop: 8 }}>
            {COLORS.map((c) => (
              <button
                key={c}
                className={`swatch ${partnerColor === c ? 'sel' : ''}`}
                style={{ background: c }}
                onClick={() => setPartnerColor(c)}
                aria-label={c}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-a stack" style={{ marginTop: 24 }}>
        <button className="btn btn--primary" onClick={save} disabled={busy}>
          {busy ? t('answer.saving') : t('answer.save')}
        </button>
      </div>
    </div>
  );
}
