import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../store/i18n.jsx';
import { useToast } from '../components/ui.jsx';
import { IcBack, IcBank, IcWallet, IcQrCode, IcCopy } from '../components/icons.jsx';
import { SUPPORT_INFO } from '../support-info.js';

const METHODS = [
  { id: 'bank', label: 'support.bank', icon: IcBank },
  { id: 'trueMoney', label: 'support.trueMoney', icon: IcWallet },
  { id: 'promptPay', label: 'support.promptPay', icon: IcQrCode },
];

function CopyRow({ text, onCopy }) {
  return (
    <div className="support-value">
      <div className="support-value-text">
        <b>{text}</b>
      </div>
      <button type="button" className="copy-btn" onClick={() => onCopy(text)} aria-label="copy">
        <IcCopy size={18} />
      </button>
    </div>
  );
}

export default function Support() {
  const nav = useNavigate();
  const { t } = useI18n();
  const toast = useToast();
  const [method, setMethod] = useState('bank');

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard API unavailable — still show the confirmation */
    }
    toast(t('common.copied'));
  };

  const { bank, trueMoney, promptPay } = SUPPORT_INFO;

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

      <div className="turn-tabs" style={{ marginBottom: 18 }}>
        {METHODS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className="turn-tab"
            style={method === id ? { background: 'var(--red)', borderColor: 'transparent' } : {}}
            onClick={() => setMethod(id)}
          >
            <Icon size={16} />
            {t(label)}
          </button>
        ))}
      </div>

      <div className="glass" style={{ padding: 18 }}>
        {method === 'bank' && (
          <div className="support-value">
            <div className="support-value-text">
              {bank.bankName} · {bank.accountName}
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
        )}

        {method === 'trueMoney' && <CopyRow text={trueMoney.phone} onCopy={copy} />}

        {method === 'promptPay' && (
          <>
            {promptPay.qrImage ? (
              <img className="support-qr" src={promptPay.qrImage} alt={t('support.promptPay')} />
            ) : (
              <div className="support-qr-placeholder">{t('support.qrComingSoon')}</div>
            )}
            <div style={{ marginTop: 10 }}>
              <CopyRow text={promptPay.id} onCopy={copy} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
