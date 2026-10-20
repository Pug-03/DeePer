import { useEffect, useRef } from 'react';

// The landing page is one dive. Behind the whole page sits a fixed,
// full-window WebGL scene of the water the opening's drop fell into: at the
// top the hero rests above it, with the lit surface glowing along the bottom
// of the screen; scrolling sinks the camera, so the surface slides up and
// away 1:1 with the page, the light shafts thin out, specks drift up past,
// and it gets darker the further down the page you go, until the app's red
// orb glows at the very bottom. Every section below the hero sits in that
// water at its own depth (DepthGauge marks where).
//
// The visitor carries a soft light of their own through the water: it
// follows the mouse (or the last touch) and lights up the specks near it.
//
// Without WebGL the page keeps its usual CSS backdrop (body::before); with
// reduced motion the water stops drifting and only follows the scroll.

const VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

// u_surf: where the surface line is, in screen uv (0 bottom, 1 top; above
//   1 once it has scrolled off the top). Distances are in screen heights.
// u_rise: how far the camera has sunk, in screen heights (drives specks).
// u_orb: 0..1, the orb's glow at the bottom of the page.
const FRAG = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_surf;
uniform float u_rise;
uniform float u_orb;
uniform vec3 u_light;   // xy: where the visitor's light is (uv), z: how strong
uniform float u_air;    // 1: draw the air and the surface line; 0: water only

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// Light rippling through the surface: the classic iterated sine caustic.
float caustic(vec2 uv, float t) {
  vec2 p = mod(uv * 6.2831, 6.2831) - 250.0;
  vec2 i = p;
  float c = 1.0;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / 0.005), p.y / (cos(i.y + tt) / 0.005)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  return pow(abs(c), 8.0);
}

