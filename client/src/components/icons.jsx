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
