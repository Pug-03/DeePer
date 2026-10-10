import { createContext, useContext, useState, useCallback, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api.js';

// Holds the onboarding tour's state at a level that survives route changes —
// OnboardingTour is mounted once in TabLayout (a sibling of <Outlet/>, same
// as BottomNav), so navigating Home -> Saved -> History during the tour
// doesn't unmount it. Home.jsx calls start() once its own deck is ready
// (the tour's first step targets a Home element); OnboardingTour itself
// owns step navigation and calls stop() when finished or skipped.
const TutorialContext = createContext(null);

// While the tour is about to start or running, pages skip their entrance
// (fade / rise) animations — the overlay covers them anyway, and the tour
// waits for its target to stop moving before showing a step, so those
// animations only left a blank, dimmed screen for the first second.
// See html[data-tour] in styles.css.
export function markTourStarting() {
  document.documentElement.dataset.tour = '';
}
function clearTourMark() {
  delete document.documentElement.dataset.tour;
}

export function TutorialProvider({ children }) {
  const [active, setActive] = useState(false);
  // The mark stays on after the tour ends until the next page change:
  // taking it off on the spot let the page under the tour replay its
  // entrance animation (blank, then rising back in), as if it had reloaded.
  const activeRef = useRef(active);
  activeRef.current = active;
  const { key } = useLocation();
  useLayoutEffect(() => {
    if (!activeRef.current) clearTourMark();
  }, [key]);
  const [step, setStep] = useState(0);
  // null = not known yet (page hasn't finished its own fetch), true/false
  // once Saved.jsx / History.jsx report it. OnboardingTour uses this to
  // skip the "here's a real item" step for a brand-new user who has
  // nothing saved/answered yet, rather than pointing at an element that
  // doesn't exist (see savedItem/historyItem in OnboardingTour.jsx).
  const [savedHasItems, setSavedHasItems] = useState(null);
  const [historyHasItems, setHistoryHasItems] = useState(null);

  const start = useCallback(() => {
    markTourStarting();
    setStep(0);
    setActive(true);
    // The tour goes straight from the Home nav step to savedItem/historyItem,
    // so it can't wait for Saved.jsx / History.jsx to report on their own
    // mount — by then goToStep has already judged the step and skipped it.
    // Ask up front instead; both land long before the tour gets that far.
    // On failure the flag stays null and the step is skipped as before.
    api
      .get('/saved')
      .then((d) => setSavedHasItems(d.saved.length > 0))
      .catch(() => {});
    api
      .get('/history')
      .then((d) => setHistoryHasItems(d.history.length > 0))
      .catch(() => {});
  }, []);

  const stop = useCallback(() => {
    setActive(false);
    localStorage.removeItem('dt_tutorial_pending');
  }, []);

  return (
    <TutorialContext.Provider
      value={{
        active,
        step,
        setStep,
        start,
        stop,
        savedHasItems,
        setSavedHasItems,
        historyHasItems,
        setHistoryHasItems,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  return useContext(TutorialContext);
}
