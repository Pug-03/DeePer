// Organizations sponsoring DeePer — shown as a logo wall in the Supporters
// section of the landing page (static logo walls, see renderSponsorLogo in
// Welcome.jsx). Logo files are prepared for the near-black page: background
// removed (transparent), trimmed to the artwork, downscaled to at most
// 480x160, and dark ink (black/navy/gray text) recolored to white so it stays
// legible — brand colors are left as-is. DotTH and TWA are all-white
// wordmarks. Re-derive PNGs from the originals rather than editing them by
// hand.
//
// `tier` groups the logo wall into levels, largest first: 'high' (ระดับทอง),
// 'medium' (ระดับเงิน), 'general' (ระดับทองแดง). See SPONSOR_TIERS below.
// A tier with no sponsors is simply not shown.
// AWS keeps its vector paths (Wikimedia Commons SVG) with the dark "aws"
// wordmark recolored to white; the orange smile stays brand orange.
import aws from './assets/sponsors/aws.svg';
import depa from './assets/sponsors/depa.png';
// DotTH keeps its vector paths, with a tight viewBox and white ink.
import dotth from './assets/sponsors/dotth.svg';
import microsoft from './assets/sponsors/microsoft.png';
import twa from './assets/sponsors/twa.png';
import yeah from './assets/sponsors/yeah.png';

export const SPONSORS = [
  { name: 'depa', logo: depa, tier: 'high' },
  { name: 'Microsoft', logo: microsoft, tier: 'medium' },
  { name: 'AWS', logo: aws, tier: 'medium' },
  { name: 'Yeah', logo: yeah, tier: 'general' },
  { name: 'DotTH', logo: dotth, tier: 'general' },
  { name: 'TWA', logo: twa, tier: 'general' },
];

// Display order of the tiers; each renders as its own labeled group.
export const SPONSOR_TIERS = ['high', 'medium', 'general'];

// "ผู้สนับสนุนรายบุคคล" — people who chipped in a small amount (around
// 100–500 baht). Shown below the bronze tier as one auto-scrolling row of
// name chips. Donors who send a slip through the site are added
// automatically once approved (server: npm run proofs, then
// npm run approve -- <id>); this list is only for names to add by hand. Chips show the name only.
// Add real names here only once
// the person has agreed to be listed. The row is hidden while there are no
// names from either source.
export const SUPPORTERS = [
  // { name: 'มิว' },
];
