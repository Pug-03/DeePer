import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import fs from 'node:fs';

import { db } from './db.js'; // initialize + seed
import authRoutes from './routes/auth.js';
import questionRoutes from './routes/questions.js';
import dataRoutes from './routes/data.js';
import supportRoutes from './routes/support.js';
import reportRoutes from './routes/reports.js';
import adminRoutes from './routes/admin.js';
import visitRoutes from './routes/visits.js';
import inquiryRoutes from './routes/inquiries.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const app = express();

// Most hosts (Render/Railway/Fly.io/behind nginx) put a proxy in front of
// the app, so express otherwise sees every request as coming from that
// proxy's own IP — which would make the login/OTP rate limiter below share
// one bucket across every visitor instead of limiting per-visitor. Off by
// default (safe for a bare `node src/index.js` with no proxy in front,
// where trusting it would let a client fake its own IP via
// X-Forwarded-For and dodge the rate limit entirely) — set TRUST_PROXY=true
// once actually deployed behind one.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : process.env.TRUST_PROXY);
}

// Auth is Bearer-token based (no cookies), so an open CORS policy can't be
// used to ride a browser's existing session — but it's still tightened
// here whenever the deployer bothers to set CORS_ORIGIN. Left wide open by
// default so the app keeps working out of the box with zero config.
const corsOrigins = String(process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
// CSP is scoped to the exact third parties the client actually loads (Google
// Identity's script/iframe for the Google Sign-In button, Google Fonts) —
// everything else stays same-origin. crossOriginEmbedderPolicy is off
// because Google's Sign-In iframe doesn't send the CORP header COEP requires.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://accounts.google.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'https://accounts.google.com'],
        frameSrc: ['https://accounts.google.com'],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(cors(corsOrigins.length ? { origin: corsOrigins } : {}));
app.use(express.json({ limit: '256kb' }));

const uploadsDir = join(__dirname, '..', 'uploads');
fs.mkdirSync(join(uploadsDir, 'avatars'), { recursive: true });
fs.mkdirSync(join(uploadsDir, 'slips'), { recursive: true });
app.use('/uploads', express.static(uploadsDir));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
// Public landing-page stats — site-wide totals only, no per-user data.
app.get('/api/stats', (_req, res) => {
  const { c } = db.prepare('SELECT COUNT(*) AS c FROM users').get();
  const counters = Object.fromEntries(
    db.prepare('SELECT key, value FROM stat_counters').all().map((r) => [r.key, r.value]),
  );
  res.json({
    user_count: c,
    swipe_count: counters.swiped ?? 0,
    answer_count: counters.answered ?? 0,
    save_count: counters.saved ?? 0,
    share_count: counters.shared ?? 0,
  });
});
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/sponsor-inquiries', inquiryRoutes);
app.use('/api', dataRoutes);

// Serve the built client in production (client/dist), if present.
const clientDist = join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(join(clientDist, 'index.html'));
  });
}

// Fallback for anything a route didn't catch itself (sync throws, bad JSON
// bodies, etc.) — without this express's default handler echoes the raw
// error (stack trace included) back to the client.
app.use((err, req, res, _next) => {
  console.error('[unhandled]', err);
  res.status(err.status || 500).json({ error: 'เกิดข้อผิดพลาดบางอย่าง', error_code: 'INTERNAL_ERROR' });
});
