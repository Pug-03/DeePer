import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, cleanupDb, api, registerUser } from '../test-support/helpers.js';
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

test('an email gets at most 6 reset codes a day, even spread over the hours', async () => {
  const { email } = await registerUser(base);
  // Six codes sent earlier today, none in the last hour.
  const insert = db.prepare(
    `INSERT INTO otp_codes (email, code, purpose, expires_at, consumed, created_at)
     VALUES (?, '0000', 'reset', 0, 1, datetime('now', ?))`,
  );
  for (let h = 2; h < 8; h++) insert.run(email, `-${h} hours`);

  const res = await api(base).post('/auth/password-reset/request', { email });
  assert.equal(res.status, 429);
  assert.equal(res.body.error_code, 'OTP_DAILY_LIMIT');
});

test('codes from yesterday no longer count toward the daily cap', async () => {
  const { email } = await registerUser(base);
  const insert = db.prepare(
    `INSERT INTO otp_codes (email, code, purpose, expires_at, consumed, created_at)
     VALUES (?, '0000', 'reset', 0, 1, datetime('now', '-25 hours'))`,
  );
  for (let i = 0; i < 6; i++) insert.run(email);

  const res = await api(base).post('/auth/password-reset/request', { email });
  assert.equal(res.status, 200);
});

test('the health check reads the database and reports disk space', async () => {
  const res = await api(base).get('/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(typeof res.body.disk_low, 'boolean');
});

test('signup and reset answer the same whether or not the email has an account', async () => {
  const { email } = await registerUser(base);
  const anon = api(base);

  const taken = await anon.post('/auth/otp/request', { email });
  assert.equal(taken.status, 200);
  assert.equal(taken.body.dev_code, undefined); // a notice goes out, not a code

  const unknown = await anon.post('/auth/password-reset/request', { email: `nobody_${Date.now()}@example.com` });
  assert.equal(unknown.status, 200);
  assert.equal(unknown.body.dev_code, undefined);
});
