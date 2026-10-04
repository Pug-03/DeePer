// DeePer's social accounts shown on the "follow us" page and the Welcome
// page. Handles go in without the leading @; while one is '' its channel
// still shows, but as a non-clickable "coming soon" entry.
export const SOCIAL_INFO = {
  instagram: {
    handle: '',
  },
  tiktok: {
    handle: '',
  },
};

const PROFILE_URL = {
  instagram: (h) => `https://www.instagram.com/${h}/`,
  tiktok: (h) => `https://www.tiktok.com/@${h}`,
};

// Every channel in display order, each with its profile URL (null until a
// handle is set).
export function socialLinks() {
  return Object.keys(PROFILE_URL).map((key) => {
    const handle = SOCIAL_INFO[key]?.handle || '';
    return { key, handle, url: handle ? PROFILE_URL[key](handle) : null };
  });
}
