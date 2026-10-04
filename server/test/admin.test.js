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

const visit = (body, token) => api(base, token).post('/visits', body);

test('visits count each browser once a day, with where it came from', async () => {
  const before = (await api(base, await adminToken()).get('/admin/stats')).body;
  assert.equal((await visit({ visitor_id: 'visitor-ig-0001', ref: 'ig', path: '/' })).status, 204);
  await visit({ visitor_id: 'visitor-ig-0001', path: '/login' }); // same browser, same day
  await visit({ visitor_id: 'visitor-tt-0002', referrer: 'https://www.tiktok.com/@deeper' });
  await visit({ visitor_id: 'visitor-dir-0003' });
  const { token } = await registerUser(base);
  await visit({ visitor_id: 'visitor-user-0004' }, token);
  assert.equal((await visit({ visitor_id: 'bad id!' })).status, 400);

  const after = (await api(base, await adminToken()).get('/admin/stats')).body;
  assert.equal(after.visitors_today, before.visitors_today + 4);
  assert.equal(after.guests_today, before.guests_today + 3);
  assert.equal(after.days.at(-1).visitors, after.visitors_today);
  const src = Object.fromEntries(after.sources.map((s) => [s.source, s.c]));
  assert.ok(src.instagram >= 1 && src.tiktok >= 1 && src.direct >= 2);
});

test('insights rank categories and questions and count returning users', async () => {
  const { token } = await registerUser(base);
  const user = api(base, token);
  await user.post('/saved', { question_text: 'คำถาม A', category: 'couple' });
  await user.post('/history', { question_text: 'คำถาม A', category: 'couple', my_answer: 'x' });
  await user.post('/history', { question_text: 'คำถาม B', category: 'friends', my_answer: 'y' });

  const { db } = await import('../src/db.js');
  const uid = db.prepare('SELECT user_id FROM user_activity ORDER BY rowid DESC LIMIT 1').get().user_id;
  db.prepare(`INSERT OR IGNORE INTO user_activity (day, user_id) VALUES (date('now', '+7 hours', '-1 day'), ?)`).run(uid);

  const res = await api(base, await adminToken()).get('/admin/insights');
  assert.equal(res.status, 200);
  assert.ok(res.body.answered_by_category.couple >= 1);
  assert.ok(res.body.saved_by_category.couple >= 1);
  assert.equal(res.body.top_saved[0].text, 'คำถาม A');
  assert.ok(res.body.returning_14d >= 1);
  assert.ok(res.body.active_14d >= res.body.returning_14d);
});

test('replying to a report needs an email and marks it replied', async () => {
  const admin = api(base, await adminToken());
  const send = async (fields) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    await fetch(`${base}/reports`, { method: 'POST', body: form });
    return (await admin.get('/admin/reports')).body.reports.find((r) => r.message === fields.message);
  };
  const noEmail = await send({ category: 'bug', message: 'ไม่มีอีเมล ติดต่อทาง IG', contact: '@someone' });
  const withEmail = await send({ category: 'idea', message: 'อยากได้โหมดใหม่', contact: 'fan@example.com' });

  const bad = await admin.post(`/admin/reports/${noEmail.id}/reply`);
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error_code, 'REPORT_NO_EMAIL');

  assert.equal((await admin.post(`/admin/reports/${withEmail.id}/reply`)).status, 200);
  const after = (await admin.get('/admin/reports')).body.reports.find((r) => r.id === withEmail.id);
  assert.ok(after.replied_at);
});

test('admin-added sponsors show on the public list and can be changed or removed', async () => {
  const token = await adminToken();
  const admin = api(base, token);
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  );
  const add = async (fields) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    form.append('logo', new Blob([PNG], { type: 'image/png' }), 'logo.png');
    const res = await fetch(`${base}/admin/sponsors`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    return { status: res.status, body: await res.json() };
  };

  assert.equal((await add({ name: 'X', tier: 'platinum' })).body.error_code, 'TIER_INVALID');
  assert.equal((await add({ name: 'X', tier: 'high', link: 'javascript:alert(1)' })).body.error_code, 'LINK_INVALID');
  const ok = await add({ name: 'บริษัทใจดี', tier: 'general', link: 'https://example.com' });
  assert.equal(ok.status, 200);
  const { id, logo_path } = ok.body.sponsor;

  const pub = async () => (await api(base).get('/support/sponsors')).body.sponsors;
  assert.deepEqual(await pub(), [{ name: 'บริษัทใจดี', tier: 'general', logo: logo_path, link: 'https://example.com/' }]);

  const res = await fetch(`${base}/admin/sponsors/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier: 'high' }),
  });
  assert.equal(res.status, 200);
  assert.equal((await pub())[0].tier, 'high');

  const del = await fetch(`${base}/admin/sponsors/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  assert.equal(del.status, 204);
  assert.deepEqual(await pub(), []);
  assert.equal((await admin.get('/admin/sponsors')).body.sponsors.length, 0);
});

