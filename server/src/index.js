import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import fs from 'node:fs';

import './db.js'; // initialize + seed
import authRoutes from './routes/auth.js';
import questionRoutes from './routes/questions.js';
import dataRoutes from './routes/data.js';
import supportRoutes from './routes/support.js';
import { startSupportDigestScheduler } from './support-digest.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

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
app.use(cors(corsOrigins.length ? { origin: corsOrigins } : {}));
app.use(express.json({ limit: '256kb' }));

const uploadsDir = join(__dirname, '..', 'uploads');
fs.mkdirSync(join(uploadsDir, 'avatars'), { recursive: true });
fs.mkdirSync(join(uploadsDir, 'slips'), { recursive: true });
app.use('/uploads', express.static(uploadsDir));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/support', supportRoutes);
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

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`[DeePer] เซิร์ฟเวอร์ทำงานที่ http://localhost:${PORT}`);
  startSupportDigestScheduler();
});
