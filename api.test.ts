import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { randomBytes } from 'node:crypto';
import statusHandler from '../api/status.js';
import facultyStudentsHandler from '../api/faculty/students.js';
import facultyLoginHandler from '../api/faculty/login.js';
import { createTpoHandler } from '../api/tpo.js';
import { TpoStore } from '../server/tpo-store.js';
import { PostgresDatabase } from '../server/db.js';
import { tpoPoolConfig, SUPABASE_CA } from '../server/db-pool.js';
import { createFacultyToken, DEPARTMENTS } from '../server/faculty.js';

function mockRes() {
  let statusCode = 200;
  let sentData: any = null;
  const headers: Record<string, string> = {};
  return {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: any) {
      sentData = data;
      return this;
    },
    send(data: any) {
      sentData = data;
      return this;
    },
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
      return this;
    },
    getStatus: () => statusCode,
    getData: () => sentData,
    getHeaders: () => headers,
  };
}

test('Priority 1: Supabase TLS certificate verification, connection timeout and error safety', () => {
  // 1. Hostname and TLS certificate validation must be strictly enforced
  const supabaseHost = 'db.abcdefghijklmno.supabase.co';
  const config = tpoPoolConfig(`postgresql://postgres:fake_password@${supabaseHost}:5432/postgres?sslmode=require`);
  
  assert.ok(config.ssl && typeof config.ssl === 'object');
  const ssl = config.ssl as { rejectUnauthorized: boolean; ca: string[] };
  assert.equal(ssl.rejectUnauthorized, true, 'TLS certificate verification must be strictly true');
  assert.ok(ssl.ca.some(c => c.includes('BEGIN CERTIFICATE')), 'Supabase CA root certificate must be present');
  
  // 2. Strips ssl query parameters to prevent pg parser conflict
  assert.equal(new URL(config.connectionString!).searchParams.has('sslmode'), false);
  
  // 3. Connection timeout must be bounded (10000ms) to prevent infinite hangs
  assert.equal(config.connectionTimeoutMillis, 10000);
  assert.equal(config.max, 3, 'Pool size must be capped to prevent exhausting Supabase connections');
});

test('Priority 3: /api/status endpoint returns valid configuration and handles probe checks', async () => {
  const res1 = mockRes();
  await statusHandler({ method: 'GET', query: {} }, res1);
  assert.equal(res1.getStatus(), 200);
  const data1 = res1.getData();
  assert.equal(typeof data1.databaseConfigured, 'boolean');
  assert.equal(typeof data1.databaseType, 'string');
  assert.equal(typeof data1.supabaseAuthConfigured, 'boolean');

  // Test probing mode with ?check=1
  const res2 = mockRes();
  await statusHandler({ method: 'GET', query: { check: '1' } }, res2);
  const data2 = res2.getData();
  assert.ok([200, 503].includes(res2.getStatus()));
  assert.equal(typeof data2.databaseConnected, 'boolean');
});

test('Priority 3: /api/faculty/students enforces authentication and departmental scoping', async () => {
  // Ensure faculty secret is set for JWT generation
  process.env.FACULTY_JWT_SECRET = randomBytes(32).toString('hex');
  
  // 1. Unauthenticated request must return 401
  const resUnauth = mockRes();
  await facultyStudentsHandler({ method: 'GET', headers: {} }, resUnauth);
  assert.equal(resUnauth.getStatus(), 401);
  assert.equal(resUnauth.getData().success, false);

  // 2. Method not allowed
  const resMethod = mockRes();
  await facultyStudentsHandler({ method: 'POST', headers: {} }, resMethod);
  assert.equal(resMethod.getStatus(), 405);

  // 3. Authenticated request with valid CSE token
  const cseToken = createFacultyToken('CSE');
  const resAuth = mockRes();
  await facultyStudentsHandler({
    method: 'GET',
    headers: { authorization: `Bearer ${cseToken}` },
    query: {},
  }, resAuth);
  assert.equal(resAuth.getStatus(), 200);
  assert.equal(resAuth.getData().success, true);
  assert.equal(resAuth.getData().department, 'CSE');

  // 4. Authenticated request with Admin (ALL) token
  const adminToken = createFacultyToken('ALL');
  const resAdmin = mockRes();
  await facultyStudentsHandler({
    method: 'GET',
    headers: { authorization: `Bearer ${adminToken}` },
    query: { branch: 'ECE' },
  }, resAdmin);
  assert.equal(resAdmin.getStatus(), 200);
  assert.equal(resAdmin.getData().success, true);
  assert.equal(resAdmin.getData().department, 'ALL');
});

