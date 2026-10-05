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

const stats = async () => (await api(base).get('/stats')).body;

test('public stats count swipes, shares, answers and saves, and never go down', async () => {
  const { token } = await registerUser(base);
  const user = api(base, token);
  const start = await stats();

  assert.equal((await api(base).post('/swipes')).status, 401);
  await user.post('/swipes');
  await user.post('/swipes');
  assert.equal((await api(base).post('/shares')).status, 401);
  await user.post('/shares');

  const saved = await user.post('/saved', { question_text: 'คำถามทดสอบ', category: 'friends' });
  // A duplicate save of the same question isn't counted twice.
  await user.post('/saved', { question_text: 'คำถามทดสอบ', category: 'friends' });
  await user.post('/history', {
    question_text: 'คำถามทดสอบ',
    category: 'friends',
    my_answer: 'a',
    partner_answer: 'b',
    saved_id: saved.body.saved.id,
  });

  const mid = await stats();
  assert.equal(mid.swipe_count, start.swipe_count + 2);
  assert.equal(mid.share_count, start.share_count + 1);
  assert.equal(mid.save_count, start.save_count + 1);
  assert.equal(mid.answer_count, start.answer_count + 1);

  // Deleting a history entry leaves the public total where it was.
  const { history } = (await user.get('/history')).body;
  await user.del(`/history/${history[0].id}`);
  assert.equal((await stats()).answer_count, mid.answer_count);
});
