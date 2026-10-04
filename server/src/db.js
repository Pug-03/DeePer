import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { bankRows, CATEGORIES } from './questions-bank.js';

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

  CREATE TABLE IF NOT EXISTS support_proofs (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
    display_name   TEXT NOT NULL,
    transfer_date  TEXT NOT NULL,
    transfer_time  TEXT NOT NULL,
    amount         REAL NOT NULL,
    slip_path      TEXT NOT NULL,
    notified       INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bug_reports (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER REFERENCES users(id) ON DELETE SET NULL,
    category         TEXT NOT NULL,
    message          TEXT NOT NULL,
    contact          TEXT,
    page             TEXT,
    user_agent       TEXT,
    screenshot_path  TEXT,
    resolved_at      TEXT,
    replied_at       TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Organizations asking to become a sponsor, from the /sponsor form.
  CREATE TABLE IF NOT EXISTS sponsor_inquiries (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    org_name      TEXT NOT NULL,
    contact_name  TEXT NOT NULL,
    contact       TEXT NOT NULL,
    message       TEXT NOT NULL,
    handled_at    TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Sponsor logos added from the admin dashboard, shown on the Welcome page
  -- after the ones hard-coded in client/src/sponsors-info.js.
  CREATE TABLE IF NOT EXISTS sponsors (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    tier        TEXT NOT NULL,
    logo_path   TEXT NOT NULL,
    link        TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- One row per signed-in user per Bangkok calendar day they used the app,
  -- for the admin dashboard's daily-active count.
  CREATE TABLE IF NOT EXISTS user_activity (
    day      TEXT NOT NULL,
    user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (day, user_id)
  );

  -- One row per browser per Bangkok day it opened the site, signed in or
  -- not. visitor_id is a random id the browser keeps in localStorage — no
  -- IP or account is stored. source is where the visit came from (?ref=,
  -- else the referrer's host, else 'direct').
  CREATE TABLE IF NOT EXISTS site_visits (
    day         TEXT NOT NULL,
    visitor_id  TEXT NOT NULL,
    source      TEXT NOT NULL DEFAULT 'direct',
    path        TEXT,
    signed_in   INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (day, visitor_id)
  );

  CREATE TABLE IF NOT EXISTS app_meta (
    key    TEXT PRIMARY KEY,
    value  TEXT
  );

  CREATE TABLE IF NOT EXISTS login_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    method      TEXT NOT NULL,
    ip          TEXT,
    user_agent  TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category);
  CREATE INDEX IF NOT EXISTS idx_saved_user ON saved_questions(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_history_user ON history(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_support_notified ON support_proofs(notified, created_at);
  CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS partners (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category    TEXT NOT NULL,
    name        TEXT NOT NULL DEFAULT 'อีกฝ่าย',
    color       TEXT NOT NULL DEFAULT '#f43f5e',
    icon        TEXT,
    avatar_url  TEXT,
    UNIQUE(user_id, category)
  );
  CREATE INDEX IF NOT EXISTS idx_partners_user ON partners(user_id);
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

// Migration: partner_avatar_url (an uploaded photo) and partner_icon (a
// picked stock icon id) — added for letting the partner be represented by
// something other than just a flat color. Mutually exclusive in practice
// (the route layer clears one whenever the other is set) but both columns
// stay nullable so "neither chosen yet" is representable too.
if (!userCols.some((c) => c.name === 'partner_avatar_url')) {
  db.exec(`ALTER TABLE users ADD COLUMN partner_avatar_url TEXT`);
}
if (!userCols.some((c) => c.name === 'partner_icon')) {
  db.exec(`ALTER TABLE users ADD COLUMN partner_icon TEXT`);
}

// Migration: users.nickname_en — signup now asks for the nickname in both
// Thai (kept in the existing `nickname` column) and English. Nullable:
// accounts made before this have no English name until they add one.
if (!userCols.some((c) => c.name === 'nickname_en')) {
  db.exec(`ALTER TABLE users ADD COLUMN nickname_en TEXT`);
}

// Migration: users.token_version — an earlier, coarser take on session
// revocation (one shared counter, bumping it invalidated every token at
// once). Superseded by login_history.revoked_at below, which revokes one
// session at a time — drop it rather than keep two mechanisms around.
if (userCols.some((c) => c.name === 'token_version')) {
  db.exec(`ALTER TABLE users DROP COLUMN token_version`);
}

// Migration: login_history.revoked_at — each row is a session (its id is
// embedded in that session's JWT as `sid`, see signToken); setting this
// marks that one session logged out without touching any other session,
// for "log out this device" / "log out other devices".
const loginHistoryCols = db.prepare(`PRAGMA table_info(login_history)`).all();
if (!loginHistoryCols.some((c) => c.name === 'revoked_at')) {
  db.exec(`ALTER TABLE login_history ADD COLUMN revoked_at TEXT`);
}

// Housekeeping: prune login_history rows older than 90 days — well past
// the 30-day token TTL (see TOKEN_TTL in auth.js), so a row this old can
// no longer represent a live, revocable session; it's pure audit history
// at that point, and keeping it forever would grow the table with no
// remaining benefit. Runs on every boot rather than as a one-time
// migration — it's ongoing data hygiene, not a schema change.
db.exec(`DELETE FROM login_history WHERE created_at < datetime('now', '-90 days')`);

// Migration: seed one `partners` row per category per existing user from
// the old single, global partner_* columns above — so every user's
// family/friends categories start out showing what "the other person"
// used to show everywhere, instead of resetting to the default name. Runs
// once (guarded on the table being empty), same pattern as the bank-
// question seed below.
const { c: partnerRowCount } = db.prepare(`SELECT COUNT(*) AS c FROM partners`).get();
if (partnerRowCount === 0) {
  const existingUsers = db
    .prepare(`SELECT id, partner_name, partner_color, partner_icon, partner_avatar_url FROM users`)
    .all();
  const insertPartner = db.prepare(
    `INSERT INTO partners (user_id, category, name, color, icon, avatar_url) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  for (const u of existingUsers) {
    for (const category of CATEGORIES) {
      insertPartner.run(
        u.id,
        category,
        u.partner_name || 'อีกฝ่าย',
        u.partner_color || '#f43f5e',
        u.partner_icon,
        u.partner_avatar_url,
      );
    }
  }
}

// Migration: older databases stored a single transfer_at column — split it
// into transfer_date + transfer_time, backfill existing rows from it, add
// the new amount column, then drop transfer_at entirely. Dropping it (rather
// than just leaving it) matters: its NOT NULL constraint can't be lifted by
// ALTER ... ADD COLUMN, and new inserts stop supplying it, so it would start
// rejecting every submission if left in place.
// The two steps are guarded independently (not one combined check) so this
// stays correct however far a given database already got through this
// migration — including this project's own dev DB, which had already picked
// up the new columns via --watch auto-restart before the drop step existed.
const proofCols = db.prepare(`PRAGMA table_info(support_proofs)`).all();
if (proofCols.length) {
  if (!proofCols.some((c) => c.name === 'transfer_date')) {
    db.exec(`ALTER TABLE support_proofs ADD COLUMN transfer_date TEXT`);
    db.exec(`ALTER TABLE support_proofs ADD COLUMN transfer_time TEXT`);
    db.exec(`ALTER TABLE support_proofs ADD COLUMN amount REAL`);
  }
  if (proofCols.some((c) => c.name === 'transfer_at')) {
    db.exec(`
      UPDATE support_proofs
      SET transfer_date = substr(transfer_at, 1, 10),
          transfer_time = substr(transfer_at, 12, 5)
      WHERE transfer_date IS NULL
    `);
    db.exec(`ALTER TABLE support_proofs DROP COLUMN transfer_at`);
  }
  // support_proofs.approved_at — set once the maintainer has checked the
  // slip (npm run approve); only approved donors' names are shown publicly.
  if (!proofCols.some((c) => c.name === 'approved_at')) {
    db.exec(`ALTER TABLE support_proofs ADD COLUMN approved_at TEXT`);
  }
  // support_proofs.rejected_at — set when the admin declines to show the
  // name (e.g. it's inappropriate) and emails the donor a thank-you instead.
  if (!proofCols.some((c) => c.name === 'rejected_at')) {
    db.exec(`ALTER TABLE support_proofs ADD COLUMN rejected_at TEXT`);
  }
  // support_proofs.review_token — secret in the maintainer's email link to
  // the review page (approve / hide without a shell). Backfilled so proofs
  // sent before this column existed can be reviewed the same way.
  if (!proofCols.some((c) => c.name === 'review_token')) {
    db.exec(`ALTER TABLE support_proofs ADD COLUMN review_token TEXT`);
  }
  const fill = db.prepare('UPDATE support_proofs SET review_token = ? WHERE id = ?');
  for (const { id } of db.prepare('SELECT id FROM support_proofs WHERE review_token IS NULL').all()) {
    fill.run(randomBytes(24).toString('hex'), id);
  }
}

// Migration: bug_reports.replied_at — set when the admin emails the
// reporter a thank-you from the dashboard.
const reportCols = db.prepare(`PRAGMA table_info(bug_reports)`).all();
if (!reportCols.some((c) => c.name === 'replied_at')) {
  db.exec(`ALTER TABLE bug_reports ADD COLUMN replied_at TEXT`);
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
