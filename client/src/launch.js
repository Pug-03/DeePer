import { useState, useEffect } from 'react';

// Official launch: 11/11/2569 at 11:11 Bangkok time. Pinned to +07:00 so
// every visitor counts down to the same instant whatever their timezone.
// Everything gated on the launch (the landing countdown, the sponsor logos,
// the "not open yet" note on sign-up / log-in) reads this one value.
//
// Dev-only preview: open any page with ?launchIn=10 to pretend launch is
// 10 seconds away and watch everything flip. `import.meta.env.DEV` is a
// compile-time constant, so production builds drop this entirely.
function previewLaunchAt() {
  if (!import.meta.env.DEV) return null;
  const s = new URLSearchParams(window.location.search).get('launchIn');
  return s == null ? null : Date.now() + Number(s) * 1000;
}
export const LAUNCH_AT = previewLaunchAt() ?? new Date('2026-11-11T11:11:00+07:00').getTime();
export const COUNTDOWN_UNITS = ['days', 'hours', 'minutes', 'seconds'];

function splitRemaining(ms) {
  const s = Math.floor(ms / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor(s / 3600) % 24,
    minutes: Math.floor(s / 60) % 60,
    seconds: s % 60,
  };
}

// Ticks once a second until launch, then stops. `remaining` is null once
// launched, so callers flip on their own — no follow-up deploy needed.
export function useLaunch() {
  const [now, setNow] = useState(() => Date.now());
  const launched = now >= LAUNCH_AT;
  useEffect(() => {
    if (launched) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [launched]);
  return { launched, remaining: launched ? null : splitRemaining(LAUNCH_AT - now) };
}
