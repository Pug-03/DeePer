import { app } from './app.js';
import { startSupportDigestScheduler } from './support-digest.js';

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`[DeePer] เซิร์ฟเวอร์ทำงานที่ http://localhost:${PORT}`);
  startSupportDigestScheduler();
});
