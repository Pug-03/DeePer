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

test('the emailed review link approves and hides a name, but only via POST', async () => {
  const { token } = await registerUser(base);
  await submitProof(token, 'น้ำ');
  const { db } = await import('../src/db.js');
  const { review_token: rt } = db.prepare(`SELECT review_token FROM support_proofs WHERE display_name = 'น้ำ'`).get();
  assert.match(rt, /^[0-9a-f]{48}$/);
  const names = async () => (await api(base).get('/support/supporters')).body.supporters;

  // Opening the link (as a mail scanner would) shows the proof, changes nothing.
  const page = await fetch(`${base}/support/review/${rt}`);
  assert.equal(page.status, 200);
  assert.ok((await page.text()).includes('น้ำ'));
  assert.ok(!(await names()).includes('น้ำ'));

  const approve = await fetch(`${base}/support/review/${rt}/approve`, { method: 'POST', redirect: 'manual' });
  assert.equal(approve.status, 303);
  assert.ok((await names()).includes('น้ำ'));

  await fetch(`${base}/support/review/${rt}/revoke`, { method: 'POST', redirect: 'manual' });
  assert.ok(!(await names()).includes('น้ำ'));
});

test('an unknown review token is a 404 and approves nothing', async () => {
  const page = await fetch(`${base}/support/review/deadbeef`);
  assert.equal(page.status, 404);
  const post = await fetch(`${base}/support/review/deadbeef/approve`, { method: 'POST', redirect: 'manual' });
  assert.equal(post.status, 404);
});

test('a slip that is not really an image is turned away and not kept', async () => {
  const { token } = await registerUser(base);
  const slipsDir = join(UPLOADS_DIR, 'slips');
  // Compare names, not counts: an earlier test's rejected upload may still
  // be being removed in the background.
  const before = new Set(fs.readdirSync(slipsDir));
  const form = new FormData();
  form.append('slip', new Blob([Buffer.from('not really a png')], { type: 'image/png' }), 'slip.png');
  form.append('display_name', 'ปลอม');
  form.append('transfer_date', '2026-10-04');
  form.append('transfer_time', '12:00');
  form.append('amount', '100');
  const res = await fetch(`${base}/support/proof`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error_code, 'SLIP_UPLOAD_FAILED');
  // The file is removed asynchronously; give it a moment.
  await new Promise((r) => setTimeout(r, 50));
  assert.deepEqual(fs.readdirSync(slipsDir).filter((f) => !before.has(f)), []);
});
