import { motion } from 'framer-motion';
import { useI18n } from '../store/i18n.jsx';
import FieldError, { invalidProps } from './FieldError.jsx';
import { useElasticIndicator } from '../utils/elasticIndicator.js';

// Gender is required, so there's no "none".
export const GENDER_VALUES = ['female', 'male', 'other', 'prefer_not'];

// The gender field shared by signup and the My-information page. Every
// option on show at once, with the same sliding capsule as the
// question-depth picker on Profile — clearer than a select, which read as
// just another text box. Sits beside the age box in an .info-row.
export default function GenderPicker({ value, onPick, errors }) {
  const { t } = useI18n();
  const ind = useElasticIndicator(value, onPick);
  return (
    <div className="field info-gender-field">
      <label id="pf-gender-label">{t('signup.gender')}</label>
      <div
        id="pf-gender"
        ref={ind.rowRef}
        className="lang-seg level-seg"
        role="radiogroup"
        aria-labelledby="pf-gender-label"
        tabIndex={-1}
        {...invalidProps('gender', errors)}
        {...ind.dragHandlers}
      >
        <motion.span className="level-seg-bg" style={{ ...ind.style, opacity: value ? 1 : 0 }} />
        {GENDER_VALUES.map((g) => {
          const isActive = value === g;
          return (
            <button
              key={g}
              ref={ind.itemRef(g)}
              data-pick={g}
              type="button"
              role="radio"
              aria-checked={isActive}
              className={isActive ? 'active' : ''}
              onClick={() => onPick(g)}
            >
              <motion.span
                key={isActive ? 'on' : 'off'}
                className="pill-label"
                initial={isActive ? { scale: 0.82 } : false}
                animate={{ scale: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 380,
                  damping: 14,
                }}
              >
                {t(`gender.${g}`)}
              </motion.span>
            </button>
          );
        })}
      </div>
      <FieldError id="pf-gender-err" msg={errors.gender} />
    </div>
  );
}
