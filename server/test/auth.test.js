import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, cleanupDb, api, registerUser, uniqueEmail, PASSWORD } from '../test-support/helpers.js';
// Same in-process database the server under test uses (helpers sets DB_PATH first).
const { db } = await import('../src/db.js');

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
  assert.equal(me.body.user.nickname, 'เทสเตอร์');
});

test('the nickname is required but can be in any language', async () => {
  const cases = [
    ['', 400, 'NICKNAME_REQUIRED'],
    ['   ', 400, 'NICKNAME_REQUIRED'],
    ['x'.repeat(41), 400, 'NICKNAME_TOO_LONG'],
    ['Pluck', 200],
    ['ปลั๊ก', 200],
    ['ปลั๊ก Pluck', 200],
  ];
  for (const [nickname, status, code] of cases) {
    const email = uniqueEmail('n');
    const anon = api(base);
    const otp = await anon.post('/auth/otp/request', { email });
    const res = await anon.post('/auth/register', {
      email,
      code: otp.body.dev_code,
      nickname,
      age: 25,
      gender: 'other',
      password: PASSWORD,
      accept_privacy: true,
    });
    assert.equal(res.status, status, nickname);
    if (code) assert.equal(res.body.error_code, code);
    else assert.equal(res.body.user.nickname, nickname);
  }
});

