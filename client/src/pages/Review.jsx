import { useNavigate } from 'react-router-dom';
import { useI18n } from '../store/i18n.jsx';
import ReviewForm from '../components/ReviewForm.jsx';
import { IcBack } from '../components/icons.jsx';

// Write / edit your review of DeePer — opened from the button on Profile.
export default function Review() {
  const nav = useNavigate();
  const { t } = useI18n();

  return (
    <div className="page stagger">
      <button className="link back-btn" style={{ alignSelf: 'flex-start', marginBottom: 18 }} onClick={() => nav(-1)}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IcBack size={20} /> {t('common.back')}
        </span>
      </button>

      <div className="center header">
        <h1 className="h1">{t('review.title')}</h1>
        <p className="sub">{t('review.hint')}</p>
      </div>

      <ReviewForm />
    </div>
  );
}
