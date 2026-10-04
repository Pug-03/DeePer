import { useEffect } from 'react';
import { api } from '../api.js';

const VISITOR_KEY = 'deeper_vid';
const DAY_KEY = 'deeper_visit_day';

// Today's date in Bangkok, matching the server's day buckets.
const bangkokDay = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);

// Tells the server "this browser opened DeePer today" once per day, so the
// admin dashboard can count visitors who never sign in and see where they
// came from. Only a random per-browser id is sent — no account details.
export default function VisitBeacon() {
  useEffect(() => {
    try {
      if (location.pathname.startsWith('/admin')) return;
      const today = bangkokDay();
      if (localStorage.getItem(DAY_KEY) === today) return;
      let vid = localStorage.getItem(VISITOR_KEY);
      if (!vid) {
        vid = crypto.randomUUID();
        localStorage.setItem(VISITOR_KEY, vid);
      }
      api
        .post('/visits', {
          visitor_id: vid,
          path: location.pathname,
          ref: new URLSearchParams(location.search).get('ref') || '',
          referrer: document.referrer,
        })
        .then(() => localStorage.setItem(DAY_KEY, today))
        .catch(() => {});
    } catch {
      /* storage blocked (private mode etc.) — skip counting */
    }
  }, []);
  return null;
}