test('changing the nickname on the profile', async () => {
  const { token } = await registerUser(base);
  const me = api(base, token);
  const ok = await me.patch('/auth/me', { nickname: 'Pluck' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.nickname, 'Pluck');
  assert.equal(ok.body.user.nickname_en, null);
  const bad = await me.patch('/auth/me', { nickname: '' });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error_code, 'NICKNAME_REQUIRED');
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

test('the CSP lets in blob: previews and the Google button stylesheet', async () => {
  const res = await fetch(`${base}/health`);
  const csp = res.headers.get('content-security-policy');
  assert.match(csp, /img-src[^;]*blob:/);
  assert.match(csp, /style-src[^;]*https:\/\/accounts\.google\.com\/gsi\/style/);
});

test('changing the password signs out every other device but keeps this one', async () => {
  const email = uniqueEmail('pw-change');
  const { token: here } = await registerUser(base, { email });
  const other = (await api(base).post('/auth/login', { email, password: PASSWORD })).body.token;

  const res = await api(base, here).post('/auth/me/password', {
    current_password: PASSWORD,
    new_password: 'Bb2@bbbb',
  });
  assert.equal(res.status, 200);
  assert.equal((await api(base, here).get('/auth/me')).status, 200);
  assert.equal((await api(base, other).get('/auth/me')).status, 401);
});

test('resetting a forgotten password signs out every existing session', async () => {
  const email = uniqueEmail('pw-reset');
  const { token: old } = await registerUser(base, { email });
  const anon = api(base);
  const req = await anon.post('/auth/password-reset/request', { email });
  await anon.post('/auth/password-reset/verify', { email, code: req.body.dev_code });
  const res = await anon.post('/auth/password-reset/confirm', {
    email,
    code: req.body.dev_code,
    password: 'Cc3#cccc',
  });
  assert.equal(res.status, 200);
  assert.equal((await api(base, old).get('/auth/me')).status, 401);
  assert.equal((await api(base, res.body.token).get('/auth/me')).status, 200);
});

test('age must be a whole number from 1 to 90, at signup and on the profile', async () => {
  for (const age of [0, -5, 91, 121, 999, 2.5]) {
    const email = uniqueEmail('age');
    const anon = api(base);
    const otp = await anon.post('/auth/otp/request', { email });
    const res = await anon.post('/auth/register', {
      email,
      code: otp.body.dev_code,
      nickname: 'เทสเตอร์',
      nickname_en: 'Tester',
      age,
      gender: 'other',
      password: PASSWORD,
    });
    assert.equal(res.status, 400, `register age ${age}`);
    assert.equal(res.body.error_code, 'AGE_INVALID');
  }

  const { token } = await registerUser(base);
  const me = api(base, token);
  for (const age of [0, 91, 999, -5]) {
    const bad = await me.patch('/auth/me', { age });
    assert.equal(bad.status, 400, `profile age ${age}`);
    assert.equal(bad.body.error_code, 'AGE_INVALID');
  }
  for (const age of [1, 90]) {
    const edge = await me.patch('/auth/me', { age });
    assert.equal(edge.status, 200, `profile age ${age}`);
  }
  const ok = await me.patch('/auth/me', { age: 30 });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.age, 30);
});

test('a profile picture must really be an image, whatever its type claims', async () => {
  const { token } = await registerUser(base);
  const upload = (bytes) => {
    const form = new FormData();
    form.append('avatar', new Blob([bytes], { type: 'image/png' }), 'a.png');
    return fetch(`${base}/auth/me/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  };
  const fake = await upload(Buffer.from('not really a png'));
  assert.equal(fake.status, 400);
  assert.equal((await fake.json()).error_code, 'AVATAR_TYPE_INVALID');

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  );
  const real = await upload(png);
  assert.equal(real.status, 200);
  assert.ok((await real.json()).user.avatar_url);
  await api(base, token).del('/auth/me/avatar');
});

test('profile edits reject a blank age and an unknown gender', async () => {
  const { token } = await registerUser(base);
  const me = api(base, token);

  const blankAge = await me.patch('/auth/me', { age: '' });
  assert.equal(blankAge.status, 400);
  assert.equal(blankAge.body.error_code, 'AGE_REQUIRED');

  const badGender = await me.patch('/auth/me', { gender: 'robot' });
  assert.equal(badGender.status, 400);
  assert.equal(badGender.body.error_code, 'GENDER_INVALID');

  const blankGender = await me.patch('/auth/me', { gender: '' });
  assert.equal(blankGender.status, 400);
  assert.equal(blankGender.body.error_code, 'GENDER_REQUIRED');

  const ok = await me.patch('/auth/me', { gender: 'female' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.gender, 'female');
});

test('signing up needs the privacy policy accepted, and records when', async () => {
  const anon = api(base);
  const email = uniqueEmail('pdpa');
  const otp = await anon.post('/auth/otp/request', { email });
  const body = { email, code: otp.body.dev_code, nickname: 'เทสเตอร์', age: 25, gender: 'other', password: PASSWORD };

  for (const accept_privacy of [undefined, false, 'yes']) {
    const res = await anon.post('/auth/register', { ...body, accept_privacy });
    assert.equal(res.status, 400, `accept_privacy ${accept_privacy}`);
    assert.equal(res.body.error_code, 'PRIVACY_REQUIRED');
  }

  const ok = await anon.post('/auth/register', { ...body, accept_privacy: true });
  assert.equal(ok.status, 200);
  const row = db.prepare('SELECT privacy_accepted_at, privacy_version FROM users WHERE email = ?').get(email);
  assert.ok(row.privacy_accepted_at);
  assert.ok(row.privacy_version);
});

test('a reset code dies after a few wrong guesses, and asking again voids the old code', async () => {
  const email = uniqueEmail('otp-guard');
  await registerUser(base, { email });
  const anon = api(base);
  const first = (await anon.post('/auth/password-reset/request', { email })).body.dev_code;
  const second = (await anon.post('/auth/password-reset/request', { email })).body.dev_code;
  // Only the newest code works.
  if (first !== second) {
    assert.equal((await anon.post('/auth/password-reset/verify', { email, code: first })).body.error_code, 'OTP_INVALID');
  }
  // Wrong guesses use the code up, even if the right one comes next.
  const wrong = second === '1111' ? '2222' : '1111';
  // (The old code above already counted as one wrong guess.)
  const codes = [];
  for (let i = 0; i < 5; i++) codes.push((await anon.post('/auth/password-reset/verify', { email, code: wrong })).body.error_code);
  assert.ok(codes.includes('OTP_LOCKED'));
  const after = await anon.post('/auth/password-reset/confirm', { email, code: second, password: 'Dd4$dddd' });
  assert.equal(after.body.error_code, 'OTP_NOT_VERIFIED_RESET');
});
