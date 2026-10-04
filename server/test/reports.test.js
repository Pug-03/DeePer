import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { join } from 'node:path';
import { startServer, cleanupDb, registerUser } from '../test-support/helpers.js';

const { REPORT_DIR } = await import('../src/routes/reports.js');

let server, base;

before(() => {
  ({ server, base } = startServer());
});

after(async () => {
  // Screenshots land in the real private-uploads/reports folder — delete the
  // ones this file created before its database (which lists them) goes away.
  const { db } = await import('../src/db.js');
  for (const { screenshot_path: p } of db.prepare('SELECT screenshot_path FROM bug_reports').all()) {
    if (p) fs.rmSync(join(REPORT_DIR, p), { force: true });
  }
  server.close();
  cleanupDb();
});

// 1x1 transparent PNG — just enough for the screenshot upload filter.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

async function sendReport(fields, { token, screenshot = false } = {}) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (screenshot) form.append('screenshot', new Blob([PNG], { type: 'image/png' }), 'shot.png');
  const res = await fetch(`${base}/reports`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  return { status: res.status, body: await res.json() };
}

const latest = async () => {
  const { db } = await import('../src/db.js');
  return db.prepare('SELECT * FROM bug_reports ORDER BY id DESC LIMIT 1').get();
};

test('a guest can report a bug, with contact and screenshot', async () => {
  const res = await sendReport(
    { category: 'bug', message: 'ปุ่มบันทึกกดไม่ได้', contact: 'me@example.com', page: '/' },
    { screenshot: true },
  );
  assert.equal(res.status, 200);
  const row = await latest();
  assert.equal(row.user_id, null);
  assert.equal(row.category, 'bug');
  assert.equal(row.contact, 'me@example.com');
  assert.ok(fs.existsSync(join(REPORT_DIR, row.screenshot_path)));
});

test('a signed-in report is tied to the user', async () => {
  const { token, user } = await registerUser(base);
  const res = await sendReport({ category: 'idea', message: 'อยากให้มีโหมดสว่าง' }, { token });
  assert.equal(res.status, 200);
  const row = await latest();
  assert.equal(row.user_id, user.id);
  assert.equal(row.screenshot_path, null);
});

test('a stale token still goes through as a guest', async () => {
  const res = await sendReport({ category: 'problem', message: 'โหลดคำถามไม่ขึ้น' }, { token: 'not-a-token' });
  assert.equal(res.status, 200);
  assert.equal((await latest()).user_id, null);
});

test('rejects a missing category or a too-short message', async () => {
  const badCat = await sendReport({ category: 'other', message: 'ข้อความยาวพอแล้ว' });
  assert.equal(badCat.status, 400);
  assert.equal(badCat.body.error_code, 'REPORT_CATEGORY_INVALID');

  const short = await sendReport({ category: 'bug', message: ' ab ' }, { screenshot: true });
  assert.equal(short.status, 400);
  assert.equal(short.body.error_code, 'REPORT_MESSAGE_REQUIRED');
});
