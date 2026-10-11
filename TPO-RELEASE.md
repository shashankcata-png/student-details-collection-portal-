# TPO release handoff

Status: release in progress from `codex/tpo-applications`, PR #2. The owner requested existing department passwords and the current database setup remain unchanged. The additive TPO schema was applied on 2026-10-11. Existing student values were compared exactly inside the migration transaction. Production application promotion is pending.

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

Build, type checks and tests passed locally. Live email delivery, browser end-to-end interaction, Vercel runtime and production PostgreSQL TLS connectivity remain unverified. The remote browser cannot connect to the local development server.

## Release checks

- GitHub PR: https://github.com/shashankcata-png/student-details-collection-portal-/pull/2 . The uploaded tree was fetched and compared with the locally tested files.
- `FACULTY_PASSWORD` is configured as a Production Secret. It was not read. Existing department passwords are retained unless a private `FACULTY_DEPARTMENT_PASSWORDS` override is configured. Existing `FACULTY_JWT_SECRET` is retained.
- No paid staging resource was created, per the owner's request to keep the database setup unchanged. Integration tests run with synthetic data in isolated local PostgreSQL.
- Migration `add_tpo_with_private_student_safety_snapshot` added only TPO tables and a private safety snapshot. Existing student rows were locked briefly, copied into `portal_release_backup.students_before_tpo_20261011`, restored into a temporary table, then compared in both directions. Student values were compared again after schema creation in the same transaction; a mismatch would roll everything back.
- The private snapshot has RLS and no public, anonymous, authenticated or service-role grants. It is in the same database, not an off-site disaster-recovery backup.
- Live checks must confirm TPO database connectivity, faculty authentication and scope, and production-domain routing. Actual email delivery and a complete real-student OTP workflow require a controlled email account; do not claim those are verified by synthetic integration tests.
- Vercel project: `prj_8g5LRyNjG8h6GYaXz72ygpaWIccR`, team: `team_pUv6ZCRwXcFY8jK58UuKHLGP`, Supabase project: `yoiyukkymaspmskigrck`.

## Rollback

Roll back the application deployment if needed; keep the additive TPO tables and their data. Do not drop tables or overwrite the database from an old backup as a routine rollback. Foreign keys intentionally prevent deletion of students referenced by applications.

## Later scope

Configurable percentage/backlog eligibility, email reminders, multi-entry certification records, opportunity editing/closing controls and long-term review audit history are not part of this first release. Faculty currently controls the deadline at creation, and applications close automatically at that deadline.
