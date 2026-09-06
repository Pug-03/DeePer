import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// The browser keeps window scroll position across a client-side route
// change by default, so navigating from partway down a long page (e.g.
// clicking a dev's name in the landing page's credits section) lands the
// new page already scrolled down instead of at the top. Reset on every
// pathname change so every navigation in the app starts at the top.
export default function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
