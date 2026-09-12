import {
  IcHeart,
  IcStar,
  IcCat,
  IcDog,
  IcSun,
  IcMoon,
  IcFlower,
  IcCoffee,
  IcSmile,
  IcMusic,
  IcGamepad,
  IcGift,
  IcCloud,
  IcLeaf,
  IcBolt,
  IcDiamond,
} from '../components/icons.jsx';

// Ids kept in sync with PARTNER_ICON_IDS in server/src/routes/auth.js —
// the server only validates the id, this is where the artwork lives.
export const PARTNER_ICONS = [
  { id: 'heart', Icon: IcHeart },
  { id: 'star', Icon: IcStar },
  { id: 'cat', Icon: IcCat },
  { id: 'dog', Icon: IcDog },
  { id: 'sun', Icon: IcSun },
  { id: 'moon', Icon: IcMoon },
  { id: 'flower', Icon: IcFlower },
  { id: 'coffee', Icon: IcCoffee },
  { id: 'smile', Icon: IcSmile },
  { id: 'music', Icon: IcMusic },
  { id: 'gamepad', Icon: IcGamepad },
  { id: 'gift', Icon: IcGift },
  { id: 'cloud', Icon: IcCloud },
  { id: 'leaf', Icon: IcLeaf },
  { id: 'bolt', Icon: IcBolt },
  { id: 'diamond', Icon: IcDiamond },
];

export function partnerIconComponent(id) {
  return PARTNER_ICONS.find((i) => i.id === id)?.Icon || null;
}
