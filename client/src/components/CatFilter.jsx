import { motion } from 'framer-motion';
import { useI18n } from '../store/i18n.jsx';
import { CATS } from '../util.js';
import { useElasticIndicator } from '../utils/elasticIndicator.js';

// Category filter row for list pages (Saved/History) — picks which
// category's items to show, plus an "all" option. The active capsule slides
// elastically like Home's category tabs, and the row can be press-dragged.
export default function CatFilter({ value, onChange }) {
  const { t } = useI18n();
  const pick = (c) => c !== value && onChange(c);
  const ind = useElasticIndicator(value, pick);
  return (
    <div className="filter-row filter-row--elastic" ref={ind.rowRef} {...ind.dragHandlers}>
      <motion.span className="filter-row-bg" style={ind.style} />
      {['all', ...CATS].map((c) => {
        const isActive = value === c;
        return (
          <button
            key={c}
            ref={ind.itemRef(c)}
            data-pick={c}
            type="button"
            className={`pill ${isActive ? 'active' : ''}`}
            onClick={() => pick(c)}
          >
            <motion.span
              key={isActive ? 'on' : 'off'}
              className="pill-label"
              initial={isActive ? { scale: 0.82 } : false}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 14 }}
            >
              {c === 'all' ? t('cat.all') : t(`cat.${c}`)}
            </motion.span>
          </button>
        );
      })}
    </div>
  );
}
