import { CATEGORIES, LEVELS, bankRows } from './questions-bank.js';

// Per-page titles, descriptions and a plain-HTML copy of each public page's
// content, written into index.html before it's sent. The app itself is a
// React SPA, so without this every URL looked the same to search engines
// and AI crawlers (most of which don't run JavaScript): one title, one
// description, an empty page. React replaces the injected content on load.

export const SITE = 'https://deeper.in.th';

// The sample questions shown on the public /questions pages: the first few
// of each level, so the list is stable (search engines index what they saw)
// and walks from light to deep like the app's deck.
export const SAMPLES_PER_LEVEL = 10;

const BANK = bankRows();

export function sampleQuestions(category) {
  return LEVELS.flatMap((level) =>
    BANK
      .filter((r) => r.category === category && r.level === level)
      .slice(0, SAMPLES_PER_LEVEL)
      .map(({ level: lv, text, text_en }) => ({ level: lv, text, text_en })),
  );
}

const TOTAL = BANK.length;
const PER_CATEGORY = Math.round(TOTAL / CATEGORIES.length);
const SAMPLE_COUNT = SAMPLES_PER_LEVEL * LEVELS.length;

// What people actually type into a search box, per category.
export const CATEGORY_SEO = {
  couple: {
    name: 'คู่รัก',
    title: `คำถามถามแฟน ${SAMPLE_COUNT} ข้อ ชวนคุยให้ลึกขึ้น`,
    description: `คำถามถามแฟน คำถามชวนคุยกับแฟน ตั้งแต่เรื่องเบา ๆ ไปจนถึงเรื่องลึกในใจ ${SAMPLE_COUNT} ข้อ เล่นครบ ${PER_CATEGORY} ข้อฟรีบน DeePer ผลัดกันตอบบนมือถือเครื่องเดียว`,
    intro: 'คำถามถามแฟนที่ช่วยให้รู้จักกันมากขึ้น ไล่จากเรื่องสบาย ๆ ไปจนถึงความรู้สึกลึก ๆ ที่อาจไม่เคยได้คุยกัน',
  },
  friends: {
    name: 'เพื่อน ๆ',
    title: `คำถามชวนคุยกับเพื่อน ${SAMPLE_COUNT} ข้อ จากเบา ๆ ถึงลึก`,
    description: `คำถามชวนคุยกับเพื่อน เพื่อนสนิท หรือแก๊งเพื่อน ${SAMPLE_COUNT} ข้อ ทั้งเรื่องขำ ๆ ความทรงจำ และเรื่องในใจ เล่นครบ ${PER_CATEGORY} ข้อฟรีบน DeePer`,
    intro: 'คำถามชวนคุยกับเพื่อน ใช้ได้ทั้งเพื่อนสนิทและเพื่อนที่เพิ่งรู้จัก เริ่มจากเรื่องสนุก ๆ แล้วค่อยลึกขึ้น',
  },
  family: {
    name: 'ครอบครัว',
    title: `คำถามคุยกับครอบครัว พ่อแม่ พี่น้อง ${SAMPLE_COUNT} ข้อ`,
    description: `คำถามคุยกับพ่อแม่ พี่น้อง และคนในครอบครัว ${SAMPLE_COUNT} ข้อ ชวนเล่าความทรงจำและเรื่องที่ไม่ค่อยได้พูด เล่นครบ ${PER_CATEGORY} ข้อฟรีบน DeePer`,
    intro: 'คำถามคุยกับครอบครัว ชวนพ่อแม่ พี่น้อง หรือปู่ย่าตายายเล่าเรื่องที่อาจไม่เคยได้ฟัง',
  },
};

const LEVEL_NAMES = { open: 'เบา ๆ', mid: 'กลาง ๆ', deep: 'ลึก' };

const HOME = {
  title: 'DeePer — การ์ดคำถามชวนคุยลึก ๆ คู่รัก เพื่อน ครอบครัว ใช้ฟรี',
  description: `คำถามถามแฟน คำถามชวนคุยกับเพื่อน และคำถามคุยกับครอบครัว กว่า ${TOTAL.toLocaleString('en-US')} ข้อ ปัดการ์ดแล้วผลัดกันตอบบนมือถือเครื่องเดียว ใช้ฟรี ไม่ต้องดาวน์โหลด`,
};

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const categoryLinks = (skip) =>
  `<ul>${CATEGORIES.filter((c) => c !== skip).map(
    (c) => `<li><a href="/questions/${c}">${esc(CATEGORY_SEO[c].title)}</a></li>`,
  ).join('')}</ul>`;

