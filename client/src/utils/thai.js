// Thai has no spaces between words, so the browser looks words up in a
// dictionary to decide where a line may break. Loanwords and some compounds
// aren't in it and get split mid-word ("สปอน|เซอร์", "แอ|ดมิน"). keepWord()
// puts a WORD JOINER (U+2060, invisible) between the word's characters so the
// line can only break before or after it.
const graphemes = new Intl.Segmenter('th', { granularity: 'grapheme' });

export function keepWord(word) {
  return Array.from(graphemes.segment(word), (g) => g.segment).join('⁠');
}
