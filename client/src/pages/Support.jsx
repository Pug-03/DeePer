import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useI18n } from '../store/i18n.jsx';
import { useToast } from '../components/ui.jsx';
import { IcBack, IcBank, IcQrCode, IcCopy, IcChat, IcCamera } from '../components/icons.jsx';
import { SUPPORT_INFO } from '../support-info.js';
import { shrinkImage, DOCUMENT_SIDE } from '../utils/shrinkImage.js';
import CheckBadge, { rise } from '../components/CheckBadge.jsx';

export default function Support() {
  const nav = useNavigate();
  const location = useLocation();
  // Opened straight from a link or after a reload there's no app page to
  // go back to, so fall back to the page this one is opened from.
  const goBack = () => (location.key !== 'default' ? nav(-1) : nav('/app/profile', { replace: true }));
  const { t } = useI18n();
  const toast = useToast();

  const [slipFile, setSlipFile] = useState(null);
  const [slipPreview, setSlipPreview] = useState('');
  const [transferDate, setTransferDate] = useState('');
  const [transferTime, setTransferTime] = useState('');
  const [amount, setAmount] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard API unavailable — still show the confirmation */
    }
    toast(t('common.copied'));
  };

  const onSlip = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setSlipPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
    setSlipFile(f);
  };

  const canSubmit = slipFile && transferDate && transferTime && amount && displayName.trim();

  const submitProof = async (e) => {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('slip', await shrinkImage(slipFile, DOCUMENT_SIDE));
      fd.append('transfer_date', transferDate);
      fd.append('transfer_time', transferTime);
      fd.append('amount', amount);
      fd.append('display_name', displayName.trim());
      await api.upload('/support/proof', fd);
      setSent(true);
      if (slipPreview) URL.revokeObjectURL(slipPreview);
      setSlipFile(null);
      setSlipPreview('');
      setTransferDate('');
      setTransferTime('');
      setAmount('');
      setDisplayName('');
    } catch (e2) {
      toast(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const { bank, promptPay } = SUPPORT_INFO;

  // Sent: a proper thank-you, same animated check as the report and sponsor
  // forms, instead of a toast that was gone in a moment.
  if (sent)
    return (
      <div className="page center" style={{ justifyContent: 'center', flex: 1 }}>
        <CheckBadge />
        <motion.h1 className="h1" {...rise(1.05)}>
          {t('support.thanksTitle')}
        </motion.h1>
        <motion.p className="sub" style={{ maxWidth: 320, marginInline: 'auto', whiteSpace: 'pre-line' }} {...rise(1.2)}>
          {t('support.thanksMsg')}
        </motion.p>
        <motion.div style={{ marginTop: 36 }} {...rise(1.38)}>
          <button className="btn btn--primary" type="button" onClick={goBack}>
            {t('common.back')}
          </button>
        </motion.div>
      </div>
    );

  return (
    <div className="page stagger">
      <button className="link back-btn" style={{ alignSelf: 'flex-start', marginBottom: 18 }} onClick={goBack}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IcBack size={20} /> {t('common.back')}
        </span>
      </button>

      <div className="center header">
        <h1 className="h1">{t('support.title')}</h1>
        <p className="sub">{t('support.msg')}</p>
      </div>

      <div className="glass support-card">
        <div className="support-head">
          <span className="support-head-ic">
            <IcBank size={18} />
          </span>
          <span className="support-head-title">{t('support.bank')}</span>
        </div>

        <div className="support-rows">
          <div className="support-row">
            <span className="support-row-label">{t('support.bankLabel')}</span>
            <span className="support-row-value">{bank.bankName}</span>
          </div>
          <div className="support-row">
            <span className="support-row-label">{t('support.nameLabel')}</span>
            <span className="support-row-value">{bank.accountName}</span>
          </div>
        </div>

        <div className="acct-field">
          <div className="acct-field-main">
            <span className="acct-field-label">{t('support.accountNo')}</span>
            <b className="acct-number">{bank.accountNumber}</b>
          </div>
          <button
            type="button"
            className="copy-btn"
            onClick={() => copy(bank.accountNumber)}
            aria-label={t('common.copy')}
          >
            <IcCopy size={18} />
          </button>
        </div>
      </div>

      {promptPay.qrImage && (
        <div className="glass support-card support-card--qr">
          <div className="support-head">
            <span className="support-head-ic">
              <IcQrCode size={18} />
            </span>
            <span className="support-head-title">{t('support.promptPay')}</span>
          </div>
          <div className="qr-frame">
            <img className="qr-img" src={promptPay.qrImage} alt={t('support.promptPay')} />
          </div>
        </div>
      )}

      <div className="glass support-card">
        <div className="support-head">
          <span className="support-head-ic">
            <IcChat size={18} />
          </span>
          <span className="support-head-title">{t('support.proofTitle')}</span>
        </div>
        <p className="support-proof-desc">{t('support.proofDesc')}</p>

        <form className="support-proof-form" onSubmit={submitProof}>
          <label className="slip-drop">
            <input type="file" accept="image/*" hidden onChange={onSlip} />
            {slipPreview ? (
              <img className="slip-preview" src={slipPreview} alt={t('support.proofSlip')} />
            ) : (
              <span className="slip-drop-cta">
                <IcCamera size={22} />
                {t('support.proofAttach')}
              </span>
            )}
          </label>

          <div className="field-row">
            <div className="field">
              <label>{t('support.proofDate')}</label>
              <input
                className="input"
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>{t('support.proofTime')}</label>
              <input
                className="input"
                type="time"
                value={transferTime}
                onChange={(e) => setTransferTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="field">
            <label>{t('support.proofAmount')}</label>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder={t('support.proofAmountPh')}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label>{t('support.proofName')}</label>
            <input
              className="input"
              type="text"
              maxLength={80}
              placeholder={t('support.proofNamePh')}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>

          <button className="btn btn--primary" type="submit" disabled={!canSubmit || busy}>
            {busy ? t('support.proofSubmitting') : t('support.proofSubmit')}
          </button>
        </form>

        <p className="support-proof-note">{t('support.proofUpdate')}</p>
      </div>

      {/* Companies and brands go to the sponsor form instead of a transfer. */}
      <p className="support-sponsor-link">
        {t('sponsorForm.supportTeaser')}{' '}
        <button className="link" type="button" onClick={() => nav('/sponsor')}>
          {t('sponsorForm.cta')} →
        </button>
      </p>
    </div>
  );
}
