import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, cleanupDb, api, registerUser } from '../test-support/helpers.js';

let server, base;

before(() => {
  ({ server, base } = startServer());
});

after(() => {
  server.close();
  cleanupDb();
});

test('a fresh account has default partners for all three categories', async () => {
  const { token } = await registerUser(base);
  const me = await api(base, token).get('/auth/me');
  const { partners } = me.body.user;
  assert.deepEqual(Object.keys(partners).sort(), ['couple', 'family', 'friends']);
  for (const category of Object.keys(partners)) {
    assert.equal(partners[category].name, 'อีกฝ่าย');
    assert.equal(partners[category].icon, null);
  }
});

test('editing one category only changes that category', async () => {
  const { token } = await registerUser(base);
  const client = api(base, token);

  const patch = await client.patch('/auth/me/partner/couple', { name: 'แฟน', color: '#38bdf8', icon: 'heart' });
  assert.equal(patch.status, 200);
  assert.deepEqual(patch.body.user.partners.couple, {
    name: 'แฟน',
    color: '#38bdf8',
    icon: 'heart',
    avatar_url: null,
  });
  // Untouched categories keep the default.
  assert.equal(patch.body.user.partners.family.name, 'อีกฝ่าย');
  assert.equal(patch.body.user.partners.friends.name, 'อีกฝ่าย');

  await client.patch('/auth/me/partner/family', { name: 'แม่' });
  const me = await client.get('/auth/me');
  assert.equal(me.body.user.partners.couple.name, 'แฟน', 'couple edit must survive an unrelated family edit');
  assert.equal(me.body.user.partners.family.name, 'แม่');
});

test('an invalid category is rejected on every partner route', async () => {
  const { token } = await registerUser(base);
  const client = api(base, token);

  const patch = await client.patch('/auth/me/partner/bogus', { name: 'x' });
  assert.equal(patch.status, 400);
  assert.equal(patch.body.error_code, 'INVALID_CATEGORY');
});

test('an invalid partner icon id is rejected', async () => {
  const { token } = await registerUser(base);
  const res = await api(base, token).patch('/auth/me/partner/couple', { icon: 'not-a-real-icon' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error_code, 'PARTNER_ICON_INVALID');
});

test("answer history stores the category's own partner name/color at save time", async () => {
  const { token } = await registerUser(base);
  const client = api(base, token);
  await client.patch('/auth/me/partner/family', { name: 'พ่อ', color: '#34d399' });

  const saved = await client.post('/history', {
    question_text: 'ทดสอบ',
    category: 'family',
    my_answer: 'a',
    partner_answer: 'b',
  });
  assert.equal(saved.status, 200);

  const history = await client.get('/history');
  const entry = history.body.history.find((h) => h.id === saved.body.history.id);
  assert.equal(entry.partner_name, 'พ่อ');
  assert.equal(entry.partner_color, '#34d399');
});
