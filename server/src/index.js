import { app } from './app.js';
import { startSupportDigestScheduler } from './support-digest.js';
import { db, pruneOldRows } from './db.js';

const PORT = Number(process.env.PORT || 4000);
const server = app.listen(PORT, () => {
  console.log(`[DeePer] เซิร์ฟเวอร์ทำงานที่ http://localhost:${PORT}`);
  startSupportDigestScheduler();
  setInterval(pruneOldRows, 24 * 60 * 60 * 1000).unref();
});

// Logged instead of crashing the process (Node's default), so one bad
// promise can't take the site down for everyone.
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));

// Render sends SIGTERM on every deploy/restart: stop taking requests, let
// the ones in flight finish, then close the database cleanly.
const shutdown = (signal) => {
  console.log(`[DeePer] ${signal}, shutting down`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
