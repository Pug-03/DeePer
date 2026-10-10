// Thai has no spaces between words, so the browser guesses where a line may
// break and gets loanwords wrong ("เลย์เอา|ต์"). Keep each space-separated
// phrase whole so text only wraps at its spaces (and at '\n').
export function unbreakablePhrases(text) {
  return text.split(/( +|\n)/).map((part, i) =>
    i % 2 ? part : part && <span key={i} className="nowrap">{part}</span>
  );
}
