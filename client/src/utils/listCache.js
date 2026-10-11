import { api } from '../api.js';

// Last-loaded Saved/History lists, kept in memory per signed-in user, so
// tapping those tabs shows the list straight away instead of a spinner;
// the page still refreshes it in the background. Also warmed from the
// bottom nav, so even the first tap after opening the app has it ready.
const cache = new Map();
const inflight = new Map();
// Bumped on every write, so a request that started before a newer write
// (e.g. a warm-up still out when a card gets saved) can't overwrite it.
const gen = new Map();

const PATHS = { saved: ['/saved', 'saved'], history: ['/history', 'history'] };
const key = (userId, kind) => `${userId}:${kind}`;

export function getCachedList(userId, kind) {
  return userId == null ? undefined : cache.get(key(userId, kind));
}

export function setCachedList(userId, kind, items) {
  if (userId == null) return;
  const k = key(userId, kind);
  cache.set(k, items);
  gen.set(k, (gen.get(k) ?? 0) + 1);
}

// One request at a time per list: a warm-up still in flight is shared with
// the page that opens right after it. `fresh` skips that sharing, for when
// the in-flight answer is known to be out of date. Resolves to the cached
// list, which is the newer copy if a write landed while this was out.
export function fetchList(userId, kind, { fresh = false } = {}) {
  const k = key(userId, kind);
  if (!fresh && inflight.has(k)) return inflight.get(k);
  const [path, field] = PATHS[kind];
  const startGen = gen.get(k) ?? 0;
  const p = api
    .get(path)
    .then((d) => {
      if ((gen.get(k) ?? 0) === startGen) setCachedList(userId, kind, d[field]);
      return cache.get(k) ?? d[field];
    })
    .finally(() => {
      if (inflight.get(k) === p) inflight.delete(k);
    });
  inflight.set(k, p);
  return p;
}

export function prefetchLists(userId) {
  if (userId == null) return;
  for (const kind of Object.keys(PATHS)) {
    if (!cache.has(key(userId, kind))) fetchList(userId, kind).catch(() => {});
  }
}

// A question just saved from Home goes straight to the top of the cached
// Saved list, so the tab shows it on the very next tap; a quiet refresh
// then swaps in the server's copy.
export function noteSaved(userId, res, { text, text_en, category }) {
  if (userId == null || res?.duplicate || res?.saved?.id == null) return;
  const list = getCachedList(userId, 'saved');
  if (list && !list.some((x) => x.id === res.saved.id)) {
    // Same shape and UTC "YYYY-MM-DD HH:MM:SS" stamp as GET /saved.
    const created_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
    setCachedList(userId, 'saved', [
      { id: res.saved.id, question_text: text, question_text_en: text_en ?? null, category, created_at },
      ...list,
    ]);
  }
  fetchList(userId, 'saved', { fresh: true }).catch(() => {});
}
