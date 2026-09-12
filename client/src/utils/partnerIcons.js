// Real icons from lucide-react (not hand-drawn) — a hand-typed SVG path is
// one typo away from a broken shape (see git history: IcHeart/IcDiamond).
import { Heart, Star, Cat, Dog, Sun, Moon, Flower2, Coffee, Smile, Music, Gamepad2, Gift, Cloud, Leaf, Zap, Gem } from 'lucide-react';

// Ids kept in sync with PARTNER_ICON_IDS in server/src/routes/auth.js —
// the server only validates the id, this is where the artwork lives.
export const PARTNER_ICONS = [
  { id: 'heart', Icon: Heart },
  { id: 'star', Icon: Star },
  { id: 'cat', Icon: Cat },
  { id: 'dog', Icon: Dog },
  { id: 'sun', Icon: Sun },
  { id: 'moon', Icon: Moon },
  { id: 'flower', Icon: Flower2 },
  { id: 'coffee', Icon: Coffee },
  { id: 'smile', Icon: Smile },
  { id: 'music', Icon: Music },
  { id: 'gamepad', Icon: Gamepad2 },
  { id: 'gift', Icon: Gift },
  { id: 'cloud', Icon: Cloud },
  { id: 'leaf', Icon: Leaf },
  { id: 'bolt', Icon: Zap },
  { id: 'diamond', Icon: Gem },
];

export function partnerIconComponent(id) {
  return PARTNER_ICONS.find((i) => i.id === id)?.Icon || null;
}
