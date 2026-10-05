// Renders a question as a branded, shareable image — portrait 1080x1920 to
// match the Instagram Stories / TikTok canvas, so a long-press share drops
// straight into a story at full size with no cropping. Kept independent of
// the on-screen .qcard DOM node (which isn't 9:16 and holds interactive
// chrome we don't want in the shared image) — a canvas gives full control
// over the exported composition instead.

const W = 1080;
const H = 1920;
const FONT = 'IBM Plex Sans Thai';

// Canvas text needs the font already present in the document's font set —
// merely linking the stylesheet in index.html isn't enough by itself. Best
// effort: if it's not loaded in time, the browser falls back to its default
// sans and the image still renders (just in a different typeface).
async function ensureFonts() {
  const specs = [`700 60px "${FONT}"`, `400 60px "${FONT}"`, `800 60px "${FONT}"`];
  await Promise.all(specs.map((s) => document.fonts.load(s).catch(() => {})));
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Splits into grapheme clusters rather than raw code points — a Thai vowel
// or tone mark is a separate code point that has to stay glued to the
// consonant before it. Iterating with `for...of` (code points) can split
// a run right between the two, leaving the mark orphaned at the start of
// the next chunk, which renders detached/misplaced instead of attached to
// its base character.
function graphemes(str) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    return Array.from(new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(str), (s) => s.segment);
  }
  return Array.from(str);
}

