import { useI18n } from '../store/i18n.jsx';
import { CATS } from '../util.js';

// Plain category filter row for list pages (Saved/History) — picks which
// category's items to show, plus an "all" option. Unlike CatTabs on the
// home page this doesn't drive a live deck fetch, so it skips the elastic
// sliding indicator and just toggles each pill's own active state.
export default function CatFilter({ value, onChange }) {
  const { t } = useI18n();
  return (
    <div className="filter-row">
      {['all', ...CATS].map((c) => (
        <button
          key={c}
          type="button"
          className={`pill ${value === c ? 'active' : ''}`}
          onClick={() => onChange(c)}
        >
          {c === 'all' ? t('cat.all') : t(`cat.${c}`)}
        </button>
      ))}
    </div>
  );
}
