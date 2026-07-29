// Minimal inline SVG icon set (stroke = currentColor).
const S = (props) => ({
  width: props.size || 24,
  height: props.size || 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: props.sw || 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
});

export const IcHome = (p) => (
  <svg {...S(p)}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
  </svg>
);
export const IcBookmark = (p) => (
  <svg {...S(p)}>
    <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" fill={p.fill || 'none'} />
  </svg>
);
export const IcHistory = (p) => (
  <svg {...S(p)}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 4v4h4" />
    <path d="M12 8v4l3 2" />
  </svg>
);
export const IcUser = (p) => (
  <svg {...S(p)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.5-6 8-6s8 2 8 6" />
  </svg>
);
export const IcX = (p) => (
  <svg {...S({ ...p, sw: p.sw || 2.6 })}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const IcCheck = (p) => (
  <svg {...S({ ...p, sw: p.sw || 2.6 })}>
    <path d="M4 12.5 9.5 18 20 6" />
  </svg>
);
export const IcBack = (p) => (
  <svg {...S(p)}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
export const IcPlus = (p) => (
  <svg {...S(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IcTrash = (p) => (
  <svg {...S({ ...p, sw: 1.8 })}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </svg>
);
export const IcMail = (p) => (
  <svg {...S(p)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);
export const IcTranslate = (p) => (
  <svg width={p.size || 24} height={p.size || 24} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" />
  </svg>
);
export const IcSparkle = (p) => (
  <svg width={p.size || 24} height={p.size || 24} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.5l1.8 5.7L19.5 10l-5.7 1.8L12 17.5l-1.8-5.7L4.5 10l5.7-1.8L12 2.5Z" />
    <path d="M19 14l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6Z" />
  </svg>
);
export const IcAlertCircle = (p) => (
  <svg {...S(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v6" />
    <path d="M12 16.5h.01" />
  </svg>
);
export const IcSeedling = (p) => (
  <svg {...S(p)}>
    <path d="M12 21v-8.5" />
    <path d="M12 12.5c0-4 3-7 7-7 0 4-3 7-7 7Z" />
    <path d="M12 12.5c0-3.5-2.7-6.3-6-6.3 0 3.48 2.7 6.3 6 6.3Z" />
  </svg>
);
export const IcCards = (p) => (
  <svg {...S(p)}>
    <rect x="3" y="8" width="13" height="13" rx="2.4" />
    <path d="M7.5 8V5.4A2.4 2.4 0 0 1 9.9 3H19a2.4 2.4 0 0 1 2.4 2.4V15a2.4 2.4 0 0 1-2.4 2.4h-3" />
  </svg>
);
export const IcBook = (p) => (
  <svg {...S(p)}>
    <path d="M12 7c-2-2-5-2-8-2v14c3 0 6 0 8 2 2-2 5-2 8-2V5c-3 0-6 0-8 2Z" />
    <path d="M12 7v14" />
  </svg>
);
export const IcChat = (p) => (
  <svg {...S(p)}>
    <path d="M21 11.5a8.4 8.4 0 0 1-8.4 8.4 8.3 8.3 0 0 1-3.8-.9L3 21l1.9-5.8a8.3 8.3 0 0 1-.9-3.7A8.4 8.4 0 0 1 12.5 3.1H13a8.4 8.4 0 0 1 8 8.4Z" />
  </svg>
);
export const IcEye = (p) => (
  <svg {...S(p)}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3.2" />
  </svg>
);
export const IcEyeOff = (p) => (
  <svg {...S(p)}>
    <path d="M3 3l18 18" />
    <path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.4 0 10 7 10 7a17.7 17.7 0 0 1-3.2 4.15M6.6 6.6C4 8.3 2 12 2 12s3.6 7 10 7c1.3 0 2.5-.24 3.6-.68" />
    <path d="M9.9 9.9a3.2 3.2 0 0 0 4.2 4.2" />
  </svg>
);
export const IcCamera = (p) => (
  <svg {...S(p)}>
    <path d="M3 9a2 2 0 0 1 2-2h2l1.5-2.5h7L17 7h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    <circle cx="12" cy="12.8" r="3.3" />
  </svg>
);
export const IcBank = (p) => (
  <svg {...S({ ...p, sw: 1.8 })}>
    <path d="M12 3 2 9h20L12 3Z" />
    <path d="M4 9v9M9 9v9M15 9v9M20 9v9" />
    <path d="M2 21h20" />
  </svg>
);
export const IcQrCode = (p) => (
  <svg {...S({ ...p, sw: 1.8 })}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <path d="M14 15h3v3h-3zM19 19h2M14 19h1M19 15h2" />
  </svg>
);
export const IcCopy = (p) => (
  <svg {...S({ ...p, sw: 1.8 })}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
export const IcSettings = (p) => (
  <svg {...S({ ...p, sw: 1.8 })}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </svg>
);
export const IcGoogle = (p) => (
  <svg width={p.size || 22} height={p.size || 22} viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
    />
  </svg>
);
