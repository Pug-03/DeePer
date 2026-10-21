import { useI18n } from '../store/i18n.jsx';
import { IcTranslate } from './icons.jsx';

// Single translate icon — tap to switch language (Thai ⇄ English).
export default function LangToggle() {
  const { lang, setLang, t } = useI18n();
  const next = lang === 'th' ? 'en' : 'th';
  return (
    <button
      className="lang-btn"
      onClick={() => setLang(next)}
      aria-label={t('lang.switch')}
      title="ไทย / English"
    >
      <IcTranslate size={22} />
    </button>
  );
}
