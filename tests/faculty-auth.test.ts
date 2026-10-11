import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

test('faculty login preserves department passwords, supports private overrides and rejects forged sessions', async () => {
  process.env.FACULTY_JWT_SECRET = randomBytes(32).toString('hex');
  process.env.FACULTY_PASSWORD = randomBytes(24).toString('hex');
  const password = randomBytes(24).toString('hex');
  process.env.FACULTY_DEPARTMENT_PASSWORDS = JSON.stringify({ CSE: password });
  const faculty = await import('../server/faculty.js');
  assert.equal(faculty.verifyFacultyCredentials('CSE', 'cse@avn2026'), false);
  assert.equal(faculty.verifyFacultyCredentials('ALL', 'admin@avn2026'), false);
  assert.equal(faculty.verifyFacultyCredentials('CSE', password), true);
  assert.equal(faculty.verifyFacultyCredentials('ECE', password), false);
  assert.equal(faculty.verifyFacultyCredentials('ECE', faculty.DEPARTMENTS.ECE.defaultPass), true);
  assert.equal(faculty.verifyFacultyCredentials('ECE', process.env.FACULTY_PASSWORD), false);
  assert.equal(faculty.verifyFacultyCredentials('CSE', faculty.DEPARTMENTS.ECE.defaultPass), false);
  assert.equal(faculty.verifyFacultyCredentials('ALL', process.env.FACULTY_PASSWORD), true);
  const token = faculty.createFacultyToken('CSE');
  assert.deepEqual(faculty.verifyFacultyToken(token), { dept: 'CSE' });
  assert.equal(faculty.verifyFacultyToken(`${token}extra`), null);
  assert.equal(faculty.verifyFacultyToken(`${token.split('.')[0]}.${'é'.repeat(43)}`), null);
  assert.equal(faculty.verifyFacultyToken(`${token}.extra`), null);
});
