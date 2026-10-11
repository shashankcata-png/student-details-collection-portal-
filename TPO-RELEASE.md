# TPO release

The original TPO release is live at https://student-details-collection-portal.vercel.app/ as of 11 October 2026.

The initial candidate inherited a stale DATABASE_URL. After comparing the connected database with the live portal (618 students, CGPA average 7.37, 494 without backlogs and 124 with backlogs, plus three visible roll matches), the owner supplied the correct connection securely. Deployment dpl_HRncgW4hVyemEHrwyGsCAE81ngAx was promoted. Public TPO reads return 200 and unauthenticated private application reads return 401. The earlier database-access blocker is resolved.

## Per-opportunity template extension

Normal student exports and existing SE / AE-ABA opportunities keep their formats. New opportunities may instead upload a blank .xls or .xlsx employer template (maximum 1 MB). The TPO chooses one worksheet and a heading row within the first 30 rows, then maps up to 50 columns to saved profile fields, serial numbers, blanks or new questions. New questions support text, numeric, date and choice answers with optional required validation.

The selected worksheet's text above the headings, column headings and order are retained in a fresh .xlsx export. Original styling, merged cells, formulas, macros, sample records and other worksheets are not retained. The UI discloses these limits. The TPO must review the mappings before opening an opportunity. Templates cannot be changed after creation in this release.

Only verified applications in the faculty member's department and selected branch/year are exported. Duplicate headings use distinct internal column IDs. Answers are stored inside application details; they do not overwrite student profile fields. Server validation permits only explicit profile mappings and declared question answers. Workbook values are written as data cells, never formulas.

The only database addition is nullable tpo_opportunities.custom_template. Existing students and applications are untouched. RLS and current grants remain unchanged; server API authentication controls writes.

## Verification

- TypeScript and production build pass.
- Isolated PostgreSQL integration tests cover creation, required-field validation, duplicate/stale submissions, review, scoped exports, custom Excel round-trip, repeated headings, string identifiers, formula-like text and unchanged student rows.
- Existing SE/AE exports and faculty password compatibility tests pass.
- Real email delivery and a complete live student OTP submission remain unverified. No synthetic student or placement opportunity is inserted into production for testing.
