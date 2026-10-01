import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useI18n } from '../store/i18n.jsx';
import { IcBack, IcMail, IcSparkle } from '../components/icons.jsx';

const CONTACT_EMAIL = 'natsha.nampan@gmail.com';

// No real achievements to list yet — see Awards.jsx for the same page
// structure with a filled-in list. Honest empty state instead of
// placeholder/fake entries; fill this in the same way once she has some.
export default function AwardsNatsha() {
  const nav = useNavigate();
  const { t } = useI18n();

  return (
    <div className="page stagger">
      <button
        className="link back-btn"
        style={{ alignSelf: 'flex-start', marginBottom: 18 }}
        onClick={() => nav('/')}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IcBack size={20} /> {t('common.back')}
        </span>
      </button>

      <div className="header" style={{ marginBottom: 20 }}>
        <h1 className="h1">{t('awards.title')}</h1>
      </div>

      <div className="supporters-placeholder">
        <span className="supporters-placeholder-ic">
          <IcSparkle size={20} />
        </span>
        <p className="supporters-placeholder-text">{t('awards.empty')}</p>
      </div>

      <motion.div
        className="award-contact"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="eyebrow">{t('awards.contactTitle')}</p>
        <a className="link award-contact-row" href={`mailto:${CONTACT_EMAIL}`}>
          <IcMail size={18} /> {CONTACT_EMAIL}
        </a>
      </motion.div>
    </div>
  );
}
