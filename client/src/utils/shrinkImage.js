// Scale a picked photo down in the browser before it's uploaded, so a 3MB
// phone photo is stored as a ~100KB JPEG instead (smaller disk, faster
// upload). Best effort: anything it can't handle — an unsupported type, a
// decode failure, a result that isn't actually smaller — returns the
// original file untouched, and the server's own checks still apply.
const SHRINKABLE = ['image/jpeg', 'image/png', 'image/webp'];

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode failed'));
    };
    img.src = url;
  });
}

// maxSide: the longest edge in pixels after scaling (never scaled up).
export async function shrinkImage(file, maxSide, quality = 0.85) {
  if (!file || !SHRINKABLE.includes(file.type)) return file;
  try {
    // Drawing an <img> applies the photo's EXIF rotation, so portrait
    // phone shots don't come out sideways.
    const img = await loadImage(file);
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    // JPEG has no transparency — give see-through PNG areas a white backing
    // instead of black.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]*$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

// Longest edge per kind of upload: profile photos show small, while slips
// and bug screenshots must stay readable.
export const AVATAR_SIDE = 512;
export const DOCUMENT_SIDE = 1600;
