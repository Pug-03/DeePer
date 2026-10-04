import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import CheckBadge, { rise } from '../components/CheckBadge.jsx';
import { api } from '../api.js';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import { useToast } from '../components/ui.jsx';
import { IcBack, IcAlertCircle, IcCamera } from '../components/icons.jsx';

const CATEGORIES = ['idea', 'bug', 'problem'];

// Bug / problem / idea report — open to guests (from the Welcome page) and
// signed-in users (from Profile). Signed-in reports are tied to the account
// server-side, so only guests are asked how to reach them.
export default function Report() {
  const nav = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();

  const [category, setCategory] = useState(CATEGORIES[0]);
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

  const startOver = () => {
    setMessage('');
    setContact('');
    setShotFile(null);
    setShotPreview('');
    setSent(false);
  };

  // Sent: same animated check + rise-in as the post-login welcome screen.
  if (sent)
    return (
      <div className="page center" style={{ justifyContent: 'center', flex: 1 }}>
        <CheckBadge />
        <motion.h1 className="h1" {...rise(1.05)}>
          {t('report.doneTitle')}
        </motion.h1>
        <motion.p className="sub" style={{ maxWidth: 320, marginInline: 'auto' }} {...rise(1.2)}>
          {t('report.doneMsg')}
        </motion.p>
        <div className="stack" style={{ marginTop: 36 }}>
          <motion.div {...rise(1.38)}>
            <button className="btn btn--primary" type="button" onClick={() => nav(-1)}>
              {t('common.back')}
            </button>
          </motion.div>
          <motion.div {...rise(1.53)}>
            <button className="btn btn--ghost" type="button" onClick={startOver}>
              {t('report.again')}
            </button>
          </motion.div>
        </div>
      </div>
    );

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
    </div>
  );
}
