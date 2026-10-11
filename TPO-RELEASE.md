# TPO release handoff

Status: implementation published on `codex/tpo-applications` in draft PR #2. Local tests, type checks and production build passed; Vercel preview verification is pending. Not released to production. Production student data has not been modified.

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
- Removed acceptance of hard-coded faculty defaults; department edits/deletes are checked against the student's current department.

## Local verification

Run `npm ci`, `npm run lint`, `npm test`, and `npm run build`.

The integration test runs isolated PostgreSQL through PGlite using synthetic students. It checks repeatable schema application, unchanged student records, atomic duplicate rejection, stale revision rejection, correction/resubmission, verified locking, department restrictions, expired opportunities, RLS, denial of anonymous access, restricted deletion, and round-trip reading of both `.xls` outputs. Phone numbers and roll numbers retain leading zeroes; formula-like certification text remains text.

Faculty authentication tests cover configured credentials, rejection of public defaults, wrong departments and malformed/forged session tokens.

Build, type checks and tests passed locally. Live email delivery, browser end-to-end interaction, Vercel runtime and production PostgreSQL TLS connectivity remain unverified. The remote browser cannot connect to the local development server.

## Required before release

1. GitHub publication completed through the owner-authorized shared browser. Draft PR: https://github.com/shashankcata-png/student-details-collection-portal-/pull/2 . All 23 implementation files were fetched and compared byte-for-byte with the locally tested tree. Keep the PR in draft until the following release checks are complete.
2. In Vercel, configure private faculty credentials directly as Secrets. Never commit or paste credentials in chat. `FACULTY_PASSWORD` is an admin-only password of at least 12 characters. `FACULTY_DEPARTMENT_PASSWORDS` is a JSON object mapping department codes to different passwords of at least 12 characters. Configure only departments that should have access. Existing department codes are in `server/faculty.ts`. An existing `FACULTY_JWT_SECRET` is present in production, but its value/length was not read. Use a random secret of at least 32 characters and rotate it for this release to invalidate old sessions. **Deploying without these values prevents faculty sign-in.**
3. Verify a database backup can restore into an isolated environment. A count of 618 students was observed; this is not a backup. No backup restoration has been performed. Keep backup files private and outside this public repository.
4. Configure a separate staging database, OTP settings and faculty secrets for the feature branch's Preview environment. Production `DATABASE_URL` must not be used for tests. No Supabase development branch currently exists; paid provisioning has not been authorized.
5. Apply `database/tpo-schema.sql` to staging, using a migration recorded through the team's migration workflow. The file is an additive schema script; the old `database/schema.sql` is stale and must not be used to reconstruct production. Test with synthetic data only.
6. Verify in the preview: real OTP sign-in, registered-profile lookup, submit, department review, corrections, resubmit, export download and reopening in Excel. Test wrong email/roll pairings, wrong department, expired sessions and deadlines. Confirm original registration/general export still work.
7. Capture a fresh production baseline of stable record IDs and row checksums at migration time, accounting separately for concurrent legitimate submissions/edits. Apply only the new schema and compare all existing student values. RLS is enabled and direct `anon`/`authenticated` grants are revoked for the new tables; server APIs use the application's existing database connection and explicit checks.
8. Stage a production deployment, verify it, then assign the production domain. The target is Vercel project `prj_8g5LRyNjG8h6GYaXz72ygpaWIccR`, team `team_pUv6ZCRwXcFY8jK58UuKHLGP`, Supabase project `yoiyukkymaspmskigrck`.

## Rollback

Roll back the application deployment if needed; keep the additive TPO tables and their data. Do not drop tables or overwrite the database from an old backup as a routine rollback. Foreign keys intentionally prevent deletion of students referenced by applications.

## Later scope

Configurable percentage/backlog eligibility, email reminders, multi-entry certification records, opportunity editing/closing controls and long-term review audit history are not part of this first release. Faculty currently controls the deadline at creation, and applications close automatically at that deadline.
