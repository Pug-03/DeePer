import { partnerIconComponent } from '../utils/partnerIcons.js';

// Renders whichever the partner is currently represented by, in priority
// order: an uploaded photo, a picked stock icon (tinted with their color),
// or a faint stand-in icon on their color until one is picked.
export default function PartnerAvatar({ avatarUrl, icon, fallbackIcon, color, size = 76 }) {
  const style = { width: size, height: size };

  if (avatarUrl) {
    return (
      <div
        className="avatar"
        style={{ ...style, backgroundImage: `url(${avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      />
    );
  }

  const Icon = partnerIconComponent(icon || fallbackIcon);
  return (
    <div className="avatar" style={{ ...style, background: color || undefined, color: '#fff' }}>
      {Icon && <Icon size={Math.round(size * 0.42)} style={icon ? undefined : { opacity: 0.55 }} />}
    </div>
  );
}
