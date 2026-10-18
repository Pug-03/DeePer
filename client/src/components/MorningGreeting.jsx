import { useState, useCallback } from 'react';
import { useAuth } from '../store/auth.jsx';
import { useI18n } from '../store/i18n.jsx';
import { useTutorial } from '../store/tutorial.jsx';
import { IntroDrop, introPlayedThisLoad } from '../pages/Welcome.jsx';

// Signed-in users get the water-drop opening once a day too: the first time
// they open the app that day, the drop lands, DeePer writes itself out and
// "Welcome back, <name>" rises under it. Not when they've just watched the
// landing page's opening (logging in), not during the app tour, and not with
// reduced motion.
const GREET_DAY_KEY = 'deeper-greet-day';

// Decided once per page load (React's dev double render would otherwise
// see the day already marked on its second pass and never greet).
let decision = null;
function shouldGreet(tourActive) {
  if (decision === null) decision = decide(tourActive);
  return decision;
}
function decide(tourActive) {
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    const today = new Date().toDateString();
    if (localStorage.getItem(GREET_DAY_KEY) === today) return false;
    localStorage.setItem(GREET_DAY_KEY, today);
    return !introPlayedThisLoad() && !tourActive && !('tour' in document.documentElement.dataset);
  } catch {
    return false;
  }
}

export default function MorningGreeting() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const tutorial = useTutorial();
  const [show, setShow] = useState(() => shouldGreet(tutorial.active));
  const done = useCallback(() => {
    decision = false; // played; don't replay if this remounts later today
    setShow(false);
  }, []);
  if (!show) return null;
  const name = (lang === 'en' && user?.nickname_en) || user?.nickname;
  return (
    <IntroDrop
      full={false}
      greeting={name ? t('greet.welcomeName', { name }) : t('greet.welcome')}
      onLand={done}
    />
  );
}
