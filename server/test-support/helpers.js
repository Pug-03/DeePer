import { randomUUID } from 'node:crypto';
import fs from 'node:fs';

// node:test runs each *.test.js file in its own process by default, and
// db.js reads DB_PATH once at import time — so every test file needs its
// own database file, or two files' migrations race on the same file and
// SQLite throws "database is locked". Generated here (not passed in via
// the npm script) so it's unique per process without any coordination.
const DB_PATH = `./.tmp-test-${process.pid}-${randomUUID()}.db`;
process.env.DB_PATH = DB_PATH;

// Dynamic import: app.js -> db.js reads process.env.DB_PATH at the top of
// its module body, so DB_PATH must already be set (above) before this
// module is first evaluated. A static `import` would be hoisted ahead of
// that assignment.
const { app } = await import('../src/app.js');

// One real HTTP server per test file, on an OS-assigned free port — tests
// hit it with plain fetch instead of express's app.address() tricks, so
// the requests exercise the exact same stack (middleware, rate limiter,
// JSON parsing) a real client would.
export function startServer() {
  const server = app.listen(0);
  const base = `http://localhost:${server.address().port}/api`;
  return { server, base };
}

// Removes this process's throwaway SQLite file (plus its WAL/SHM
// sidecars — the schema turns on WAL mode) once a test file is done.
export function cleanupDb() {
  for (const suffix of ['', '-wal', '-shm']) {
    fs.rm(DB_PATH + suffix, { force: true }, () => {});
  }
}

export const PASSWORD = 'Aa1!aaaa';

export const uniqueEmail = (tag) =>
  `test_${tag}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;

async function json(res) {
  return res.status === 204 ? null : res.json();
}

export function api(base, token) {
  const headers = (extra) => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  });
  return {
    get: async (path) => {
      const res = await fetch(`${base}${path}`, { headers: headers() });
      return { status: res.status, body: await json(res) };
    },
    post: async (path, body, extraHeaders) => {
      const res = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: headers(extraHeaders),
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      return { status: res.status, body: await json(res) };
    },
    patch: async (path, body) => {
      const res = await fetch(`${base}${path}`, { method: 'PATCH', headers: headers(), body: JSON.stringify(body) });
      return { status: res.status, body: await json(res) };
    },
    del: async (path) => {
      const res = await fetch(`${base}${path}`, { method: 'DELETE', headers: headers() });
      return { status: res.status, body: await json(res) };
    },
  };
}

// Registers a fresh user (own email + OTP flow) and returns their token —
// the OTP's dev_code is only present because there's no SMTP configured in
// the test environment, same as local dev without one.
export async function registerUser(
  base,
  { email = uniqueEmail('u'), nickname = 'เทสเตอร์', nickname_en = 'Tester', userAgent } = {},
) {
  const anon = api(base);
  const otpRes = await anon.post('/auth/otp/request', { email });
  const code = otpRes.body.dev_code;
  const res = await anon.post(
    '/auth/register',
    { email, code, nickname, nickname_en, age: 25, gender: 'other', password: PASSWORD },
    userAgent ? { 'User-Agent': userAgent } : undefined,
  );
  return { email, token: res.body.token, user: res.body.user };
}
