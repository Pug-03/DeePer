// Who built DeePer — shown in the "Made by" section on the landing page.
// `link` is optional per person; leave '' to skip rendering a link (see
// Welcome.jsx, which only renders an <a> when link is truthy). `avatar` is
// also optional — Welcome.jsx falls back to an initials circle (same style
// as the Supporters marquee's avatars) if it's missing or fails to load.
import nathapornPhoto from './assets/team/nathaporn.jpg';
import natshaPhoto from './assets/team/namphan.jpg';

export const DEV_TEAM = [
  {
    nameTh: 'ณฐพร ไทรทับทิม',
    nameEn: 'Nathaporn Saituptim',
    roleTh: 'เจ้าของโปรเจกต์ ผู้พัฒนาหลัก (ดูแลทุกส่วน เจ้าของและพัฒนาทั้งหมด)',
    roleEn: 'Project owner and lead developer who builds every part of DeePer',
    link: '',
    avatar: nathapornPhoto,
    // Proper headshot — the default centered crop already frames the face.
    avatarPosition: 'center',
    // Only Nathaporn's entry links out to the Awards page — see
    // welcome.team.awardsLink / DevTeamCard in Welcome.jsx.
    awardsHref: '/awards',
  },
  {
    nameTh: 'นัชชา ตติยชัยทวีสุข',
    nameEn: 'Natsha Tatiyachaitaweesuk',
    roleTh: 'ดูแลเรื่อง UX/UI และการวางเลย์เอาต์',
    roleEn: 'Handles UX/UI and layout',
    link: '',
    avatar: natshaPhoto,
    // Full-body/high-angle shot, not a headshot — bias the crop toward the
    // top so the circle frames the face instead of the torso/floor below it.
    avatarPosition: '50% 15%',
  },
];
