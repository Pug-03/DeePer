import { createContext, useContext, useState, useCallback } from 'react';

// Holds the onboarding tour's state at a level that survives route changes —
// OnboardingTour is mounted once in TabLayout (a sibling of <Outlet/>, same
// as BottomNav), so navigating Home -> Saved -> History during the tour
// doesn't unmount it. Home.jsx calls start() once its own deck is ready
// (the tour's first step targets a Home element); OnboardingTour itself
// owns step navigation and calls stop() when finished or skipped.
const TutorialContext = createContext(null);

export function TutorialProvider({ children }) {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  // null = not known yet (page hasn't finished its own fetch), true/false
  // once Saved.jsx / History.jsx report it. OnboardingTour uses this to
  // skip the "here's a real item" step for a brand-new user who has
  // nothing saved/answered yet, rather than pointing at an element that
  // doesn't exist (see savedItem/historyItem in OnboardingTour.jsx).
  const [savedHasItems, setSavedHasItems] = useState(null);
  const [historyHasItems, setHistoryHasItems] = useState(null);

  const start = useCallback(() => {
    setStep(0);
    setActive(true);
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