test('declining a supporter name hides it, emails thanks, and can be undone by approving', async () => {
  const admin = api(base, await adminToken());
  const { token } = await registerUser(base);
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  );
  const form = new FormData();
  form.append('slip', new Blob([PNG], { type: 'image/png' }), 'slip.png');
  form.append('display_name', 'ชื่อไม่เหมาะสม');
  form.append('transfer_date', '2026-10-05');
  form.append('transfer_time', '09:00');
  form.append('amount', '100');
  await fetch(`${base}/support/proof`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });

  const before = (await admin.get('/admin/stats')).body.proofs_pending;
  const proof = (await admin.get('/admin/proofs')).body.proofs.find((p) => p.display_name === 'ชื่อไม่เหมาะสม');
  await admin.post(`/admin/proofs/${proof.id}/approve`);

  const res = await admin.post(`/admin/proofs/${proof.id}/reject`);
  assert.equal(res.status, 200);
  assert.equal(res.body.emailed, true);
  assert.ok(res.body.email);
  const names = async () => (await api(base).get('/support/supporters')).body.supporters;
  assert.ok(!(await names()).includes('ชื่อไม่เหมาะสม'));
  const after = (await admin.get('/admin/proofs')).body.proofs.find((p) => p.id === proof.id);
  assert.ok(after.rejected_at);
  assert.equal(after.approved_at, null);
  assert.equal((await admin.get('/admin/stats')).body.proofs_pending, before - 1);

  await admin.post(`/admin/proofs/${proof.id}/approve`);
  assert.ok((await names()).includes('ชื่อไม่เหมาะสม'));
  assert.equal((await admin.get('/admin/proofs')).body.proofs.find((p) => p.id === proof.id).rejected_at, null);

  const { db } = await import('../src/db.js');
  const fs = await import('node:fs');
  const { join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const uploads = join(fileURLToPath(new URL('..', import.meta.url)), 'uploads');
  const { slip_path: sp } = db.prepare('SELECT slip_path FROM support_proofs WHERE id = ?').get(proof.id);
  fs.rmSync(join(uploads, sp.replace(/^\/uploads\//, '')), { force: true });
});

test('a sponsorship inquiry is validated, listed for the admin and can be marked handled', async () => {
  const send = (body) => api(base).post('/sponsor-inquiries', body);
  const ok = { org_name: 'บริษัทใจดี จำกัด', contact_name: 'คุณเอ', contact: 'a@example.com', message: 'สนใจเป็นสปอนเซอร์ระดับเงิน' };
  assert.equal((await send({ ...ok, org_name: '' })).body.error_code, 'INQUIRY_ORG_REQUIRED');
  assert.equal((await send({ ...ok, contact: ' ' })).body.error_code, 'INQUIRY_CONTACT_REQUIRED');
  assert.equal((await send({ ...ok, message: 'hi' })).body.error_code, 'INQUIRY_MESSAGE_REQUIRED');

  const admin = api(base, await adminToken());
  const before = (await admin.get('/admin/stats')).body.inquiries_open;
  assert.equal((await send(ok)).status, 200);
  assert.equal((await admin.get('/admin/stats')).body.inquiries_open, before + 1);

  const item = (await admin.get('/admin/inquiries')).body.inquiries.find((i) => i.org_name === ok.org_name);
  assert.equal(item.contact, 'a@example.com');
  assert.equal((await admin.post(`/admin/inquiries/${item.id}/handled`)).status, 200);
  assert.equal((await admin.get('/admin/stats')).body.inquiries_open, before);
  assert.equal((await api(base).get('/admin/inquiries')).status, 401);
});
