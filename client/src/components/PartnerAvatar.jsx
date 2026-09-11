import { partnerIconComponent } from '../utils/partnerIcons.js';

// Renders whichever the partner is currently represented by, in priority
// order: an uploaded photo, a picked stock icon (tinted with their color),
// or just the flat color as a plain circle.
export default function PartnerAvatar({ avatarUrl, icon, color, size = 76 }) {
  const style = { width: size, height: size };

  if (avatarUrl) {
    return (
      <div
        className="avatar"
        style={{ ...style, backgroundImage: `url(${avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      />
    );
  }

  const Icon = icon && partnerIconComponent(icon);
  return (
    <div className="avatar" style={{ ...style, background: color || undefined, color: '#fff' }}>
      {Icon && <Icon size={Math.round(size * 0.42)} />}
    </div>
  );
}
