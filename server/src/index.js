import { app } from './app.js';
import { startSupportDigestScheduler } from './support-digest.js';
import { pruneOldRows } from './db.js';

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`[DeePer] เซิร์ฟเวอร์ทำงานที่ http://localhost:${PORT}`);
  startSupportDigestScheduler();
  setInterval(pruneOldRows, 24 * 60 * 60 * 1000).unref();
});
