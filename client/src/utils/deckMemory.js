// Where the deck is, for as long as the page stays open. Home unmounts whenever
// its tab is left (answering a card, opening Saved), and dealing a new deck on
// return meant light cards again and repeats: the light-to-deep order only ever
// worked for someone who never answered anything. A fresh load of the app, or
// switching category or level, still starts a new deck.
let memo = null;

export function loadDeck(key) {
  return memo && memo.key === key && memo.idx < memo.deck.length ? memo : null;
}

export function keepDeck(key, deck, idx, seen) {
  memo = { key, deck, idx, seen, answering: memo && memo.key === key ? memo.answering : null };
}

// The card sent to the answer screen. Saving an answer moves past it; coming
// back without saving returns to the same card.
export function markAnswering(id) {
  if (memo) memo.answering = id;
}

export function clearAnswering() {
  if (memo) memo.answering = null;
}

export function finishAnswering() {
  if (!memo) return;
  if (memo.answering != null && memo.deck[memo.idx]?.id === memo.answering) memo.idx += 1;
  memo.answering = null;
}
