// Organizations sponsoring DeePer — shown as a logo wall in the Supporters
// section of the landing page (3-row marquee, see renderSponsorLogo in
// Welcome.jsx). Logo files are prepared for the near-black page: background
// removed (transparent), trimmed to the artwork, downscaled to at most
// 480x160, and dark ink (black/navy/gray text) recolored to white so it stays
// legible — brand colors are left as-is. Re-derive from the originals rather
// than editing these PNGs by hand.
//
// `tier` groups the logo wall into levels, largest first: 'high' (ระดับทอง),
// 'medium' (ระดับเงิน), 'general' (ระดับทองแดง). See SPONSOR_TIERS below.
// A tier with no sponsors is simply not shown.
import aiPreneur from './assets/sponsors/ai-preneur.png';
import csii from './assets/sponsors/csii.png';
import depa from './assets/sponsors/depa.png';
// DotTH keeps its vector paths, with a tight viewBox and white ink for this page.
import dotth from './assets/sponsors/dotth.svg';
import microsoft from './assets/sponsors/microsoft.png';
import yeah from './assets/sponsors/yeah.png';

export const SPONSORS = [
  { name: 'depa', logo: depa, tier: 'high' },
  { name: 'Microsoft', logo: microsoft, tier: 'medium' },
  { name: 'AI Preneur', logo: aiPreneur, tier: 'medium' },
  { name: 'DotTH', logo: dotth, tier: 'general' },
  { name: 'CSII', logo: csii, tier: 'general' },
  { name: 'Yeah', logo: yeah, tier: 'general' },
];

// Display order of the tiers; each renders as its own labeled group.
export const SPONSOR_TIERS = ['high', 'medium', 'general'];

// Individual supporters — people who chipped in a small amount (around
// 100–200 baht). Shown below the bronze tier as one auto-scrolling row of
// name chips. `avatar` (an imported image) is optional; without it the chip
// shows the name's initial in a red circle. Add real names here only once
// the person has agreed to be listed. The row is hidden while this is empty.
export const SUPPORTERS = [
  // { name: 'มิว' },
];