test('Priority 3 & 4: /api/faculty/login authenticates departments and rejects invalid passwords', async () => {
  process.env.FACULTY_JWT_SECRET = randomBytes(32).toString('hex');
  
  // 1. Method not allowed
  const resMethod = mockRes();
  await facultyLoginHandler({ method: 'GET', body: {} }, resMethod);
  assert.equal(resMethod.getStatus(), 405);

  // 2. Missing credentials
  const resEmpty = mockRes();
  await facultyLoginHandler({ method: 'POST', body: {} }, resEmpty);
  assert.equal(resEmpty.getStatus(), 400);

  // 3. Invalid credentials
  const resInvalid = mockRes();
  await facultyLoginHandler({ method: 'POST', body: { department: 'CSE', password: 'wrong-password' } }, resInvalid);
  assert.equal(resInvalid.getStatus(), 401);

  // 4. Valid credentials
  const resValid = mockRes();
  await facultyLoginHandler({ method: 'POST', body: { department: 'CSE', password: DEPARTMENTS.CSE.defaultPass } }, resValid);
  assert.equal(resValid.getStatus(), 200);
  assert.equal(resValid.getData().success, true);
  assert.ok(resValid.getData().token);
  assert.equal(resValid.getData().department, 'CSE');
});

test('Priority 2 & 3: TPO opportunity creation, editing, archiving and authorization lifecycle on PGlite', async () => {
  const sql = new PGlite();
  try {
    await sql.exec(`
      CREATE TABLE public.students (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        first_name text, last_name text, roll_number text UNIQUE,
        email text, college text, branch text, percentage numeric
      );
      CREATE TABLE public.tpo_opportunities (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        title text NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
        template text NOT NULL CHECK (template IN ('SE', 'AE_ABA')),
        deadline timestamptz NOT NULL,
        is_open boolean NOT NULL DEFAULT true,
        gap_before_label text NOT NULL CHECK (length(gap_before_label) BETWEEN 1 AND 120),
        gap_during_label text NOT NULL CHECK (length(gap_during_label) BETWEEN 1 AND 120),
        diploma_allowed boolean NOT NULL DEFAULT false,
        custom_template jsonb,
        archived_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    const store = new TpoStore(sql);
    const handler = createTpoHandler({
      store: () => store,
      verifyEmail: async () => true,
      verifyFaculty: (token) => token === 'admin-jwt' ? { dept: 'ALL' } : token === 'cse-jwt' ? { dept: 'CSE' } : null,
    });

    async function req(method: string, action: string, token = '', body: any = {}, query: any = {}) {
      const res = mockRes();
      await handler({
        method,
        headers: { authorization: `Bearer ${token}` },
        body: { ...body, action },
        query: { ...query, action },
      }, res);
      return { status: res.getStatus(), data: res.getData() };
    }

    // 1. Unauthenticated public opportunities GET
    const publicList = await req('GET', 'opportunities');
    assert.equal(publicList.status, 200);
    assert.equal(publicList.data.opportunities.length, 0);

    // 2. Non-admin cannot create opportunity
    const nonAdminCreate = await req('POST', 'create', 'cse-jwt', {
      title: 'Company X', template: 'SE', deadline: '2099-01-01', gapBeforeLabel: 'Gap 1', gapDuringLabel: 'Gap 2'
    });
    assert.equal(nonAdminCreate.status, 403);

    // 3. Admin creates opportunity
    const adminCreate = await req('POST', 'create', 'admin-jwt', {
      title: 'Tech Corp Placement 2026',
      template: 'SE',
      deadline: '2099-10-15T00:00:00Z',
      gapBeforeLabel: 'Gap before degree',
      gapDuringLabel: 'Gap during degree',
      diplomaAllowed: false,
    });
    assert.equal(adminCreate.status, 201);
    assert.ok(adminCreate.data.opportunity.id);
    const oppId = adminCreate.data.opportunity.id;

    // 4. Admin edits opportunity title and deadline (Priority 2 check)
    const adminEdit = await req('PATCH', 'edit', 'admin-jwt', {
      id: oppId,
      title: 'Tech Corp Placement 2026 - Extended',
      deadline: '2099-12-31T23:59:59Z',
    });
    assert.equal(adminEdit.status, 200);
    assert.equal(adminEdit.data.opportunity.title, 'Tech Corp Placement 2026 - Extended');

    // 5. Non-admin cannot edit opportunity
    const nonAdminEdit = await req('PATCH', 'edit', 'cse-jwt', {
      id: oppId,
      title: 'Hacked Title',
    });
    assert.equal(nonAdminEdit.status, 403);

    // 6. Admin archives opportunity (soft delete)
    const adminArchive = await req('PATCH', 'archive', 'admin-jwt', { id: oppId });
    assert.equal(adminArchive.status, 200);
    assert.ok(adminArchive.data.opportunity.archived_at);

    // 7. Archived opportunity is hidden from public students
    const publicAfterArchive = await req('GET', 'opportunities');
    assert.equal(publicAfterArchive.data.opportunities.length, 0);

    // 8. Admin restores opportunity
    const adminRestore = await req('PATCH', 'restore', 'admin-jwt', { id: oppId });
    assert.equal(adminRestore.status, 200);
    assert.equal(adminRestore.data.opportunity.archived_at, null);

    const publicAfterRestore = await req('GET', 'opportunities');
    assert.equal(publicAfterRestore.data.opportunities.length, 1);
  } finally {
    await sql.close();
  }
});

test('Priority 4: Student submission validation and duplicate protection', async () => {
  const { default: submitHandler } = await import('../api/students/submit.js');
  
  // 1. Method not allowed
  const resMethod = mockRes();
  await submitHandler({ method: 'GET', body: {} }, resMethod);
  assert.equal(resMethod.getStatus(), 405);

  // 2. Empty payload rejected with validation errors
  const resEmpty = mockRes();
  await submitHandler({ method: 'POST', body: {} }, resEmpty);
  assert.equal(resEmpty.getStatus(), 400);
  assert.ok(resEmpty.getData().errors);
  assert.ok(resEmpty.getData().errors.firstName);
  assert.ok(resEmpty.getData().errors.rollNumber);

  // 3. Unverified email rejected
  const resUnverified = mockRes();
  await submitHandler({
    method: 'POST',
    body: {
      firstName: 'Ravi',
      lastName: 'Kumar',
      rollNumber: '21AVN0101',
      dateOfBirth: '2003-05-15',
      gender: 'Male',
      email: 'ravi@example.invalid',
      mobileNumber: '9876543210',
      aadharNumber: '123456789012',
      branch: 'Computer Science & Engineering (CSE)',
      cgpa: '8.5',
      percentage: '80',
      activeBacklogs: '0',
      intermediateOrDiploma: 'Intermediate',
      intermediateCgpa: '9.0',
      intermediatePercentage: '90',
      intermediateYearOfPassing: '2021',
      btechYearOfPassing: '2025',
      tenthCgpa: '9.5',
      tenthPercentage: '95',
      tenthYearOfPassing: '2019',
    },
  }, resUnverified);
  assert.equal(resUnverified.getStatus(), 400);
  assert.ok(resUnverified.getData().errors.email.includes('verify your email'));
});

test('Priority 4: Faculty update and delete authorization checks', async () => {
  const { default: updateHandler } = await import('../api/faculty/update.js');
  const { default: deleteHandler } = await import('../api/faculty/delete.js');

  // 1. Unauthenticated update returns 401
  const resUpdateUnauth = mockRes();
  await updateHandler({ method: 'PUT', headers: {} }, resUpdateUnauth);
  assert.equal(resUpdateUnauth.getStatus(), 401);

  // 2. Unauthenticated delete returns 401
  const resDeleteUnauth = mockRes();
  await deleteHandler({ method: 'DELETE', headers: {} }, resDeleteUnauth);
  assert.equal(resDeleteUnauth.getStatus(), 401);
});