// Breaks a single run that's wider than the card by itself into
// character-level chunks — the fallback path below for Thai text (which
// often has no spaces between words at all, unlike English).
function splitToFit(ctx, run, maxWidth) {
  const chunks = [];
  let chunk = '';
  for (const ch of graphemes(run)) {
    const attempt = chunk + ch;
    if (ctx.measureText(attempt).width <= maxWidth || !chunk) {
      chunk = attempt;
    } else {
      chunks.push(chunk);
      chunk = ch;
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

// Marks that must never start a line (they belong to the word before:
// the Thai repetition mark ๆ, closing quotes and punctuation) and marks
// that must never end one (opening quotes / brackets).
const NO_LINE_START = /^[ๆฯ?!.,:;…)\]}”’"'»]+$/;
const NO_LINE_END = /^[“‘(\[{«]+$/;

// Splits text into the pieces a line may break between. Thai is written
// without spaces between words, so breaking only on spaces either kept a
// whole sentence on one line or (the old fallback) cut mid-word; the
// browser's dictionary word segmenter finds real word boundaries instead.
// Spaces stay as their own tokens so they can be dropped at a break.
function breakTokens(text) {
  const segs =
    typeof Intl !== 'undefined' && Intl.Segmenter
      ? Array.from(new Intl.Segmenter('th', { granularity: 'word' }).segment(text), (s) => s.segment)
      : text.split(/(\s+)/).filter(Boolean);
  const tokens = [];
  let glueNext = '';
  for (const seg of segs) {
    if (/^\s+$/.test(seg)) {
      if (tokens.length && !glueNext) tokens.push(' ');
      continue;
    }
    if (NO_LINE_START.test(seg) && tokens.length) {
      // Re-attach to the previous word, keeping any space between them
      // ("เล็ก ๆ" stays together).
      const space = tokens[tokens.length - 1] === ' ' ? tokens.pop() : '';
      tokens[tokens.length - 1] += space + seg;
      continue;
    }
    if (NO_LINE_END.test(seg)) {
      glueNext += seg;
      continue;
    }
    tokens.push(glueNext + seg);
    glueNext = '';
  }
  if (glueNext) tokens.push(glueNext);
  return tokens;
}

// Thai writers put spaces between phrases, not words, so a space is the
// most natural place to break. Each space-separated phrase that fits on a
// line by itself is kept whole; only a phrase too long for one line is
// broken at its inner word boundaries.
function phraseTokens(ctx, tokens, maxWidth) {
  const out = [];
  let phrase = [];
  const flush = () => {
    if (!phrase.length) return;
    const whole = phrase.join('');
    if (ctx.measureText(whole).width <= maxWidth) out.push(whole);
    else out.push(...phrase);
    phrase = [];
  };
  for (const tok of tokens) {
    if (tok === ' ') {
      flush();
      out.push(' ');
    } else {
      phrase.push(tok);
    }
  }
  flush();
  return out;
}

// Greedy fill: as many whole phrases / words per line as fit. A single
// word wider than the card on its own still falls back to character-level
// chunks.
function greedyLines(ctx, tokens, maxWidth) {
  const lines = [];
  let line = '';
  let space = false;
  for (const tok of tokens) {
    if (tok === ' ') {
      space = !!line;
      continue;
    }
    const attempt = line + (space ? ' ' : '') + tok;
    space = false;
    if (ctx.measureText(attempt).width <= maxWidth) {
      line = attempt;
      continue;
    }
    if (line) lines.push(line);
    if (ctx.measureText(tok).width <= maxWidth) {
      line = tok;
    } else {
      const chunks = splitToFit(ctx, tok, maxWidth);
      for (let i = 0; i < chunks.length - 1; i++) lines.push(chunks[i]);
      line = chunks[chunks.length - 1] ?? '';
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Word-wraps at phrase / word boundaries, then balances the lines: keeps
// the same number of lines but narrows the wrap width a little, so the
// text reads as an even block instead of a full line followed by a lonely
// last word. The narrowing never goes below the widest phrase/word (that
// would re-split what was just kept whole) nor below 75% of the card.
function wrapLines(ctx, text, maxWidth) {
  const tokens = phraseTokens(ctx, breakTokens(text), maxWidth);
  const lines = greedyLines(ctx, tokens, maxWidth);
  if (lines.length < 2) return lines;
  const widest = Math.max(
    0,
    ...tokens.map((t) => ctx.measureText(t).width).filter((w) => w <= maxWidth),
  );
  let lo = Math.max(widest, maxWidth * 0.75);
  let hi = maxWidth;
  if (lo >= hi) return lines;
  let best = lines;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    const attempt = greedyLines(ctx, tokens, mid);
    if (attempt.length <= lines.length) {
      best = attempt;
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return best;
}

// Shrinks the font until the wrapped question fits the card's text area,
// rather than a fixed size that would overflow on longer questions.
function fitText(ctx, text, maxWidth, maxHeight, { max = 64, min = 32, lineHeight = 1.42 } = {}) {
  for (let size = max; size >= min; size -= 2) {
    ctx.font = `700 ${size}px "${FONT}"`;
    const lines = wrapLines(ctx, text, maxWidth);
    if (lines.length * size * lineHeight <= maxHeight) return { size, lines };
  }
  ctx.font = `700 ${min}px "${FONT}"`;
  return { size: min, lines: wrapLines(ctx, text, maxWidth) };
}

/**
 * Draw the branded share card and resolve a PNG Blob.
 * @param {{ text: string, label: string }} q
 * @returns {Promise<Blob|null>}
 */
export async function renderShareCard({ text, label: pillText }) {
  await ensureFonts();

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Base backdrop — the app's black-to-red glow, echoing the real page
  // background rather than a flat fill.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0f0e12');
  bg.addColorStop(1, '#08080a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, W * 0.85);
  glow.addColorStop(0, 'rgba(244, 63, 94, 0.32)');
  glow.addColorStop(1, 'rgba(244, 63, 94, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // The question card itself — same glass-card language as the app
  // (rounded panel, soft red border glow) at wallpaper scale.
  // Portrait proportions (about 7:10, like the card in the app) rather than
  // a near-square block across the whole width.
  const cardX = 160;
  const cardY = 380;
  const cardW = W - cardX * 2;
  const cardH = 1080;
  const radius = 56;

  ctx.save();
  ctx.shadowColor = 'rgba(244, 63, 94, 0.55)';
  ctx.shadowBlur = 70;
  roundRectPath(ctx, cardX, cardY, cardW, cardH, radius);
  ctx.fillStyle = 'rgba(20, 16, 20, 0.92)';
  ctx.fill();
  ctx.restore();

  roundRectPath(ctx, cardX, cardY, cardW, cardH, radius);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.55)';
  ctx.stroke();

  // Brand pill, top-left of the card (mirrors .q-source on the real card,
  // which reads "DEEPER" rather than the question's category).
  if (pillText) {
    ctx.font = '600 26px "IBM Plex Sans Thai", sans-serif';
    const label = pillText.toUpperCase();
    const padX = 26;
    const pillW = ctx.measureText(label).width + padX * 2;
    const pillH = 56;
    const pillX = cardX + 56;
    const pillY = cardY + 56;
    roundRectPath(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(label, pillX + padX, pillY + pillH / 2 + 1);
  }

  // Question text, centred in the remaining card area.
  const textPadX = 70;
  const textMaxWidth = cardW - textPadX * 2;
  const textMaxHeight = cardH - 260;
  const { size, lines } = fitText(ctx, text, textMaxWidth, textMaxHeight);
  const lineHeight = size * 1.42;
  const blockH = lines.length * lineHeight;
  let ty = cardY + cardH / 2 - blockH / 2 + lineHeight / 2 + 40;

  // Clipped to the card's own rounded-rect path — a hard backstop so an
  // outlier question (longer than anything in the bank today) still can't
  // paint past the card edge even if fitText's font-size floor can't shrink
  // it enough to fit on height.
  ctx.save();
  roundRectPath(ctx, cardX, cardY, cardW, cardH, radius);
  ctx.clip();
  ctx.font = `700 ${size}px "${FONT}"`;
  ctx.fillStyle = '#f4f1f2';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const line of lines) {
    ctx.fillText(line, W / 2, ty);
    ty += lineHeight;
  }
  ctx.restore();

  // Brand lockup below the card — what makes the shared post point back at
  // the app instead of reading as an anonymous quote graphic.
  const dotR = 12;
  const brandY = cardY + cardH + 130;
  ctx.font = '800 56px "IBM Plex Sans Thai", sans-serif';
  const brandText = 'DeePer';
  const brandWidth = ctx.measureText(brandText).width;
  const brandStartX = W / 2 - brandWidth / 2 - dotR * 2;

  ctx.fillStyle = '#ff5a72';
  ctx.beginPath();
  ctx.arc(brandStartX, brandY, dotR, 0, Math.PI * 2);
  ctx.fill();

  const brandGrad = ctx.createLinearGradient(brandStartX, 0, brandStartX + brandWidth, 0);
  brandGrad.addColorStop(0, '#ffffff');
  brandGrad.addColorStop(1, '#ff5a72');
  ctx.fillStyle = brandGrad;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(brandText, brandStartX + dotR * 2, brandY);

  ctx.font = '400 30px "IBM Plex Sans Thai", sans-serif';
  ctx.fillStyle = 'rgba(168, 160, 166, 0.9)';
  ctx.textAlign = 'center';
  ctx.fillText('การ์ดคำถามชวนคุยลึก ๆ', W / 2, brandY + 64);

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

// Fallback for browsers with no Web Share support at all (desktop): save the
// generated image locally so the user can still share it by hand.
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
