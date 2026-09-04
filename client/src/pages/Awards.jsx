import { useNavigate } from 'react-router-dom';
import { useI18n } from '../store/i18n.jsx';
import { IcBack, IcMail, IcGithub } from '../components/icons.jsx';

const CONTACT_EMAIL = 'ftxz12789@gmail.com';
const CONTACT_GITHUB = 'https://github.com/Pug-03';

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

export default function Awards() {
  const nav = useNavigate();
  const { t } = useI18n();

  return (
    <div className="page stagger">
      <button
        className="link"
        style={{ alignSelf: 'flex-start', marginBottom: 18 }}
        onClick={() => nav('/')}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IcBack size={18} /> {t('common.back')}
        </span>
      </button>

      <div className="header" style={{ marginBottom: 20 }}>
        <h1 className="h1">{t('awards.title')}</h1>
      </div>

      {AWARDS.map((a) => (
        <div className="award-entry" key={a.name}>
          <p className="award-name">{a.name}</p>
          <p className="award-result">{a.result}</p>
        </div>
      ))}

      <div className="award-contact">
        <p className="eyebrow">{t('awards.contactTitle')}</p>
        <a className="link award-contact-row" href={`mailto:${CONTACT_EMAIL}`}>
          <IcMail size={18} /> {CONTACT_EMAIL}
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
