// Approval gate between a submitted transfer proof (support_proofs) and the
// donor's name showing up on the landing page ("ผู้สนับสนุนรายบุคคล" tier).
// Nothing is public until the maintainer has checked the slip and approved
// it — a submitted proof alone never puts a name on the site. Approval
// happens from the review link emailed per proof, or `npm run approve`.
import { db } from './db.js';

// The proof a review link points at, or undefined for an unknown token.
export function proofByToken(token) {
  if (!token) return undefined;
  return db.prepare('SELECT * FROM support_proofs WHERE review_token = ?').get(String(token));
}

// Marks proofs approved (their names go public). Returns the ids that
// exist; already-approved ones keep their original approval time.
export function approveProofs(ids) {
  const stmt = db.prepare(
    `UPDATE support_proofs SET approved_at = COALESCE(approved_at, datetime('now')), rejected_at = NULL WHERE id = ?`,
  );
  return ids.filter((id) => stmt.run(id).changes > 0);
}

// Takes proofs back off the public list.
export function revokeProofs(ids) {
  const stmt = db.prepare(`UPDATE support_proofs SET approved_at = NULL WHERE id = ?`);
  return ids.filter((id) => stmt.run(id).changes > 0);
}

// Public list: display names only (never amounts, slips or accounts), one
// entry per name even if that person donated more than once, newest first.
export function approvedSupporterNames() {
  return db
    .prepare(
      `SELECT display_name AS name, MIN(approved_at) AS since, MIN(id) AS first_id
       FROM support_proofs
       WHERE approved_at IS NOT NULL
       GROUP BY display_name
       ORDER BY since DESC, first_id DESC`,
    )
    .all()
    .map((r) => r.name);
}
