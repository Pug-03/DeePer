// Organizations sponsoring DeePer — shown as a logo wall in the Supporters
// section of the landing page (3-row marquee, see renderSponsorLogo in
// Welcome.jsx). Logo files are prepared for the near-black page: background
// removed (transparent), trimmed to the artwork, downscaled to at most
// 480x160, and dark ink (black/navy/gray text) recolored to white so it stays
// legible — brand colors are left as-is. Re-derive from the originals rather
// than editing these PNGs by hand.
//
// `tier` groups the logo wall into levels, largest first: 'high' (ระดับสูง),
// 'medium' (ระดับกลาง), 'general' (ทั่วไป). See SPONSOR_TIERS below.
import aiPreneur from './assets/sponsors/ai-preneur.png';
import csii from './assets/sponsors/csii.png';
import depa from './assets/sponsors/depa.png';
import freedom250 from './assets/sponsors/freedom-250.png';
import ingram from './assets/sponsors/ingram.png';
import microsoft from './assets/sponsors/microsoft.png';
import ndea from './assets/sponsors/ndea.png';
import stepCmu from './assets/sponsors/step-cmu.png';
import sut from './assets/sponsors/sut.png';
import tusaa from './assets/sponsors/tusaa.png';
import usMission from './assets/sponsors/us-mission-thailand.png';
import walailak from './assets/sponsors/walailak.png';
import yeah from './assets/sponsors/yeah.png';

export const SPONSORS = [
  { name: 'U.S. Mission Thailand', logo: usMission, tier: 'high' },
  { name: 'Freedom 250', logo: freedom250, tier: 'high' },
  { name: 'TUSAA', logo: tusaa, tier: 'high' },
  { name: 'Microsoft', logo: microsoft, tier: 'medium' },
  { name: 'Ingram Micro', logo: ingram, tier: 'medium' },
  { name: 'depa', logo: depa, tier: 'medium' },
  { name: 'AI Preneur', logo: aiPreneur, tier: 'medium' },
  { name: 'NDEA', logo: ndea, tier: 'medium' },
  { name: 'STeP CMU', logo: stepCmu, tier: 'general' },
  { name: 'Walailak University', logo: walailak, tier: 'general' },
  { name: 'Suranaree University of Technology', logo: sut, tier: 'general' },
  { name: 'CSII', logo: csii, tier: 'general' },
  { name: 'Yeah', logo: yeah, tier: 'general' },
];

// Display order of the tiers; each renders as its own labeled group.
export const SPONSOR_TIERS = ['high', 'medium', 'general'];
