import { useI18n } from '../store/i18n.jsx';

export default function PasswordStrength({ rules, score }) {
  const { t } = useI18n();
  return (
    <>
      <div className="pw-meter">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className={`pw-seg ${score >= n ? `on-${score}` : ''}`} />
        ))}
      </div>
      <ul className="pw-rules">
        <li className={rules.upper ? 'ok' : ''}>• {t('pw.upper')}</li>
        <li className={rules.lower ? 'ok' : ''}>• {t('pw.lower')}</li>
        <li className={rules.digit ? 'ok' : ''}>• {t('pw.digit')}</li>
        <li className={rules.special ? 'ok' : ''}>• {t('pw.special')}</li>
      </ul>
    </>
  );
}
