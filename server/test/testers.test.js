import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { startServer, cleanupDb, api, uniqueEmail } from '../test-support/helpers.js';

const ADMIN_EMAIL = 'admin-testers@example.com';
const ADMIN_PASSWORD = 'test-admin-pass';
let server, base, admin;

before(async () => {
  process.env.ADMIN_EMAIL = ADMIN_EMAIL;
  process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync(ADMIN_PASSWORD, 4);
  ({ server, base } = startServer());
  const res = await api(base).post('/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  admin = api(base, res.body.admin_token);
});

after(() => {
  server.close();
  cleanupDb();
});

afterEach(() => {
  delete process.env.INVITE_CODE;
});

const ask = (body) => api(base).post('/tester-requests', body);

test('asking to test needs a nickname, a valid email and where they heard of us', async () => {
  assert.equal((await ask({ email: uniqueEmail('t'), source: 'tiktok' })).body.error_code, 'NICKNAME_REQUIRED');
  assert.equal((await ask({ nickname: 'Mint', email: 'nope', source: 'tiktok' })).body.error_code, 'INVALID_EMAIL');
  assert.equal(
    (await ask({ nickname: 'Mint', email: uniqueEmail('t'), source: 'radio' })).body.error_code,
    'TESTER_SOURCE_REQUIRED',
  );
  assert.equal((await ask({ nickname: 'Mint', email: uniqueEmail('t'), source: 'tiktok' })).status, 200);
});

test('several sources can be picked and are stored together', async () => {
  const email = uniqueEmail('multi');
  assert.equal((await ask({ nickname: 'Fah', email, source: ['friend', 'instagram', 'other'], source_other: 'งานแต่ง' })).status, 200);
  assert.equal(
    (await ask({ nickname: 'Fah', email: uniqueEmail('t'), source: ['friend', 'radio'] })).body.error_code,
    'TESTER_SOURCE_REQUIRED',
  );
  assert.equal((await ask({ nickname: 'Fah', email: uniqueEmail('t'), source: [] })).body.error_code, 'TESTER_SOURCE_REQUIRED');

  const r = (await admin.get('/admin/tester-requests')).body.requests.find((x) => x.email === email);
  assert.equal(r.source, 'instagram,friend,other');
  assert.equal(r.source_other, 'งานแต่ง');
});

test('admin sees the request with the email ready to send, then sends it', async () => {
  const email = uniqueEmail('invite');
  await ask({ nickname: 'Ploy', email, source: 'other', source_other: 'งานสัมมนา' });
  // Asking again with the same email updates instead of duplicating.
  await ask({ nickname: 'Ploy P.', email, source: 'other', source_other: 'งานสัมมนา' });

  let list = (await admin.get('/admin/tester-requests')).body;
  let r = list.requests.filter((x) => x.email === email);
  assert.equal(r.length, 1);
  r = r[0];
  assert.equal(r.nickname, 'Ploy P.');
  assert.equal(r.source_other, 'งานสัมมนา');

  // No code set yet: the preview says so and sending is refused.
  assert.equal(list.invite_code_set, false);
  assert.equal((await admin.post(`/admin/tester-requests/${r.id}/invite`)).body.error_code, 'INVITE_CODE_MISSING');

  process.env.INVITE_CODE = '140508';
  list = (await admin.get('/admin/tester-requests')).body;
  r = list.requests.find((x) => x.email === email);
  assert.match(r.email_preview.text, /140508/);
  assert.match(r.email_preview.text, /Ploy P\./);
  assert.equal((await admin.get('/admin/stats')).body.tester_requests_open >= 1, true);

  assert.equal((await admin.post(`/admin/tester-requests/${r.id}/invite`)).status, 200);
  r = (await admin.get('/admin/tester-requests')).body.requests.find((x) => x.email === email);
  assert.ok(r.invited_at);

  // Asking again after the code went out brings it back as a new request.
  await ask({ nickname: 'Ploy', email, source: 'tiktok' });
  const again = (await admin.get('/admin/tester-requests')).body.requests;
  r = again.find((x) => x.email === email);
  assert.equal(r.invited_at, null);
  assert.equal(again.filter((x) => x.email === email).length, 1);
});

test('admin can edit the invite mail, as long as the code stays in', async () => {
  const email = uniqueEmail('edit');
  await ask({ nickname: 'Fon', email, source: 'friend' });
  process.env.INVITE_CODE = '271828';
  const r = (await admin.get('/admin/tester-requests')).body.requests.find((x) => x.email === email);
  const without = await admin.post(`/admin/tester-requests/${r.id}/invite`, { subject: 'สวัสดี', text: 'ไม่มีรหัส' });
  assert.equal(without.body.error_code, 'INVITE_CODE_NOT_IN_TEXT');
  const ok = await admin.post(`/admin/tester-requests/${r.id}/invite`, { subject: 'สวัสดี Fon', text: 'รหัสของคุณ 271828' });
  assert.equal(ok.status, 200);
});

test('tester requests are admin-only', async () => {
  assert.equal((await api(base).get('/admin/tester-requests')).status, 401);
});
