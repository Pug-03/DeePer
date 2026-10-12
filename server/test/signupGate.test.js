import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, cleanupDb, api, registerUser, uniqueEmail, PASSWORD } from '../test-support/helpers.js';
const { resetInviteAttempts } = await import('../src/signupGate.js');

let server, base;
const OPEN = process.env.SIGNUP_OPENS_AT;
const CODE = '482913';

before(() => {
  ({ server, base } = startServer());
});

after(() => {
  server.close();
  cleanupDb();
});

afterEach(() => {
  process.env.SIGNUP_OPENS_AT = OPEN;
  delete process.env.INVITE_CODE;
  resetInviteAttempts();
});

const beforeLaunch = (code) => {
  process.env.SIGNUP_OPENS_AT = '2999-01-01T00:00:00Z';
  if (code) process.env.INVITE_CODE = code;
};
const check = (code) => api(base).post('/auth/invite/check', { invite_code: code });

test('before launch, signing up without an invite code is refused', async () => {
  beforeLaunch(CODE);
  const anon = api(base);
  const res = await anon.post('/auth/otp/request', { email: uniqueEmail('gate') });
  assert.equal(res.status, 403);
  assert.equal(res.body.error_code, 'INVITE_REQUIRED');
  assert.equal((await anon.get('/auth/config')).body.invite_required, true);
});

test('before launch, a wrong invite code is refused and the right one works', async () => {
  beforeLaunch(CODE);
  const wrong = await check('111111');
  assert.equal(wrong.status, 403);
  assert.equal(wrong.body.error_code, 'INVITE_INVALID');
  assert.equal(wrong.body.tries_left, 3);
  assert.equal((await check(CODE)).status, 200);
  const otp = await api(base).post('/auth/otp/request', { email: uniqueEmail('gate'), invite_code: CODE });
  assert.equal(otp.status, 200);
});

test('4 wrong codes lock for 30 s, 6 for 15 min — even the right code is refused meanwhile', async () => {
  beforeLaunch(CODE);
  for (let i = 0; i < 3; i++) assert.equal((await check('000000')).status, 403);
  const fourth = await check('000000');
  assert.equal(fourth.status, 429);
  assert.equal(fourth.body.error_code, 'INVITE_LOCKED');
  assert.ok(fourth.body.retry_after > 25 && fourth.body.retry_after <= 30);
  assert.equal((await check(CODE)).status, 429);
});

test('a right code clears the wrong-code count', async () => {
  beforeLaunch(CODE);
  for (let i = 0; i < 3; i++) await check('000000');
  assert.equal((await check(CODE)).status, 200);
  assert.equal((await check('000000')).body.tries_left, 3);
});

test('before launch with no INVITE_CODE set, nobody can sign up', async () => {
  beforeLaunch();
  assert.equal((await check('123456')).status, 403);
});

test('logging in to an existing account is never gated', async () => {
  const { email } = await registerUser(base);
  beforeLaunch(CODE);
  const res = await api(base).post('/auth/login', { email, password: PASSWORD });
  assert.equal(res.status, 200);
  assert.ok(res.body.token);
});

test('from launch on, no invite code is needed', async () => {
  const anon = api(base);
  assert.equal((await anon.get('/auth/config')).body.invite_required, false);
  assert.equal((await anon.post('/auth/otp/request', { email: uniqueEmail('open') })).status, 200);
});
