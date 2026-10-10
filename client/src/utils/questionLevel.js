// How deep the home deck's questions go: 'all' runs from light to deep,
// otherwise only that level. Chosen on the Profile page, read by Home.
export const LEVEL_OPTIONS = ['all', 'open', 'mid', 'deep'];
const KEY = 'dt_level';

export function getQuestionLevel() {
  try {
    const saved = localStorage.getItem(KEY);
    return LEVEL_OPTIONS.includes(saved) ? saved : 'all';
  } catch {
    return 'all';
  }
}

export function setQuestionLevel(level) {
  try {
    localStorage.setItem(KEY, level);
  } catch {
    // Not saved (private mode); the choice still applies until reload.
  }
}
