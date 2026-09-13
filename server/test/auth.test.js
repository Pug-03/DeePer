import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, cleanupDb, api, registerUser, uniqueEmail, PASSWORD } from '../test-support/helpers.js';

let server, base;

before(() => {
  ({ server, base } = startServer());
});

after(() => {
  server.close();
  cleanupDb();
});

test('register issues a working session', async () => {
  const { token } = await registerUser(base);
  const me = await api(base, token).get('/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.user.nickname, 'Tester');
});

test('login with the wrong password is rejected', async () => {
  const { email } = await registerUser(base);
  const res = await api(base).post('/auth/login', { email, password: 'wrong-password' });
  assert.equal(res.status, 401);
  assert.equal(res.body.error_code, 'LOGIN_INVALID');
});

test('requests with no token are rejected', async () => {
  const res = await api(base).get('/auth/me');
  assert.equal(res.status, 401);
  assert.equal(res.body.error_code, 'AUTH_REQUIRED');
});

test('requests with a garbage token are rejected', async () => {
  const res = await api(base, 'not-a-real-token').get('/auth/me');
  assert.equal(res.status, 401);
  assert.equal(res.body.error_code, 'SESSION_EXPIRED');
});

test('logging in twice creates two independent sessions', async () => {
  const email = uniqueEmail('two-sessions');
  const { token: tokenA } = await registerUser(base, { email });
  const loginRes = await api(base).post('/auth/login', { email, password: PASSWORD });
  const tokenB = loginRes.body.token;

  assert.equal((await api(base, tokenA).get('/auth/me')).status, 200);
  assert.equal((await api(base, tokenB).get('/auth/me')).status, 200);

  const history = await api(base, tokenB).get('/auth/me/login-history');
  assert.equal(history.body.total, 2);
});

test('revoking one session does not affect the other', async () => {
  const email = uniqueEmail('revoke-one');
  const { token: tokenA } = await registerUser(base, { email });
  const { body: loginBody } = await api(base).post('/auth/login', { email, password: PASSWORD });
  const tokenB = loginBody.token;

  const historyA = await api(base, tokenA).get('/auth/me/login-history');
  const sessionIdA = historyA.body.current_id;

  const revoke = await api(base, tokenB).del(`/auth/me/login-history/${sessionIdA}`);
  assert.equal(revoke.status, 200);

  assert.equal((await api(base, tokenA).get('/auth/me')).status, 401, 'session A should now be dead');
  assert.equal((await api(base, tokenB).get('/auth/me')).status, 200, 'session B should be untouched');
});

test('revoking your own current session logs you out immediately', async () => {
  const { token } = await registerUser(base);
  const history = await api(base, token).get('/auth/me/login-history');
  const ownSessionId = history.body.current_id;

  await api(base, token).del(`/auth/me/login-history/${ownSessionId}`);
  assert.equal((await api(base, token).get('/auth/me')).status, 401);
});

test('revoking a nonexistent session id is a harmless no-op', async () => {
  const { token } = await registerUser(base);
  const res = await api(base, token).del('/auth/me/login-history/999999999');
  assert.equal(res.status, 200);
  assert.equal((await api(base, token).get('/auth/me')).status, 200, 'own session must still be alive');
});

test('logout-other-devices revokes every other session but keeps the caller alive', async () => {
  const email = uniqueEmail('logout-others');
  const { token: tokenA } = await registerUser(base, { email });
  const { body: loginBody1 } = await api(base).post('/auth/login', { email, password: PASSWORD });
  const { body: loginBody2 } = await api(base).post('/auth/login', { email, password: PASSWORD });
  const tokenB = loginBody1.token;
  const tokenC = loginBody2.token;

  const res = await api(base, tokenC).post('/auth/me/logout-other-devices');
  assert.equal(res.status, 200);

  assert.equal((await api(base, tokenA).get('/auth/me')).status, 401);
  assert.equal((await api(base, tokenB).get('/auth/me')).status, 401);
  assert.equal((await api(base, tokenC).get('/auth/me')).status, 200, 'the calling session must survive');
});

test('login history reports device info parsed from the User-Agent', async () => {
  const { token } = await registerUser(base, {
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  });
  const history = await api(base, token).get('/auth/me/login-history');
  assert.equal(history.status, 200);
  assert.match(history.body.login_history[0].user_agent, /Chrome/);
});