// Drifting specks, in a layer that slides up as the camera sinks.
float specks(vec2 uv, float scale, float rise, float t, float size) {
  vec2 g = uv * scale;
  g.y -= rise;
  g.x += sin(g.y * 0.35 + t * 0.2) * 0.3;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  float h = hash(id);
  if (h > 0.35) return 0.0;
  vec2 off = vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5;
  float d = length(f - off * 0.7);
  float tw = 0.6 + 0.4 * sin(t * (0.6 + h * 2.0) + h * 40.0);
  return smoothstep(size, 0.0, d) * tw;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / u_res;
  float aspect = u_res.x / u_res.y;
  vec2 q = vec2((uv.x - 0.5) * aspect, uv.y);
  float t = u_time;

  // Above the water: the page's own backdrop (the body::before gradient
  // with its red glow at the top), so the hero looks exactly as before.
  vec3 air = mix(vec3(0.071, 0.039, 0.055), vec3(0.059, 0.055, 0.071), uv.y);
  vec2 g = (uv - vec2(0.5, 1.1)) * vec2(u_res.x / 1200.0, u_res.y / 700.0);
  air += vec3(0.957, 0.247, 0.369) * 0.16 * smoothstep(0.6, 0.0, length(g));

  float wave = sin(q.x * 9.0 + t * 0.9) * 0.006 + sin(q.x * 23.0 - t * 1.3) * 0.003;
  float surf = u_surf + wave;
  float dist = max(surf - uv.y, 0.0);          // screen heights below the surface
  float lit = exp(-dist * 0.16);                // how much daylight reaches here

  // Water: lit wine-red just under the surface, sinking to near black.
  vec3 shallow = mix(vec3(0.11, 0.035, 0.06), vec3(0.36, 0.07, 0.13), exp(-dist * 1.4));
  vec3 deep = mix(vec3(0.03, 0.012, 0.022), vec3(0.08, 0.026, 0.05), uv.y);
  vec3 col = mix(deep, shallow, lit);

  // The surface itself: a bright rippling band right under the line.
  float caus = caustic(vec2(q.x * 0.6, uv.y * 0.35 + u_rise * 0.25), t * 0.35);
  float band = exp(-dist * 9.0);
  col += vec3(1.0, 0.42, 0.5) * band * (0.35 + caus * 0.55) * u_air;
  col += vec3(0.9, 0.3, 0.4) * caus * 0.07 * exp(-dist * 2.2);

  // Soft, uneven beams swaying down from the surface.
  vec2 src = vec2(0.25 * sin(t * 0.04), surf + 1.4);
  vec2 rd = q - src;
  float ang = atan(rd.x, -rd.y);
  float shafts = (0.5 + 0.5 * sin(ang * 9.0 + t * 0.13));
  shafts *= 0.55 + 0.45 * sin(ang * 14.0 - t * 0.09 + 1.3);
  shafts *= 0.6 + 0.4 * sin(ang * 5.0 + t * 0.05 + 2.1);
  shafts = pow(shafts, 2.2) * (0.8 + 0.2 * sin(uv.y * 7.0 - t * 0.4));
  col += vec3(1.0, 0.36, 0.45) * shafts * 0.24 * exp(-dist * 0.75);

  // Specks drifting past at three distances.
  float s = 0.0;
  s += specks(q, 7.0, u_rise * 1.3 + t * 0.03, t, 0.07) * 0.5;
  s += specks(q + 3.7, 4.0, u_rise * 2.0 + t * 0.045, t, 0.06) * 0.75;
  s += specks(q + 9.1, 2.2, u_rise * 3.1 + t * 0.06, t, 0.05);
  // The visitor's own light: a soft glow in the water around the mouse (or
  // the last touch), which also catches the specks drifting through it.
  float near = u_light.z * exp(-length((uv - u_light.xy) * vec2(aspect, 1.0)) * 4.2);
  col += vec3(1.0, 0.3, 0.42) * near * 0.16;
  col += vec3(1.0, 0.62, 0.68) * s * (0.1 + 0.2 * lit + 1.6 * near);

  // At the bottom of the page, the app's orb glows in the deep.
  float r = length(q - vec2(0.0, 0.5));
  col += vec3(1.0, 0.25, 0.4) * u_orb * (0.4 * exp(-r * 5.5) + 0.1 * exp(-r * 1.6));

  float v = smoothstep(1.25, 0.25, length((uv - 0.5) * vec2(aspect * 0.7, 1.0)));
  col *= mix(0.6, 1.0, v);
  col += (hash(frag + fract(t)) - 0.5) * 0.012;

  float above = smoothstep(surf - 0.004, surf + 0.012, uv.y);
  gl_FragColor = vec4(mix(col, air, above * u_air), 1.0);
}
`;

function makeWater(canvas) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const u = Object.fromEntries(
    ['res', 'time', 'surf', 'rise', 'orb', 'light', 'air'].map((k) => [k, gl.getUniformLocation(prog, `u_${k}`)]),
  );
  return {
    resize() {
      // A soft scene, so render well below full resolution and let it scale
      // up: it looks the same and leaves the GPU room to keep the scroll
      // smooth (phones, with their dense screens, get a bit less again).
      const scale = Math.min(window.devicePixelRatio || 1, 2) * (coarse ? 0.3 : 0.45);
      const w = Math.max(1, Math.round(canvas.clientWidth * scale));
      const h = Math.max(1, Math.round(canvas.clientHeight * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    },
    draw(time, surf, rise, orb, light, air) {
      gl.uniform3f(u.light, light.x, light.y, light.z);
      gl.uniform1f(u.air, air);
      gl.uniform2f(u.res, canvas.width, canvas.height);
      gl.uniform1f(u.time, time);
      gl.uniform1f(u.surf, surf);
      gl.uniform1f(u.rise, rise);
      gl.uniform1f(u.orb, orb);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    // Free our objects but keep the context: React's dev double-mount
    // reuses this canvas straight away, and a lost context can't be had back.
    dispose() {
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    },
  };
}

// Where the surface sits on the first screen: just above the bottom edge.
// On a phone the hero's buttons reach right down there, so the water only
// shows as a thin lit line along the very bottom.
const SURFACE_AT_TOP = 0.07;
const SURFACE_AT_TOP_PHONE = 0.012;

export default function DeepWater() {
  const canvas = useRef(null);
  useEffect(() => {
    const el = canvas.current;
    const water = makeWater(el);
    if (!water) return undefined;
    const root = document.documentElement;
    root.classList.add('deep-water');
    // On touch screens the page scrolls on the phone's own scroller, which
    // runs ahead of anything drawn here, so a surface line drawn in the
    // canvas trailed the hero's buttons and wobbled mid-swipe. There the
    // canvas draws only the water and the hero itself carries the air and
    // the surface line (.deep-water--native-surface in styles.css), so the
    // line moves exactly with the page.
    const nativeSurface = window.matchMedia('(pointer: coarse)').matches;
    root.classList.toggle('deep-water--native-surface', nativeSurface);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = performance.now();
    let frame = 0;
    // The visitor's light: follows the mouse, or jumps to a touch, and eases
    // in and out (it fades when the mouse leaves or a touch has rested).
    const light = { x: 0.5, y: 0.5, z: 0, tx: 0.5, ty: 0.5, tz: 0 };
    let restTimer = 0;
    const aim = (e) => {
      light.tx = e.clientX / window.innerWidth;
      light.ty = 1 - e.clientY / (el.clientHeight || window.innerHeight);
      light.tz = 1;
      if (e.pointerType !== 'mouse') {
        clearTimeout(restTimer);
        restTimer = setTimeout(() => (light.tz = 0), 1800);
      }
      kick();
    };
    const dim = () => {
      light.tz = 0;
      kick();
    };
    // Sizes are read only when the layout changes, never in the frame loop:
    // reading them there, right after the scroll-linked pieces had written
    // their styles, made the browser lay out the whole page again every
    // frame, which stuttered on phones.
    let H = 1;
    let max = 1;
    let rest = SURFACE_AT_TOP;
    // Where the orb starts to glow: as the landing's closing scene
    // (.end-run) comes up, so it's lit for that whole long stretch — not
    // just the last bit of the page. Without that scene, the page's end.
    let orbFrom = Infinity;
    const measure = () => {
      water.resize();
      // Place the surface by the canvas's own height, not the window's: on
      // a phone the window grows and shrinks as the browser bar slides away
      // mid-scroll, which made the surface jump; the canvas is sized to the
      // largest viewport (100lvh), so its height holds steady.
      H = el.clientHeight || window.innerHeight;
      max = Math.max(1, root.scrollHeight - window.innerHeight);
      rest = window.innerWidth < 760 ? SURFACE_AT_TOP_PHONE : SURFACE_AT_TOP;
      const end = document.querySelector('.end-run');
      orbFrom = end ? end.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.6 : max * 0.94;
      kick();
    };
    const tick = (now) => {
      frame = 0;
      const y = window.scrollY;
      const orb = Math.min(Math.max((y - orbFrom) / (window.innerHeight * 0.6), 0), 1);
      const ease = reduce ? 1 : 0.08;
      light.x += (light.tx - light.x) * ease;
      light.y += (light.ty - light.y) * ease;
      light.z += (light.tz - light.z) * (reduce ? 1 : 0.05);
      water.draw(reduce ? 0 : (now - start) / 1000, rest + y / H, y / H, orb, light, nativeSurface ? 0 : 1);
      if (!reduce && !document.hidden) frame = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };
    // The shell grows as sections fill in with data (see DepthGauge).
    const ro = new ResizeObserver(measure);
    ro.observe(document.querySelector('.app-shell') || document.body);
    ro.observe(el);
    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', measure);
    window.addEventListener('pointermove', aim, { passive: true });
    window.addEventListener('pointerdown', aim, { passive: true });
    document.documentElement.addEventListener('pointerleave', dim);
    document.addEventListener('visibilitychange', kick);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener('scroll', kick);
      window.removeEventListener('resize', measure);
      window.removeEventListener('pointermove', aim);
      window.removeEventListener('pointerdown', aim);
      document.documentElement.removeEventListener('pointerleave', dim);
      clearTimeout(restTimer);
      document.removeEventListener('visibilitychange', kick);
      root.classList.remove('deep-water', 'deep-water--native-surface');
      water.dispose();
    };
  }, []);
  return <canvas className="deep-water-canvas" ref={canvas} aria-hidden="true" />;
}

// The depth gauge down the right edge of the landing page: a hairline with
// a stop for each place marked `data-depth="<label>"` on the page, and the
// orb sliding down it with the scroll. A stop counts as reached when its
// element's top crosses the middle of the screen. Hidden over the hero.
const MAX_DEPTH_M = 200;
export function DepthGauge() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    const list = el.querySelector('.depth-stops');
    const meter = el.querySelector('.depth-m');
    let stops = [];
    let frame = 0;
    const shown = { on: null, here: null, m: '' };
    // Page height, read with the stops rather than every frame (see
    // DeepWater's measure for why).
    let max = 1;
    const build = () => {
      const vh = window.innerHeight;
      max = Math.max(1, document.documentElement.scrollHeight - vh);
      stops = [...document.querySelectorAll('[data-depth]')].map((node) => {
        const top = node.getBoundingClientRect().top + window.scrollY;
        return { label: node.dataset.depth, at: Math.min(Math.max((top - vh / 2) / max, 0), 1) };
      });
      shown.here = null; // fresh stop elements: re-mark the current one
      list.replaceChildren(
        ...stops.map((s) => {
          const span = document.createElement('span');
          span.className = 'depth-stop';
          span.style.setProperty('--at', s.at);
          span.textContent = s.label;
          return span;
        }),
      );
    };
    const update = () => {
      frame = 0;
      const vh = window.innerHeight;
      const p = Math.min(Math.max(window.scrollY / max, 0), 1);
      el.style.setProperty('--p', p.toFixed(4));
      // Only touch the page when something actually changed: rewriting the
      // label and classes every frame cost a layout pass per frame.
      const on = window.scrollY > vh * 0.6;
      if (on !== shown.on) el.classList.toggle('is-on', (shown.on = on));
      let here = -1;
      stops.forEach((s, i) => {
        if (p >= s.at - 0.002) here = i;
      });
      if (here !== shown.here) {
        shown.here = here;
        [...list.children].forEach((c, i) => c.classList.toggle('is-here', i === here));
      }
      const m = `−${Math.round(p * MAX_DEPTH_M)} m`;
      if (m !== shown.m) meter.textContent = shown.m = m;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const rebuild = () => {
      build();
      onScroll();
    };
    // Sections fill in as data loads (reviews, supporters), which moves
    // everything below them, so re-measure whenever the page grows. That's
    // the app shell: html and body are pinned to the screen height, so they
    // never resize (the scroll-linked pieces in Welcome.jsx and DiveStory
    // watch the shell for the same reason).
    const ro = new ResizeObserver(rebuild);
    ro.observe(document.querySelector('.app-shell') || document.body);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', rebuild);
    rebuild();
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', rebuild);
    };
  }, []);
  return (
    <div className="depth-gauge" ref={ref} aria-hidden="true">
      <span className="depth-line" />
      <span className="depth-orb" />
      <span className="depth-stops" />
      <span className="depth-m">−0 m</span>
    </div>
  );
}
