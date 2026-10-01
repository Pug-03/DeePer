import { useNavigate } from 'react-router-dom';
import { useI18n } from '../store/i18n.jsx';
import Sparkles from '../components/Sparkles.jsx';
import { IcBack, IcMail, IcPhone, IcGithub } from '../components/icons.jsx';

const CONTACT_EMAIL = 'ftxz12789@gmail.com';
// DeePer's own inbox, for app-related contact.
const CONTACT_EMAIL_APP = 'deeper.th.app@gmail.com';
const CONTACT_GITHUB = 'https://github.com/Pug-03';
// Thai mobile number — shown as dialled locally, linked in E.164 form.
const CONTACT_PHONE = '061-792-3062';
const CONTACT_PHONE_TEL = '+66617923062';

// Real, fixed content (not fetched, not translated per-field — award names
// and results are proper nouns/placements, same in either app language).
const AWARDS = [
  {
    name: 'AI & Robotics Hackathon 2025 by MIT Media Lab',
    result: 'Top 3 Global Finalist',
  },
  {
    name: 'Play to Build AI Hackathon SEABW 2026 by AWS',
    result:
      'Top 4 Finalist (competing as the youngest and only student developer among professionals)',
  },
  {
    name: 'CEDT Innovation Summit 2026',
    result: 'Semifinal Round',
  },
  {
    name: 'AI for Thai Service Onboarding',
    result: 'Won the AI for Thai Service Standard Award, Top 15 out of 150 teams',
  },
  {
    name: 'GLO Innovation 2026',
    result: '1st Place Winner, selected from 173 teams',
  },
  {
    name: 'KMITL ToBeIT69',
    result: "Top Best App Design for Elderly & Alzheimer's Patients",
  },
  {
    name: 'World Robot Championship 2026 (3kg RC Sumo)',
    result: 'Top 2 Finalist, Dubai Global Finals qualifier',
  },
  {
    name: 'Maker Robotics Challenge 2026 (1.5kg Sumo)',
    result: 'Top 3 Finalist, China Finals qualifier',
  },
  {
    name: 'Junior Webmaster Camp 14',
    result: 'Overall Winner, Best Idea, and Best Content',
  },
  {
    name: 'Thailand Metaverse Hackathon and Exhibition 2026 by Chulalongkorn University (CU)',
    result: '1st Place Winner',
  },
];

// Twinkle accent next to the page title — same <Sparkles/> component and
// motion the landing page's "20+" stat number uses. Offsets are smaller
// than the stat number's own (-20/-16) because the title is a full
// sentence, not a compact number — the same magnitude there reads as
// "floating near the corner of a wide box" rather than "next to the
// text", and on a narrow page the left offset pushed the sparkle past the
// page's own padding, right against the viewport edge. Kept tight to the
// text on both axes instead.
const TITLE_SPARKLES = [
  { top: -2, right: -10, delay: 0, size: 12 },
  { bottom: -2, left: -6, delay: 1.2, size: 9 },
];

export default function Awards() {
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
        <div className="sparkle-anchor">
          <h1 className="h1">{t('awards.title')}</h1>
          <Sparkles points={TITLE_SPARKLES} />
        </div>
      </div>

      <div className="award-list stagger">
        {AWARDS.map((a) => (
          <div className="award-entry" key={a.name}>
            <p className="award-name">{a.name}</p>
            <p className="award-result">{a.result}</p>
          </div>
        ))}
      </div>

      <div className="award-contact">
        <p className="eyebrow">{t('awards.contactTitle')}</p>
        <a className="link award-contact-row" href={`mailto:${CONTACT_EMAIL}`}>
          <IcMail size={18} /> {CONTACT_EMAIL}
        </a>
        <a className="link award-contact-row" href={`mailto:${CONTACT_EMAIL_APP}`}>
          <IcMail size={18} /> {CONTACT_EMAIL_APP}
        </a>
        <a className="link award-contact-row" href={`tel:${CONTACT_PHONE_TEL}`}>
          <IcPhone size={18} /> {CONTACT_PHONE} (TH)
        </a>
        <a
          className="link award-contact-row"
          href={CONTACT_GITHUB}
          target="_blank"
          rel="noopener noreferrer"
        >
          <IcGithub size={18} /> {CONTACT_GITHUB.replace(/^https?:\/\//, '')}
        </a>
      </div>
    </div>
  );
}