const homeBody = () => `
      <h1>DeePer — การ์ดคำถามชวนคุยลึก ๆ</h1>
      <p>DeePer คือการ์ดคำถามชวนคุยลึก ๆ ใช้ฟรี สำหรับคู่รัก เพื่อนสนิท และครอบครัว เปิดแอปเดียวกันบนเครื่องเดียวแล้วผลัดกันตอบ ไม่ต้องต่างคนต่างดาวน์โหลด</p>
      <ul>
        <li>คำถามคัดสรรกว่า ${TOTAL.toLocaleString('en-US')} ข้อ ใน 3 หมวด: คู่รัก เพื่อน ๆ ครอบครัว ไล่จากเบา ๆ ไปจนถึงลึก</li>
        <li>ปัดการ์ด: ซ้ายเพื่อข้าม ขวาเพื่อตอบ หรือบันทึกไว้ทีหลัง</li>
        <li>ตั้งชื่อ รูป และสีของอีกฝ่ายแยกตามหมวด</li>
        <li>แชร์คำถามเป็นภาพลง IG Story หรือ LINE</li>
        <li>เก็บประวัติคำตอบไว้อ่านย้อนหลัง</li>
        <li>ใช้บนเบราว์เซอร์ได้ทั้งมือถือ แท็บเล็ต และคอมพิวเตอร์ เพิ่มลงหน้าจอโฮมได้</li>
      </ul>
      <p>DeePer is a free web app of deep conversation question cards for couples, friends and family. Two people share one phone and take turns answering. Available in Thai and English.</p>
      <h2>ตัวอย่างคำถาม</h2>
      ${categoryLinks()}
      <p><a href="/signup">สมัครใช้งานฟรี</a> · <a href="/privacy">นโยบายความเป็นส่วนตัว</a> · <a href="/sponsor">ร่วมสนับสนุน</a></p>`;

const categoryBody = (category) => {
  const seo = CATEGORY_SEO[category];
  const qs = sampleQuestions(category);
  const sections = LEVELS.map((level) => {
    const items = qs
      .filter((q) => q.level === level)
      .map((q) => `<li>${esc(q.text)}${q.text_en ? ` <span lang="en">(${esc(q.text_en)})</span>` : ''}</li>`)
      .join('');
    return `<h2>คำถาม${esc(seo.name)} ระดับ${LEVEL_NAMES[level]}</h2><ol>${items}</ol>`;
  }).join('');
  return `
      <h1>${esc(seo.title)}</h1>
      <p>${esc(seo.intro)}</p>
      ${sections}
      <p>เล่นครบ ${PER_CATEGORY} ข้อแบบการ์ดปัดได้ ฟรี: <a href="/signup">สมัคร DeePer</a></p>
      <h2>หมวดอื่น</h2>
      ${categoryLinks(category)}`;
};

// path -> { title, description, body? }. Pages not listed keep the home
// page's title and description and get no injected body.
function pageFor(path) {
  if (path === '/') return { ...HOME, body: homeBody() };
  const m = path.match(/^\/questions\/([a-z]+)$/);
  if (m && CATEGORY_SEO[m[1]]) {
    const seo = CATEGORY_SEO[m[1]];
    return { title: `${seo.title} | DeePer`, description: seo.description, body: categoryBody(m[1]) };
  }
  if (path === '/questions')
    return {
      title: 'คำถามชวนคุย คู่รัก เพื่อน ครอบครัว | DeePer',
      description: HOME.description,
      body: `<h1>คำถามชวนคุย คู่รัก เพื่อน ครอบครัว</h1>${categoryLinks()}`,
    };
  if (path === '/signup')
    return { title: 'สมัครใช้งาน DeePer ฟรี | การ์ดคำถามชวนคุยลึก ๆ', description: HOME.description };
  if (path === '/login') return { title: 'เข้าสู่ระบบ | DeePer', description: HOME.description };
  if (path === '/privacy')
    return {
      title: 'นโยบายความเป็นส่วนตัว | DeePer',
      description: 'DeePer เก็บข้อมูลอะไรบ้าง ใช้ทำอะไร และคุณจัดการข้อมูลของตัวเองได้อย่างไร',
    };
  if (path === '/sponsor')
    return {
      title: 'ร่วมสนับสนุน DeePer',
      description: 'สำหรับองค์กรหรือแบรนด์ที่อยากร่วมสนับสนุนหรือทำงานร่วมกับ DeePer การ์ดคำถามชวนคุยลึก ๆ',
    };
  return null;
}

// The public URLs worth listing in sitemap.xml.
export const PUBLIC_PATHS = ['/', '/questions', ...CATEGORIES.map((c) => `/questions/${c}`), '/signup', '/privacy', '/sponsor'];

// Write the page's own title, description, canonical link and content
// into the built index.html.
export function renderPage(html, path) {
  const page = pageFor(path);
  if (!page) return html;
  const url = SITE + path;
  let out = html
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(page.title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(page.description)}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(page.title)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(page.description)}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${esc(url)}$2`)
    .replace('</head>', `    <link rel="canonical" href="${esc(url)}" />\n  </head>`);
  if (page.body) out = out.replace(/<!--seo-->[\s\S]*<!--\/seo-->/, `<!--seo-->${page.body}\n    <!--/seo-->`);
  return out;
}
