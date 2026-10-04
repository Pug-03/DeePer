// Who built DeePer — shown in the "Made by" section on the landing page.
// `link` is optional per person; leave '' to skip rendering a link (see
// Welcome.jsx, which only renders an <a> when link is truthy). `avatar` is
// also optional — Welcome.jsx falls back to an initials circle (same style
// as the Supporters marquee's avatars) if it's missing or fails to load.
// A '\n' in a role starts a new line (.dev-team-role keeps line breaks).
import nathapornPhoto from './assets/team/nathaporn.jpg';
import natshaPhoto from './assets/team/namphan.jpg';

export const DEV_TEAM = [
  {
    nameTh: 'ณฐพร ไทรทับทิม',
    nameEn: 'Nathaporn Saituptim',
    roleTh: 'เจ้าของโปรเจกต์ ผู้พัฒนาหลัก\n(ดูแลทุกส่วน เจ้าของและพัฒนาทั้งหมด)',
    roleEn: 'Project owner and lead developer who builds every part of DeePer',
    link: '',
    avatar: nathapornPhoto,
    // Proper headshot — the default centered crop already frames the face.
    avatarPosition: 'center',
    // Clicking the name in DevTeamCard (Welcome.jsx) navigates here.
    awardsHref: '/awards',
  },
  {
    nameTh: 'นัชชา ตติยชัยทวีสุข',
    nameEn: 'Natsha Tatiyachaitaweesuk',
    roleTh: 'ดูแลเรื่อง UX/UI การวางเลย์เอาต์ คอนเทนต์ และการตลาด',
    roleEn: 'Handles UX/UI, layout, content and marketing',
    link: '',
    avatar: natshaPhoto,
    // Full-body/high-angle shot, not a headshot — bias the crop toward the
    // top so the circle frames the face instead of the torso/floor below it.
    avatarPosition: '50% 15%',
    // Own page, honest empty state until she has achievements to list —
    // see pages/AwardsNatsha.jsx.
    awardsHref: '/awards/natsha',
  },
];
