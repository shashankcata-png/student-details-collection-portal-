# TPO release handoff

Status: PR #2 merged; production promotion is BLOCKED. The owner requested existing department passwords and database setup remain unchanged. The main public portal still serves commit `876ced4`. Automatic custom-domain assignment is paused so new builds do not replace it.

## Production database mismatch discovered 2026-10-11

- Vercel's production DATABASE_URL connects to Supabase project `eyquqztzjutbdlfssbkm` (Sydney pooler, postgres database).
- The connected Supabase tool only has access to project `yoiyukkymaspmskigrck`. Access to the actual production project was explicitly denied.
- The additive migration and private safety snapshot described below were applied to `yoiyukkymaspmskigrck`, NOT the live portal database. The 618 unchanged rows are in that connected project; this does not verify production data preservation. No existing rows were modified there.
- Do not change production DATABASE_URL to the connected project: that could switch the portal away from its live student records.
- The latest production candidate builds successfully and validates Supabase TLS using the official public CA. Runtime SQL reports missing `public.tpo_opportunities` (42P01) in the actual production database, so it must not be promoted yet.
- Obtain authorized access to `eyquqztzjutbdlfssbkm`; take and validate a safety snapshot there, apply only the additive TPO schema, compare existing student rows, and rerun runtime checks before promoting. Do not remove the other project's snapshot or tables without review.
- After successful promotion, restore automatic custom-domain assignment. Real student email/OTP end-to-end verification remains outstanding.

## Implemented

- Separate TPO opportunities and applications. No new fields or updates on `students`.
- Existing students verify their registered email with the existing OTP service, load their profile, then submit missing TPO details.
- Faculty create opportunities with employer-defined gap labels and explicit Diploma acceptance. No assumptions about the two ambiguous gap columns.
- One application per student/opportunity. Submitted and verified versions are locked. Corrections use optimistic version checks and resubmit for review.
- Department-scoped faculty review, correction notes, branch/year/status filters, and verified-only exports.
- SE and AE/ABA `.xls` exports match the supplied column order, 19/20 columns, college/date row and row-4 headings. Both files use a `TPO` worksheet. Column widths are set for readability rather than copying original formatting.
- TPO snapshots exclude Aadhaar, PAN and passport. Existing general student exports still include their original identity fields.
- Local server routes now reuse the deployed handlers. Type checking targets actual application files; stale duplicate source copies are retained but excluded.
- Fixed faculty YOP field bindings and the general export authentication mismatch.
- Preserved existing department passwords at the owner's explicit request. Private per-department overrides remain supported; the newly configured admin password is admin-only. Department edits/deletes are checked against the student's current department. Legacy passwords remain in public repository history and are an existing security risk.

## Local verification

Run `npm ci`, `npm run lint`, `npm test`, and `npm run build`.

The integration test runs isolated PostgreSQL through PGlite using synthetic students. It checks repeatable schema application, unchanged student records, atomic duplicate rejection, stale revision rejection, correction/resubmission, verified locking, department restrictions, expired opportunities, RLS, denial of anonymous access, restricted deletion, and round-trip reading of both `.xls` outputs. Phone numbers and roll numbers retain leading zeroes; formula-like certification text remains text.

Faculty authentication tests cover legacy department compatibility, private overrides, wrong departments and malformed/forged session tokens.

Build, type checks and tests passed locally. Production TLS connectivity is verified after adding the official Supabase CA. Runtime SQL is blocked by the missing schema in the actual production project. Live email delivery and complete browser end-to-end interaction remain unverified.

## Release checks

- GitHub PR: https://github.com/shashankcata-png/student-details-collection-portal-/pull/2 . The uploaded tree was fetched and compared with the locally tested files.
- `FACULTY_PASSWORD` is configured as a Production Secret. It was not read. Existing department passwords are retained unless a private `FACULTY_DEPARTMENT_PASSWORDS` override is configured. Existing `FACULTY_JWT_SECRET` is retained.
- No paid staging resource was created, per the owner's request to keep the database setup unchanged. Integration tests run with synthetic data in isolated local PostgreSQL.
- In connected project `yoiyukkymaspmskigrck` (not the live database), migration `add_tpo_with_private_student_safety_snapshot` added only TPO tables and a private safety snapshot. Existing student rows were locked briefly, copied into `portal_release_backup.students_before_tpo_20261011`, restored into a temporary table, then compared in both directions. Student values were compared again after schema creation in the same transaction; a mismatch would roll everything back.
- The private snapshot has RLS and no public, anonymous, authenticated or service-role grants. It is in the same database, not an off-site disaster-recovery backup.
- Live checks must confirm TPO database connectivity, faculty authentication and scope, and production-domain routing. Actual email delivery and a complete real-student OTP workflow require a controlled email account; do not claim those are verified by synthetic integration tests.
- Vercel project: `prj_8g5LRyNjG8h6GYaXz72ygpaWIccR`, team: `team_pUv6ZCRwXcFY8jK58UuKHLGP`, Supabase project: `yoiyukkymaspmskigrck`.

## Rollback

Roll back the application deployment if needed; keep the additive TPO tables and their data. Do not drop tables or overwrite the database from an old backup as a routine rollback. Foreign keys intentionally prevent deletion of students referenced by applications.

## Later scope

Configurable percentage/backlog eligibility, email reminders, multi-entry certification records, opportunity editing/closing controls and long-term review audit history are not part of this first release. Faculty currently controls the deadline at creation, and applications close automatically at that deadline.
