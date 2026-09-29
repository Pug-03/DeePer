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
import microsoft from './assets/sponsors/microsoft.png';
import yeah from './assets/sponsors/yeah.png';

export const SPONSORS = [
  { name: 'depa', logo: depa, tier: 'high' },
  { name: 'Microsoft', logo: microsoft, tier: 'medium' },
  { name: 'AI Preneur', logo: aiPreneur, tier: 'medium' },
  { name: 'CSII', logo: csii, tier: 'general' },
  { name: 'Yeah', logo: yeah, tier: 'general' },
];

// Display order of the tiers; each renders as its own labeled group.
export const SPONSOR_TIERS = ['high', 'medium', 'general'];
