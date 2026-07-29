import { useNavigate } from 'react-router-dom';
import { useI18n } from '../store/i18n.jsx';
import { useToast } from '../components/ui.jsx';
import { IcBack, IcBank, IcQrCode, IcCopy } from '../components/icons.jsx';
import { SUPPORT_INFO } from '../support-info.js';

export default function Support() {
  const nav = useNavigate();
  const { t } = useI18n();
  const toast = useToast();

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard API unavailable — still show the confirmation */
    }
    toast(t('common.copied'));
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

      <div className="glass support-card support-card--qr">
        <div className="support-head">
          <span className="support-head-ic">
            <IcQrCode size={18} />
          </span>
          <span className="support-head-title">{t('support.promptPay')}</span>
        </div>
        <div className="qr-frame">
          {promptPay.qrImage ? (
            <img className="qr-img" src={promptPay.qrImage} alt={t('support.promptPay')} />
          ) : (
            <div className="qr-empty">
              <IcQrCode size={40} />
              <span>{t('support.qrComingSoon')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
