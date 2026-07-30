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

app.use(cors());
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
