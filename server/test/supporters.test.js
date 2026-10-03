import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { startServer, cleanupDb, api, registerUser } from '../test-support/helpers.js';

const UPLOADS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'uploads');

// Same module instance as the running app (helpers.js already loaded it),
// so this talks to the test file's own database.
const { approveProofs, revokeProofs } = await import('../src/supporters.js');

let server, base;

before(() => {
  ({ server, base } = startServer());
});

after(async () => {
  // Proof uploads land in the real uploads/slips folder — delete the ones
  // this file created before its database (which lists them) goes away.
  const { db } = await import('../src/db.js');
  for (const { slip_path: p } of db.prepare('SELECT slip_path FROM support_proofs').all()) {
    fs.rmSync(join(UPLOADS_DIR, p.replace(/^\/uploads\//, '')), { force: true });
  }
  server.close();
  cleanupDb();
});

// 1x1 transparent PNG — just enough for the slip upload filter.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

async function submitProof(token, displayName) {
  const form = new FormData();
  form.append('slip', new Blob([PNG], { type: 'image/png' }), 'slip.png');
  form.append('display_name', displayName);
  form.append('transfer_date', '2026-10-04');
  form.append('transfer_time', '12:00');
  form.append('amount', '100');
  const res = await fetch(`${base}/support/proof`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  assert.equal(res.status, 200);
}

test('a donor name only goes public once its proof is approved', async () => {
  const { token } = await registerUser(base);
  await submitProof(token, 'มิว');
  const { db } = await import('../src/db.js');
  const { id } = db.prepare(`SELECT id FROM support_proofs WHERE display_name = 'มิว'`).get();

  const before = await api(base).get('/support/supporters');
  assert.equal(before.status, 200);
  assert.deepEqual(before.body.supporters, []);

  assert.deepEqual(approveProofs([id, 999999]), [id]);
  const approved = await api(base).get('/support/supporters');
  assert.deepEqual(approved.body.supporters, ['มิว']);

  revokeProofs([id]);
  const revoked = await api(base).get('/support/supporters');
  assert.deepEqual(revoked.body.supporters, []);
});

test('the same name donating twice is listed once, with no amounts', async () => {
  const { token } = await registerUser(base);
  await submitProof(token, 'Mew');
  await submitProof(token, 'Mew');
  const { db } = await import('../src/db.js');
  const ids = db.prepare(`SELECT id FROM support_proofs WHERE display_name = 'Mew'`).all().map((r) => r.id);
  approveProofs(ids);
  const res = await api(base).get('/support/supporters');
  assert.deepEqual(res.body.supporters, ['Mew']);
  assert.ok(!JSON.stringify(res.body).includes('100'));
});
