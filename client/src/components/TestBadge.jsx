import { useLocation, useNavigate } from 'react-router-dom';
import { useLaunch } from '../launch.js';
import { useI18n } from '../store/i18n.jsx';

// Small "testing" tag beside the DeePer name on Home until launch, and a
// one-tap way to send feedback from wherever the tester is. Disappears by
// itself at launch.
export default function TestBadge() {
  const { launched } = useLaunch();
  const { t } = useI18n();
  const nav = useNavigate();
  const { pathname } = useLocation();
  if (launched) return null;
  return (
    <button
      type="button"
      className="test-badge"
      onClick={() => nav('/report', { state: { from: pathname } })}
      aria-label={t('beta.feedback')}
    >
      {t('beta.badge')}
    </button>
  );
}
