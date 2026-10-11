import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import * as XLSX from 'xlsx';
import pg from 'pg';
import { TpoStore, tpoPoolConfig } from '../server/tpo-store.js';
import { createTpoHandler } from '../api/tpo.js';
import { tpoWorkbook } from '../server/tpo-export.js';
import { EMPTY_TPO_DETAILS, type TpoDetails } from '../src/types/tpo.js';
import { tpoErrors } from '../src/lib/tpo.js';

test('TPO application lifecycle, authorization, exports and preservation on isolated PostgreSQL', async () => {
  const sql = new PGlite();
  try {
    // Match the live student schema used by this module, using synthetic data only.
    await sql.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE TABLE public.students (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), college text,
      first_name text, last_name text, roll_number text UNIQUE, gender text, date_of_birth date,
      mobile_number text, email text, tenth_percentage numeric, intermediate_percentage numeric,
      diploma_percentage numeric, intermediate_or_diploma text, percentage numeric, branch text,
      other_branch text, btech_year_of_passing text, active_backlogs integer, aadhar_number text);
      INSERT INTO students (college,first_name,last_name,roll_number,gender,date_of_birth,mobile_number,
      email,tenth_percentage,intermediate_percentage,intermediate_or_diploma,percentage,branch,btech_year_of_passing,active_backlogs,aadhar_number)
      VALUES ('TEST COLLEGE','TEST','STUDENT','001TEST','Other','2005-04-03','0123456789','test@example.invalid',90,88,'Intermediate',75,'CSE','2027',0,'000000000000'),
      ('TEST COLLEGE','OTHER','STUDENT','002TEST','Other','2005-04-03','0123456788','other@example.invalid',80,78,'Intermediate',70,'ECE','2027',0,'000000000001');`);
    const before = (await sql.query('SELECT * FROM students ORDER BY id')).rows;
    const ddl = await readFile(new URL('../database/tpo-schema.sql', import.meta.url), 'utf8');
    await sql.exec(ddl);
    await sql.exec(ddl); // Re-applying additive schema must preserve existing data.
    const store = new TpoStore(sql);
    const se = await store.createOpportunity({ title: 'TEST SE', template: 'SE', deadline: '2099-01-01T00:00:00Z', gap_before_label: 'Gap before degree', gap_during_label: 'Gap during degree', diploma_allowed: false });
    const ae = await store.createOpportunity({ ...se, title: 'TEST AE', template: 'AE_ABA' });
    const student = (await store.student('001test', 'TEST@EXAMPLE.INVALID'))!;
    assert.ok(student);
    assert.equal('aadhar_number' in student.snapshot, false);
    assert.equal(student.snapshot.phone, '0123456789');
    assert.equal(await store.student('001TEST', 'other@example.invalid'), undefined);
    const details: TpoDetails = { ...EMPTY_TPO_DETAILS, tenthBoard: 'State Board', intermediateBoard: 'State Board', gapBefore: '0', gapDuring: '0', certifications: 'None', hasOffer: 'No' };
    assert.deepEqual(tpoErrors(details, student.snapshot, se), []);
    assert.ok(tpoErrors({ ...details, gapBefore: '' }, student.snapshot, se).length);
    assert.ok(tpoErrors({ ...details, gapBefore: '-1' }, student.snapshot, se).length);
    assert.ok(tpoErrors(details, { ...student.snapshot, tenthPercentage: null }, se).length);
    assert.ok(tpoErrors(details, { ...student.snapshot, educationRoute: 'Diploma' }, se).length);
    assert.ok(tpoErrors(details, student.snapshot, ae).length);
    const results = await Promise.all([store.submit(se.id, student.id, student.snapshot, details, 0), store.submit(se.id, student.id, student.snapshot, details, 0)]);
    assert.equal(results.filter(Boolean).length, 1, 'double-click creates one application');
    const submitted = results.find(Boolean)!;
    assert.equal((await store.applications(se.id, ['ECE'])).length, 0);
    assert.equal(await store.review(submitted.id, 1, 'Verified', '', 'ECE', ['ECE']), undefined);
    const corrections = (await store.review(submitted.id, 1, 'Needs Correction', 'Update board', 'CSE', ['CSE']))!;
    assert.equal(corrections.version, 2);
    assert.equal(await store.submit(se.id, student.id, student.snapshot, details, 1), undefined, 'stale revision rejected');
    const revised = (await store.submit(se.id, student.id, student.snapshot, { ...details, tenthBoard: 'CBSE' }, 2))!;
    assert.equal(revised.status, 'Submitted');
    assert.equal(revised.correction_note, '');
    const verified = (await store.review(revised.id, 3, 'Verified', '', 'CSE', ['CSE']))!;
    assert.equal(await store.submit(se.id, student.id, student.snapshot, details, 4), undefined, 'verified application is locked');
    const aeApplication = (await store.submit(ae.id, student.id, student.snapshot, { ...details, role: 'Both', certifications: '=HYPERLINK("https://example.invalid")' }, 0))!;
    for (const [opportunity, application, columns] of [[se, verified, 19], [ae, aeApplication, 20]] as const) {
      const bytes = XLSX.write(tpoWorkbook([application], opportunity), { type: 'buffer', bookType: 'biff8' });
      const wb = XLSX.read(bytes, { type: 'buffer' }), sheet = wb.Sheets.TPO;
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
      assert.equal(rows[3].length, columns); assert.equal(rows[4].length, columns);
      assert.equal(rows[4][3], '001TEST'); assert.equal(rows[4][6], '0123456789');
      assert.equal(rows[4][8], 90); assert.equal(rows[4][13], 75);
      assert.ok(!JSON.stringify(rows).includes('000000000000'));
      if (columns === 20) { assert.equal(rows[4][17], 'Both'); assert.equal(sheet.S5.t, 's'); assert.equal(sheet.S5.f, undefined); }
    }
    const handler = createTpoHandler({ store: () => store, verifyEmail: async (email, token) => email === 'test@example.invalid' && token === 'test-email-token',
      verifyFaculty: token => token === 'cse-test' ? { dept: 'CSE' } : token === 'ece-test' ? { dept: 'ECE' } : token === 'admin-test' ? { dept: 'ALL' } : null });
    async function request(method: string, action: string, token = '', body: any = {}, query: any = {}) {
      let code = 200, data: any;
      const response = { setHeader() {}, status(value: number) { code = value; return this; }, json(value: any) { data = value; return this; }, send(value: any) { data = value; return this; } };
      await handler({ method, headers: { authorization: `Bearer ${token}` }, body: { ...body, action }, query: { ...query, action } }, response);
      return { code, data };
    }
    assert.equal((await request('GET', 'applications', '', {}, { opportunityId: se.id })).code, 401);
    assert.equal((await request('POST', 'lookup', '', { email: 'test@example.invalid', rollNumber: '001TEST', opportunityId: se.id })).code, 401);
    assert.equal((await request('POST', 'lookup', 'test-email-token', { email: 'test@example.invalid', rollNumber: '002TEST', opportunityId: se.id })).code, 404);
    assert.equal((await request('POST', 'lookup', 'test-email-token', { email: 'test@example.invalid', rollNumber: '001TEST', opportunityId: se.id })).code, 200);
    assert.equal((await request('POST', 'create', 'cse-test', {})).code, 403);
    assert.equal((await request('GET', 'export', 'ece-test', {}, { opportunityId: se.id })).code, 400);
    const exported = await request('GET', 'export', 'cse-test', {}, { opportunityId: se.id });
    assert.equal(exported.code, 200); assert.ok(Buffer.isBuffer(exported.data));
    assert.equal((await request('PATCH', 'review', 'ece-test', { id: verified.id, version: 4, status: 'Needs Correction', note: 'test' })).code, 409);
    await sql.query('UPDATE tpo_opportunities SET deadline=$1 WHERE id=$2', ['2000-01-01', ae.id]);
    const other = (await store.student('002TEST', 'other@example.invalid'))!;
    assert.equal(await store.submit(ae.id, other.id, other.snapshot, details, 0), undefined, 'closed opportunity rejects submission');
    await assert.rejects(sql.query('DELETE FROM students WHERE id=$1', [student.id]), 'applications must protect referenced students');
    assert.deepEqual((await sql.query('SELECT * FROM students ORDER BY id')).rows, before, 'student rows remain byte-for-byte equivalent');
    const rls = await sql.query<{ relrowsecurity: boolean }>("SELECT relrowsecurity FROM pg_class WHERE relname IN ('tpo_opportunities','tpo_applications')");
    assert.ok(rls.rows.every(r => r.relrowsecurity));
    await sql.exec('SET ROLE anon');
    await assert.rejects(sql.query('SELECT * FROM tpo_applications'));
    await sql.exec('RESET ROLE');
  } finally { await sql.close(); }
});

test('Supabase pool retains CA and hostname verification with SSL URL parameters', () => {
  for (const host of ['db.example.supabase.co', 'aws-0-ap-southeast-2.pooler.supabase.com']) {
    const config = tpoPoolConfig(`postgresql://test:test@${host}:5432/postgres?sslmode=require&sslrootcert=ignored`);
    const client = new pg.Client(config);
    const ssl = client.ssl as unknown as { rejectUnauthorized: boolean; ca: string[] };
    assert.equal(ssl.rejectUnauthorized, true);
    assert.ok(ssl.ca.some(cert => cert.includes('BEGIN CERTIFICATE')));
    assert.equal(new URL(config.connectionString!).searchParams.has('sslmode'), false);
    assert.equal(client.host, host);
  }
  assert.equal(tpoPoolConfig('postgresql://test:test@localhost/test').ssl, undefined);
});
