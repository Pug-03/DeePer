import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useI18n } from '../store/i18n.jsx';
import { useToast } from '../components/ui.jsx';
import { IcBack, IcBank, IcQrCode, IcCopy, IcChat, IcCamera } from '../components/icons.jsx';
import { SUPPORT_INFO } from '../support-info.js';

export default function Support() {
  const nav = useNavigate();
  const { t } = useI18n();
  const toast = useToast();

  const [slipFile, setSlipFile] = useState(null);
  const [slipPreview, setSlipPreview] = useState('');
  const [transferDate, setTransferDate] = useState('');
  const [transferTime, setTransferTime] = useState('');
  const [amount, setAmount] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);

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
      fd.append('slip', slipFile);
      fd.append('transfer_date', transferDate);
      fd.append('transfer_time', transferTime);
      fd.append('amount', amount);
      fd.append('display_name', displayName.trim());
      await api.upload('/support/proof', fd);
      toast(t('support.proofSuccess'));
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

  return (
    <div className="page stagger">
      <button className="link" style={{ alignSelf: 'flex-start', marginBottom: 18 }} onClick={() => nav(-1)}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IcBack size={18} /> {t('common.back')}
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
    </div>
  );
}
