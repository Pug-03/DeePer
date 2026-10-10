import { lazy } from 'react';

const storage = (method, value) => {
  try {
    return sessionStorage[method]('chunk-reload', value);
  } catch {
    return null;
  }
};

// Every lazy page's loader, so they can all be fetched ahead of time.
const loaders = [];

// React.lazy for a page chunk. After a deploy the chunk names change, so a
// tab opened on the old build would fail to load a page it hasn't fetched
// yet; reload once to pick up the new build instead of showing a blank page.
export function lazyPage(load, { preload = true } = {}) {
  if (preload) loaders.push(load);
  return lazy(() =>
    load().then(
      (mod) => {
        storage('removeItem');
        return mod;
      },
      (err) => {
        if (!storage('getItem')) {
          storage('setItem', '1');
          window.location.reload();
          return new Promise(() => {});
        }
        throw err;
      },
    ),
  );
}

// Fetch the remaining page chunks once the browser is idle, so tapping
// "Sign up" or "Log in" doesn't wait on the network. Skipped on data saver.
export function preloadPages() {
  if (navigator.connection?.saveData) return;
  const run = () => loaders.forEach((load) => load().catch(() => {}));
  // Give the current page a head start (its images, the stats call) before
  // competing for the network.
  const idle = () => ('requestIdleCallback' in window ? requestIdleCallback(run, { timeout: 4000 }) : run());
  setTimeout(idle, 2500);
}
