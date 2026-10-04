import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import { useToast } from '../components/ui.jsx';
import { IcBack, IcAlertCircle, IcCamera, IcCheck } from '../components/icons.jsx';

const CATEGORIES = ['bug', 'problem', 'idea'];

// Bug / problem / idea report — open to guests (from the Welcome page) and
// signed-in users (from Profile). Signed-in reports are tied to the account
// server-side, so only guests are asked how to reach them.
export default function Report() {
  const nav = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();

  const [category, setCategory] = useState('bug');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [shotFile, setShotFile] = useState(null);
  const [shotPreview, setShotPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const onShot = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setShotPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
    setShotFile(f);
  };

  const canSubmit = message.trim().length >= 5;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('category', category);
      fd.append('message', message.trim());
      if (!user && contact.trim()) fd.append('contact', contact.trim());
      // Where the reporter came from, so the maintainer knows which screen.
      if (location.state?.from) fd.append('page', location.state.from);
      if (shotFile) fd.append('screenshot', shotFile);
      await api.upload('/reports', fd);
      if (shotPreview) URL.revokeObjectURL(shotPreview);
      setSent(true);
    } catch (e2) {
      toast(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page stagger">
      <button className="link back-btn" style={{ alignSelf: 'flex-start', marginBottom: 18 }} onClick={() => nav(-1)}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IcBack size={20} /> {t('common.back')}
        </span>
      </button>

      <div className="center header">
        <h1 className="h1">{t('report.title')}</h1>
        <p className="sub">{t('report.msg')}</p>
      </div>

      {sent ? (
        <div className="glass support-card report-done">
          <span className="report-done-ic">
            <IcCheck size={26} />
          </span>
          <p className="report-done-title">{t('report.doneTitle')}</p>
          <p className="support-proof-desc">{t('report.doneMsg')}</p>
          <button className="btn btn--ghost" type="button" onClick={() => nav(-1)}>
            {t('common.back')}
          </button>
        </div>
      ) : (
        <div className="glass support-card">
          <div className="support-head">
            <span className="support-head-ic">
              <IcAlertCircle size={18} />
            </span>
            <span className="support-head-title">{t('report.formTitle')}</span>
          </div>

          <form className="support-proof-form" onSubmit={submit}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>{t('report.category')}</label>
              <div className="filter-row" style={{ marginBottom: 0 }}>
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`pill ${category === c ? 'active' : ''}`}
                    onClick={() => setCategory(c)}
                  >
                    {t(`report.cat.${c}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="report-msg">{t('report.message')}</label>
              <textarea
                id="report-msg"
                className="textarea"
                maxLength={2000}
                placeholder={t(`report.messagePh.${category}`)}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </div>

            <div className="field" style={{ marginBottom: 0 }}>
              <label>{t('report.screenshot')}</label>
              <label className="slip-drop">
                <input type="file" accept="image/*" hidden onChange={onShot} />
                {shotPreview ? (
                  <img className="slip-preview" src={shotPreview} alt={t('report.screenshot')} />
                ) : (
                  <span className="slip-drop-cta">
                    <IcCamera size={22} />
                    {t('report.attach')}
                  </span>
                )}
              </label>
            </div>

            {!user && (
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="report-contact">{t('report.contact')}</label>
                <input
                  id="report-contact"
                  className="input"
                  type="text"
                  maxLength={120}
                  placeholder={t('report.contactPh')}
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                />
              </div>
            )}

            <button className="btn btn--primary" type="submit" disabled={!canSubmit || busy}>
              {busy ? t('report.submitting') : t('report.submit')}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
