import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../api.js';
import { useI18n } from '../store/i18n.jsx';
import { useToast } from '../components/ui.jsx';
import CheckBadge, { rise } from '../components/CheckBadge.jsx';
import { IcBack, IcSparkle } from '../components/icons.jsx';

// "Become a sponsor" contact form, linked under the sponsor logos on the
// Welcome page. Open to anyone; the maintainer gets an email and sees it in
// the admin dashboard's sponsors tab.
export default function SponsorInquiry() {
  const nav = useNavigate();
  const { t } = useI18n();
  const toast = useToast();

  const [orgName, setOrgName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const canSubmit = orgName.trim() && contactName.trim() && contact.trim() && message.trim().length >= 5;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      await api.post(
        '/sponsor-inquiries',
        {
          org_name: orgName.trim(),
          contact_name: contactName.trim(),
          contact: contact.trim(),
          message: message.trim(),
        },
        { auth: false },
      );
      setSent(true);
    } catch (e2) {
      toast(e2.message);
    } finally {
      setBusy(false);
    }
  };

  if (sent)
    return (
      <div className="page center" style={{ justifyContent: 'center', flex: 1 }}>
        <CheckBadge />
        <motion.h1 className="h1" {...rise(1.05)}>
          {t('sponsorForm.doneTitle')}
        </motion.h1>
        <motion.p className="sub" style={{ maxWidth: 320, marginInline: 'auto', whiteSpace: 'pre-line' }} {...rise(1.2)}>
          {t('sponsorForm.doneMsg')}
        </motion.p>
        <motion.div style={{ marginTop: 36 }} {...rise(1.38)}>
          <button className="btn btn--primary" type="button" onClick={() => nav(-1)}>
            {t('common.back')}
          </button>
        </motion.div>
      </div>
    );

  return (
    <div className="page stagger form-page">
      <button className="link back-btn" style={{ alignSelf: 'flex-start', marginBottom: 18 }} onClick={() => nav(-1)}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IcBack size={20} /> {t('common.back')}
        </span>
      </button>

      <div className="center header">
        <h1 className="h1">{t('sponsorForm.title')}</h1>
        <p className="sub">{t('sponsorForm.msg')}</p>
      </div>

      <div className="glass support-card">
        <div className="support-head">
          <span className="support-head-ic">
            <IcSparkle size={18} />
          </span>
          <span className="support-head-title">{t('sponsorForm.formTitle')}</span>
        </div>

        <form className="support-proof-form" onSubmit={submit}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="sp-org">{t('sponsorForm.org')}</label>
            <input
              id="sp-org"
              className="input"
              maxLength={120}
              placeholder={t('sponsorForm.orgPh')}
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="sp-person">{t('sponsorForm.name')}</label>
            <input
              id="sp-person"
              className="input"
              maxLength={80}
              placeholder={t('sponsorForm.namePh')}
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              required
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="sp-contact">{t('sponsorForm.contact')}</label>
            <input
              id="sp-contact"
              className="input"
              maxLength={120}
              placeholder={t('sponsorForm.contactPh')}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              required
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="sp-msg">{t('sponsorForm.message')}</label>
            <textarea
              id="sp-msg"
              className="textarea"
              maxLength={2000}
              placeholder={t('sponsorForm.messagePh')}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />
          </div>
          <button className="btn btn--primary" type="submit" disabled={!canSubmit || busy}>
            {busy ? t('sponsorForm.submitting') : t('sponsorForm.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
