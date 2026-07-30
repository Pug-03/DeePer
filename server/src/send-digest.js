// Manually send the supporter digest right now (ignores the 15-day timer).
// Useful for testing SMTP and for an on-demand send:  npm run digest
import 'dotenv/config';
import { runSupportDigest } from './support-digest.js';

runSupportDigest({ force: true })
  .then((r) => {
    console.log('[digest]', JSON.stringify(r));
    process.exit(0);
  })
  .catch((e) => {
    console.error('[digest] failed:', e);
    process.exit(1);
  });
