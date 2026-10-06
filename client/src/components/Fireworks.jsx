import { useEffect, useRef } from 'react';

// Fireworks drawn on a canvas that fills its parent. While `play` is true a
// new rocket goes up every so often and pops into sparks in the brand reds,
// pinks, white and gold; when `play` turns false (scrolled out of view) no
// new rockets launch and the sparks in the air fade out on their own.
const COLORS = ['#ff5a72', '#ff1d5a', '#ffd2d9', '#ffffff', '#fbbf24'];

export default function Fireworks({ play }) {
  const ref = useRef(null);
  const playing = useRef(play);
  playing.current = play;
  const running = useRef(false);
  const frameRef = useRef(0);

  // Stop drawing only when the component goes away.
  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  useEffect(() => {
    if (!play || running.current) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    running.current = true;
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const rockets = [];
    const sparks = [];
    let colorIdx = 0;
    let nextAt = performance.now();
    let last = nextAt;

    const launch = () => {
      rockets.push({
        x: width * (0.12 + 0.76 * Math.random()),
        y: height,
        peak: height * (0.1 + 0.32 * Math.random()),
        color: COLORS[colorIdx++ % COLORS.length],
      });
    };
    const pop = (r) => {
      const n = 46 + Math.floor(Math.random() * 20);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.2;
        const v = 1.6 + Math.random() * 2.4;
        sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, color: Math.random() < 0.25 ? '#ffffff' : r.color });
      }
    };

    const tick = (now) => {
      const dt = Math.min(32, now - last) / 16.7;
      last = now;
      if (playing.current && now >= nextAt) {
        launch();
        // Mostly one at a time, now and then a quick double.
        nextAt = now + (Math.random() < 0.25 ? 250 : 650 + Math.random() * 600);
      }
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.y -= 9 * dt;
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = r.color;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
        if (r.y <= r.peak) {
          pop(r);
          rockets.splice(i, 1);
        }
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.vx *= 0.985;
        p.vy = p.vy * 0.985 + 0.045 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= 0.012 * dt;
        if (p.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.8 + p.life, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (playing.current || rockets.length || sparks.length) frameRef.current = requestAnimationFrame(tick);
      else {
        // Out of view and the sky is clear: idle until it comes back.
        ctx.clearRect(0, 0, width, height);
        running.current = false;
      }
    };
    frameRef.current = requestAnimationFrame(tick);
  }, [play]);

  return <canvas ref={ref} className="fireworks" aria-hidden="true" />;
}
