import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { startServer, cleanupDb, api, registerUser } from '../test-support/helpers.js';

// Test-only credentials; the real ones live in the deploy's env vars.
const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'test-admin-pass';

let server, base;

before(() => {
  process.env.ADMIN_EMAIL = ADMIN_EMAIL;
  process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync(ADMIN_PASSWORD, 4);
  ({ server, base } = startServer());
});

after(() => {
  server.close();
  cleanupDb();
});

const login = (email, password) => api(base).post('/auth/login', { email, password });

async function adminToken() {
  const res = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  assert.equal(res.status, 200);
  assert.equal(res.body.token, undefined);
  return res.body.admin_token;
}

test('the user login form signs the admin in with an admin token', async () => {
  assert.equal((await login(ADMIN_EMAIL, 'wrong')).status, 401);
  assert.equal((await login('someone@example.com', ADMIN_PASSWORD)).status, 401);
  assert.ok(await adminToken());
  // Email match ignores case and surrounding spaces.
  assert.ok((await login(' Admin@Example.com ', ADMIN_PASSWORD)).body.admin_token);
});

test('admin routes reject guests and regular user tokens', async () => {
  assert.equal((await api(base).get('/admin/stats')).status, 401);
  const { token } = await registerUser(base);
  assert.equal((await api(base, token).get('/admin/stats')).status, 401);
});

test('stats count today’s signups and active users', async () => {
  const before = (await api(base, await adminToken()).get('/admin/stats')).body;
  const { token } = await registerUser(base);
  await api(base, token).get('/auth/me');
  const after = (await api(base, await adminToken()).get('/admin/stats')).body;
  assert.equal(after.users_total, before.users_total + 1);
  assert.equal(after.signups_today, before.signups_today + 1);
  assert.equal(after.active_today, before.active_today + 1);
  assert.equal(after.days.length, 14);
  assert.equal(after.days.at(-1).active, after.active_today);
});

test('admin can resolve a report and approve a proof onto the public list', async () => {
  const admin = api(base, await adminToken());

  const form = new FormData();
  form.append('category', 'bug');
  form.append('message', 'หน้าโปรไฟล์โหลดไม่ขึ้น');
  await fetch(`${base}/reports`, { method: 'POST', body: form });
  const report = (await admin.get('/admin/reports')).body.reports[0];
  assert.equal(report.resolved_at, null);
  assert.equal((await admin.post(`/admin/reports/${report.id}/resolve`)).status, 200);
  assert.ok((await admin.get('/admin/reports')).body.reports.find((r) => r.id === report.id).resolved_at);

  const { db } = await import('../src/db.js');
  const { lastInsertRowid: proofId } = db
    .prepare(
      `INSERT INTO support_proofs (display_name, transfer_date, transfer_time, amount, slip_path)
       VALUES ('ใจดี', '2026-10-05', '10:00', 50, '/uploads/slips/x.png')`,
    )
    .run();
  assert.equal((await admin.post(`/admin/proofs/${proofId}/approve`)).status, 200);
  assert.ok((await api(base).get('/support/supporters')).body.supporters.includes('ใจดี'));
  assert.equal((await admin.post('/admin/proofs/999999/approve')).status, 404);
});
