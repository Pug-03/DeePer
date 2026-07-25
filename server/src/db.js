import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { bankRows } from './questions-bank.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(__dirname, '..', 'deeptalk.db');

export const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    email          TEXT UNIQUE,
    google_sub     TEXT UNIQUE,
    nickname       TEXT NOT NULL,
    age            INTEGER,
    gender         TEXT,
    password_hash  TEXT,
    partner_name   TEXT DEFAULT 'อีกฝ่าย',
    partner_color  TEXT DEFAULT '#f43f5e',
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS otp_codes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    email       TEXT NOT NULL,
    code        TEXT NOT NULL,
    purpose     TEXT NOT NULL DEFAULT 'register',
    expires_at  INTEGER NOT NULL,
    consumed    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS questions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    category    TEXT NOT NULL,
    text        TEXT NOT NULL,
    source      TEXT NOT NULL DEFAULT 'bank',
    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS saved_questions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_text  TEXT NOT NULL,
    category       TEXT NOT NULL,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS history (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_text   TEXT NOT NULL,
    category        TEXT NOT NULL,
    my_answer       TEXT,
    partner_answer  TEXT,
    partner_name    TEXT,
    partner_color   TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category);
  CREATE INDEX IF NOT EXISTS idx_saved_user ON saved_questions(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_history_user ON history(user_id, created_at DESC);
`);

// Migration: older databases don't have otp_codes.purpose yet (added for
// the password-reset feature) — add it so existing installs keep working.
const otpCols = db.prepare(`PRAGMA table_info(otp_codes)`).all();
if (!otpCols.some((c) => c.name === 'purpose')) {
  db.exec(`ALTER TABLE otp_codes ADD COLUMN purpose TEXT NOT NULL DEFAULT 'register'`);
}

// Migration: older databases don't have users.avatar_url yet (added for
// the profile picture feature) — add it so existing installs keep working.
const userCols = db.prepare(`PRAGMA table_info(users)`).all();
if (!userCols.some((c) => c.name === 'avatar_url')) {
  db.exec(`ALTER TABLE users ADD COLUMN avatar_url TEXT`);
}

// Seed the curated question bank once.
const count = db.prepare(`SELECT COUNT(*) AS c FROM questions WHERE source = 'bank'`).get();
if (count.c === 0) {
  const insert = db.prepare(`INSERT INTO questions (category, text, source) VALUES (?, ?, 'bank')`);
  const rows = bankRows();
  const tx = db.prepare('BEGIN');
  tx.run();
  try {
    for (const r of rows) insert.run(r.category, r.text);
    db.prepare('COMMIT').run();
    console.log(`[db] seeded ${rows.length} bank questions`);
  } catch (e) {
    db.prepare('ROLLBACK').run();
    throw e;
  }
}
