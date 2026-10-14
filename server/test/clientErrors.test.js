import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { startServer, cleanupDb, api } from '../test-support/helpers.js';

const ADMIN_EMAIL = 'admin-errors@example.com';
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

const report = (body) => api(base).post('/client-errors', body);

test('the same browser error from several visitors is one row with a count', async () => {
  const err = { message: 'TypeError: x is undefined', stack: 'TypeError: x\n    at f (https://deeper.in.th/assets/a.js:1:200)', url: '/app/home' };
  assert.equal((await report(err)).status, 204);
  assert.equal((await report(err)).status, 204);
  assert.equal((await report({ ...err, message: 'Another' })).status, 204);
  assert.equal((await report({ message: '' })).status, 400);

  const { errors } = (await admin.get('/admin/client-errors')).body;
  const row = errors.find((e) => e.message === err.message);
  assert.equal(row.count, 2);
  assert.equal(errors.filter((e) => e.message === 'Another').length, 1);
  assert.ok((await admin.get('/admin/stats')).body.client_errors_open >= 2);
});

test('a fixed error that happens again reopens', async () => {
  const err = { message: 'ReferenceError: y', stack: 'at g (https://deeper.in.th/assets/b.js:2:10)' };
  await report(err);
  let row = (await admin.get('/admin/client-errors')).body.errors.find((e) => e.message === err.message);
  assert.equal((await admin.post(`/admin/client-errors/${row.id}/resolve`)).status, 200);
  row = (await admin.get('/admin/client-errors')).body.errors.find((e) => e.id === row.id);
  assert.ok(row.resolved_at);
  await report(err);
  row = (await admin.get('/admin/client-errors')).body.errors.find((e) => e.id === row.id);
  assert.equal(row.resolved_at, null);
  assert.equal(row.count, 2);
});

test('error list is admin-only', async () => {
  assert.equal((await api(base).get('/admin/client-errors')).status, 401);
});
