import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { startServer, cleanupDb, api, registerUser } from '../test-support/helpers.js';

let server, base;

before(() => {
  process.env.ADMIN_EMAIL = 'admin@example.com';
  process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync('test-admin-pass', 4);
  ({ server, base } = startServer());
});

after(() => {
  server.close();
  cleanupDb();
});

const adminToken = async () =>
  (await api(base).post('/auth/login', { email: 'admin@example.com', password: 'test-admin-pass' })).body.admin_token;

test('a review only shows publicly once the admin approves it', async () => {
  const { token } = await registerUser(base, { nickname: 'พลอย', nickname_en: 'Ploy' });
  const me = api(base, token);

  assert.equal((await me.post('/reviews/mine', { text: 'สั้น', relation: 'couple' })).status, 400);
  assert.equal((await me.post('/reviews/mine', { text: 'ได้คุยกับแฟนลึกขึ้นจริง ๆ ชอบมาก', relation: 'other' })).status, 400);
  const saved = await me.post('/reviews/mine', { text: 'ได้คุยกับแฟนลึกขึ้นจริง ๆ ชอบมาก', relation: 'couple' });
  assert.equal(saved.status, 200);
  assert.equal((await me.get('/reviews/mine')).body.review.status, 'pending');
  assert.equal((await api(base).get('/reviews')).body.reviews.length, 0);

  const admin = api(base, await adminToken());
  const [row] = (await admin.get('/admin/reviews')).body.reviews;
  assert.equal((await admin.get('/admin/stats')).body.reviews_pending, 1);
  assert.equal((await admin.post(`/admin/reviews/${row.id}/approve`)).status, 200);

  const pub = (await api(base).get('/reviews')).body.reviews;
  assert.equal(pub.length, 1);
  assert.equal(pub[0].nickname, 'พลอย');
  assert.equal(pub[0].email, undefined);

  // Editing sends it back to review and off the page.
  await me.post('/reviews/mine', { text: 'แก้รีวิวใหม่ ยังชอบเหมือนเดิมนะ', relation: 'friends' });
  assert.equal((await api(base).get('/reviews')).body.reviews.length, 0);
  assert.equal((await me.get('/reviews/mine')).body.review.status, 'pending');
});

test('review routes need a signed-in user, admin routes need the admin', async () => {
  assert.equal((await api(base).post('/reviews/mine', { text: 'ข้อความทดสอบยาวพอ', relation: 'family' })).status, 401);
  const { token } = await registerUser(base);
  assert.equal((await api(base, token).get('/admin/reviews')).status, 401);
});
