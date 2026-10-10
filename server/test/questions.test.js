import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, cleanupDb, api, registerUser } from '../test-support/helpers.js';
import { bankRows, CATEGORIES, LEVELS } from '../src/questions-bank.js';

let server, base;

before(() => {
  ({ server, base } = startServer());
});

after(() => {
  server.close();
  cleanupDb();
});

test('each category has 50 open, 100 mid and 200 deep questions, all in Thai and English', () => {
  const rows = bankRows();
  const want = { open: 50, mid: 100, deep: 200 };
  for (const category of CATEGORIES) {
    for (const level of LEVELS) {
      const n = rows.filter((r) => r.category === category && r.level === level).length;
      assert.equal(n, want[level], `${category}/${level}`);
    }
    const texts = rows.filter((r) => r.category === category).map((r) => r.text);
    assert.equal(new Set(texts).size, texts.length, `${category} has a repeated question`);
  }
  for (const r of rows) {
    assert.ok(r.text.trim() && r.text_en.trim(), r.text);
    assert.ok(!/[฀-๿]/.test(r.text_en), `Thai left in the English of: ${r.text}`);
  }
});

test('a level filter returns only that level, with English', async () => {
  const { token } = await registerUser(base);
  const me = api(base, token);
  for (const level of LEVELS) {
    const res = await me.get(`/questions?category=friends&level=${level}&limit=50`);
    assert.equal(res.status, 200);
    assert.equal(res.body.questions.length, 50);
    assert.ok(res.body.questions.every((q) => q.level === level && q.text_en));
  }
  assert.equal((await me.get('/questions?category=friends&level=nope')).status, 400);
});

test('without a level, the deck runs from light to deep', async () => {
  const { token } = await registerUser(base);
  const me = api(base, token);
  const seen = [];
  for (let i = 0; i < 8; i++) {
    const res = await me.get(`/questions?category=family&limit=50&exclude=${seen.map((q) => q.id).join(',')}`);
    seen.push(...res.body.questions);
  }
  const order = { open: 0, mid: 1, deep: 2 };
  for (let i = 1; i < seen.length; i++) {
    assert.ok(order[seen[i].level] >= order[seen[i - 1].level], `out of order at ${i}`);
  }
  assert.equal(seen.length, 350);
});

test('saved questions and history come back with their English', async () => {
  const { token } = await registerUser(base);
  const me = api(base, token);
  const [q] = (await me.get('/questions?category=couple&level=deep&limit=1')).body.questions;
  await me.post('/saved', { question_text: q.text, category: 'couple' });
  await me.post('/history', { question_text: q.text, category: 'couple', my_answer: 'x' });
  await me.post('/saved', { question_text: 'คำถามที่เขียนเอง?', category: 'couple' });
  const saved = (await me.get('/saved')).body.saved;
  assert.equal(saved.find((s) => s.question_text === q.text).question_text_en, q.text_en);
  assert.equal(saved.find((s) => s.question_text === 'คำถามที่เขียนเอง?').question_text_en, null);
  const history = (await me.get('/history')).body.history;
  assert.equal(history[0].question_text_en, q.text_en);
});
