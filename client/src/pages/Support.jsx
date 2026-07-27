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

      <div className="glass" style={{ padding: 18 }}>
        <div className="support-method">
          <p className="support-method-title">
            <IcBank size={16} />
            {t('support.bank')}
          </p>
          <div className="support-value">
            <div className="support-value-text">
              <span>{bank.bankName}</span>
              <span>{bank.accountName}</span>
              <b>{bank.accountNumber}</b>
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

        <div className="support-method">
          <p className="support-method-title">
            <IcQrCode size={16} />
            {t('support.promptPay')}
          </p>
          {promptPay.qrImage ? (
            <img className="support-qr" src={promptPay.qrImage} alt={t('support.promptPay')} />
          ) : (
            <div className="support-qr-placeholder">{t('support.qrComingSoon')}</div>
          )}
        </div>
      </div>
    </div>
  );
}
