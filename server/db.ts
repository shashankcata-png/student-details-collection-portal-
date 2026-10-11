import pg from 'pg';
import { randomUUID } from 'crypto';
import { getSharedPool } from './db-pool.js';

export interface StudentInsertData {
  firstName: string;
  lastName: string;
  rollNumber: string;
  dateOfBirth: string;
  gender: string;
  email: string;
  emailVerified: boolean;
  mobileNumber: string;
  aadharNumber: string;
  panNumber?: string | null;
  passportNumber?: string | null;
  college: string;
  branch: string;
  otherBranch?: string | null;
  cgpa: number;
  percentage: number;
  activeBacklogs: number;
  intermediateOrDiploma?: string | null;
  intermediateCgpa?: number | null;
  intermediatePercentage?: number | null;
  diplomaCgpa?: number | null;
  diplomaPercentage?: number | null;
  intermediateYearOfPassing?: string | null;
  btechYearOfPassing?: string | null;
  tenthCgpa?: number | null;
  tenthPercentage?: number | null;
  tenthYearOfPassing?: string | null;
  crtRegistration?: string | null;
  
  // Professional Profiles
  linkedinLink?: string | null;
  resumeLink?: string | null;
  githubLink?: string | null;
  hackerrankLink?: string | null;
  leetcodeLink?: string | null;
  codechefLink?: string | null;
  codeforcesLink?: string | null;
}

export interface StudentDbRow {
  id: string;
  first_name: string;
  last_name: string;
  roll_number: string;
  date_of_birth: string;
  gender: string;
  email: string;
  email_verified: boolean;
  mobile_number: string;
  aadhar_number: string;
  pan_number?: string | null;
  passport_number?: string | null;
  college: string;
  branch: string;
  other_branch?: string | null;
  cgpa: number;
  percentage: number;
  active_backlogs: number;
  intermediate_or_diploma?: string | null;
  intermediate_cgpa?: number | null;
  intermediate_percentage?: number | null;
  diploma_cgpa?: number | null;
  diploma_percentage?: number | null;
  intermediate_year_of_passing?: string | null;
  btech_year_of_passing?: string | null;
  tenth_cgpa?: number | null;
  tenth_percentage?: number | null;
  tenth_year_of_passing?: string | null;
  crt_registration?: string | null;
  
  // Professional Profiles
  linkedin_link?: string | null;
  resume_link?: string | null;
  github_link?: string | null;
  hackerrank_link?: string | null;
  leetcode_link?: string | null;
  codechef_link?: string | null;
  codeforces_link?: string | null;

  created_at: string;
  updated_at: string;
}

export interface OtpRecord {
  id: string;
  email: string;
  otpHash: string;
  expiresAt: Date;
  attemptCount: number;
  verifiedAt?: Date | null;
  verificationToken?: string | null;
  tokenExpiresAt?: Date | null;
  createdAt: Date;
}

// Memory fallback store 
class MemoryDatabase {
  private students = new Map<string, StudentDbRow>();
  private otpRecords: OtpRecord[] = [];

  async findStudentByRollNumber(rollNumber: string): Promise<StudentDbRow | null> {
    const normalized = rollNumber.trim().toUpperCase();
    for (const student of this.students.values()) {
      if (student.roll_number.toUpperCase() === normalized) {
        return student;
      }
    }
    return null;
  }

  async insertStudent(data: StudentInsertData): Promise<StudentDbRow> {
    const existing = await this.findStudentByRollNumber(data.rollNumber);
    if (existing) {
      const err = new Error('duplicate key value violates unique constraint "students_roll_number_key"');
      (err as any).code = '23505';
      throw err;
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    const row: StudentDbRow = {
      id,
      first_name: data.firstName.trim(),
      last_name: data.lastName.trim(),
      roll_number: data.rollNumber.trim().toUpperCase(),
      date_of_birth: data.dateOfBirth,
      gender: data.gender,
      email: data.email.trim().toLowerCase(),
      email_verified: data.emailVerified,
      mobile_number: data.mobileNumber.trim(),
      aadhar_number: data.aadharNumber,
      pan_number: data.panNumber || null,
      passport_number: data.passportNumber || null,
      college: data.college.trim(),
      branch: data.branch,
      other_branch: data.otherBranch ? data.otherBranch.trim() : null,
      cgpa: data.cgpa,
      percentage: data.percentage,
      active_backlogs: data.activeBacklogs,
      intermediate_or_diploma: data.intermediateOrDiploma || null,
      intermediate_cgpa: data.intermediateCgpa ?? null,
      intermediate_percentage: data.intermediatePercentage ?? null,
      diploma_cgpa: data.diplomaCgpa ?? null,
      diploma_percentage: data.diplomaPercentage ?? null,
      intermediate_year_of_passing: data.intermediateYearOfPassing || null,
      btech_year_of_passing: data.btechYearOfPassing || null,
      tenth_cgpa: data.tenthCgpa ?? null,
      tenth_percentage: data.tenthPercentage ?? null,
      tenth_year_of_passing: data.tenthYearOfPassing || null,
      crt_registration: data.crtRegistration,
      linkedin_link: data.linkedinLink || null,
      resume_link: data.resumeLink || null,
      github_link: data.githubLink || null,
      hackerrank_link: data.hackerrankLink || null,
      leetcode_link: data.leetcodeLink || null,
      codechef_link: data.codechefLink || null,
      codeforces_link: data.codeforcesLink || null,
      created_at: now,
      updated_at: now,
    };

    this.students.set(id, row);
    return row;
  }

  async listStudents(filter?: { branch?: string | string[]; yop?: string; search?: string }): Promise<StudentDbRow[]> {
    let list = Array.from(this.students.values());
    if (filter?.branch && filter.branch !== 'ALL') {
      if (Array.isArray(filter.branch)) {
        list = list.filter(s => (filter.branch as string[]).includes(s.branch));
      } else {
        list = list.filter(s => s.branch === filter.branch);
      }
    }
    if (filter?.yop && filter.yop !== 'ALL') {
      list = list.filter(s => s.btech_year_of_passing === filter.yop);
    }
    if (filter?.search) {
      const q = filter.search.trim().toLowerCase();
      list = list.filter(s =>
        s.first_name.toLowerCase().includes(q) ||
        s.last_name.toLowerCase().includes(q) ||
        s.roll_number.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.mobile_number.includes(q)
      );
    }
    return list.sort((a, b) => a.roll_number.localeCompare(b.roll_number));
  }

  async deleteStudent(id: string): Promise<boolean> {
    if (this.students.has(id)) {
      this.students.delete(id);
      return true;
    }
    return false;
  }

  async updateStudent(id: string, updates: Record<string, any>): Promise<StudentDbRow | null> {
    // Map frontend specific keys to DB keys
    if (updates.tenth_yop) updates.tenth_year_of_passing = updates.tenth_yop;
    if (updates.inter_yop) updates.intermediate_year_of_passing = updates.inter_yop;

    const student = this.students.get(id);
    if (student) {
      const updated = { ...student, ...updates, updated_at: new Date().toISOString() };
      this.students.set(id, updated as StudentDbRow);
      return updated as StudentDbRow;
    }
    return null;
  }

  async saveOtp(email: string, otpHash: string, expiresAt: Date): Promise<OtpRecord> {
    const normalized = email.trim().toLowerCase();
    this.otpRecords = this.otpRecords.filter(r => !(r.email === normalized && !r.verifiedAt));
    const record: OtpRecord = { id: randomUUID(), email: normalized, otpHash, expiresAt, attemptCount: 0, createdAt: new Date() };
    this.otpRecords.push(record);
    return record;
  }

  async getLatestActiveOtp(email: string): Promise<OtpRecord | null> {
    const normalized = email.trim().toLowerCase();
    const records = this.otpRecords.filter(r => r.email === normalized && !r.verifiedAt).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return records[0] || null;
  }

  async getLastOtpSentTime(email: string): Promise<Date | null> {
    const normalized = email.trim().toLowerCase();
    const records = this.otpRecords.filter(r => r.email === normalized).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return records[0] ? records[0].createdAt : null;
  }

  async updateOtpAttempts(id: string, attemptCount: number): Promise<void> {
    const record = this.otpRecords.find(r => r.id === id);
    if (record) record.attemptCount = attemptCount;
  }

  async markOtpVerified(id: string, token: string, tokenExpiresAt: Date): Promise<void> {
    const record = this.otpRecords.find(r => r.id === id);
    if (record) { record.verifiedAt = new Date(); record.verificationToken = token; record.tokenExpiresAt = tokenExpiresAt; }
  }

  async findValidVerificationToken(email: string, token: string): Promise<OtpRecord | null> {
    const normalized = email.trim().toLowerCase();
    const now = new Date();
    return this.otpRecords.find(r => r.email === normalized && r.verificationToken === token && r.tokenExpiresAt && r.tokenExpiresAt > now) || null;
  }

  async consumeVerificationToken(id: string): Promise<void> {
    const record = this.otpRecords.find(r => r.id === id);
    if (record) { record.verificationToken = null; record.tokenExpiresAt = null; }
  }

  async ping(): Promise<boolean> {
    return true;
  }
}

// PostgreSQL Implementation
export class PostgresDatabase {
  private pool: pg.Pool;
  ready: Promise<void> = Promise.resolve();

  constructor(connectionString: string, pool?: pg.Pool) {
    this.pool = pool || getSharedPool(connectionString);
  }

  async ping(): Promise<boolean> {
    try {
      await this.ready;
      const res = await this.pool.query('SELECT 1');
      return Boolean(res.rows?.length);
    } catch {
      return false;
    }
  }

  async initSchema(): Promise<void> {
    try {
      const client = await this.pool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS students (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            first_name VARCHAR(100) NOT NULL,
            last_name VARCHAR(100) NOT NULL,
            roll_number VARCHAR(30) UNIQUE NOT NULL,
            date_of_birth DATE NOT NULL,
            gender VARCHAR(20) NOT NULL,
            email VARCHAR(255) NOT NULL,
            email_verified BOOLEAN DEFAULT TRUE NOT NULL,
            mobile_number VARCHAR(20) NOT NULL,
            aadhar_number VARCHAR(12) NOT NULL,
            pan_number VARCHAR(10),
            passport_number VARCHAR(9),
            college VARCHAR(255) NOT NULL,
            branch VARCHAR(50) NOT NULL,
            other_branch VARCHAR(100),
            year_of_study VARCHAR(30),
            cgpa NUMERIC(4, 2) NOT NULL,
            percentage NUMERIC(5, 2) NOT NULL,
            active_backlogs INTEGER NOT NULL DEFAULT 0,
            intermediate_or_diploma VARCHAR(30),
            intermediate_cgpa NUMERIC(4, 2),
            diploma_cgpa NUMERIC(4, 2),
            btech_year_of_passing VARCHAR(10),
            tenth_cgpa NUMERIC(4, 2),
            intermediate_percentage NUMERIC(5, 2),
            diploma_percentage NUMERIC(5, 2),
            intermediate_year_of_passing VARCHAR(10),
            tenth_percentage NUMERIC(5, 2),
            tenth_year_of_passing VARCHAR(10),
            crt_registration VARCHAR(20),
            linkedin_link VARCHAR(255),
            resume_link VARCHAR(255),
            github_link VARCHAR(255),
            hackerrank_link VARCHAR(255),
            leetcode_link VARCHAR(255),
            codechef_link VARCHAR(255),
            codeforces_link VARCHAR(255),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_students_roll_number ON students(roll_number);
          CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
          CREATE TABLE IF NOT EXISTS email_otp_verifications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) NOT NULL,
            otp_hash VARCHAR(255) NOT NULL,
            verification_token VARCHAR(255),
            token_expires_at TIMESTAMPTZ,
            expires_at TIMESTAMPTZ NOT NULL,
            attempt_count INTEGER DEFAULT 0 NOT NULL,
            verified_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );
        `);
        
        // Attempt to alter table if columns don't exist yet (for existing DBs)
        try {
          await client.query(`
            ALTER TABLE students 
            ADD COLUMN IF NOT EXISTS linkedin_link VARCHAR(255),
            ADD COLUMN IF NOT EXISTS resume_link VARCHAR(255),
            ADD COLUMN IF NOT EXISTS github_link VARCHAR(255),
            ADD COLUMN IF NOT EXISTS hackerrank_link VARCHAR(255),
            ADD COLUMN IF NOT EXISTS leetcode_link VARCHAR(255),
            ADD COLUMN IF NOT EXISTS codechef_link VARCHAR(255),
            ADD COLUMN IF NOT EXISTS codeforces_link VARCHAR(255);
          `);
        } catch {
          // Ignore column exists errors
        }
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.warn('PostgresDatabase initSchema notice (tables likely already exist):', err?.message || err);
    }
  }

  async findStudentByRollNumber(rollNumber: string): Promise<StudentDbRow | null> {
    await this.ready;
    const res = await this.pool.query('SELECT * FROM students WHERE UPPER(roll_number) = UPPER($1) LIMIT 1', [rollNumber.trim()]);
    return res.rows[0] || null;
  }

  async insertStudent(data: StudentInsertData): Promise<StudentDbRow> {
    await this.ready;
    const res = await this.pool.query(
      `INSERT INTO students (
        first_name, last_name, roll_number, date_of_birth, gender, email, email_verified,
        mobile_number, aadhar_number, pan_number, passport_number, college, branch, other_branch,
        cgpa, percentage, active_backlogs,
        intermediate_or_diploma, intermediate_cgpa, intermediate_percentage, diploma_cgpa, diploma_percentage, intermediate_year_of_passing, btech_year_of_passing, tenth_cgpa, tenth_percentage, tenth_year_of_passing, crt_registration,
        linkedin_link, resume_link, github_link, hackerrank_link, leetcode_link, codechef_link, codeforces_link
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35) RETURNING *`,
      [
        data.firstName.trim(), data.lastName.trim(), data.rollNumber.trim().toUpperCase(), data.dateOfBirth, data.gender, data.email.trim().toLowerCase(), data.emailVerified,
        data.mobileNumber.trim(), data.aadharNumber, data.panNumber || null, data.passportNumber || null, data.college.trim(), data.branch, data.otherBranch ? data.otherBranch.trim() : null,
        data.cgpa, data.percentage, data.activeBacklogs, data.intermediateOrDiploma || null, data.intermediateCgpa ?? null, data.intermediatePercentage ?? null, data.diplomaCgpa ?? null, data.diplomaPercentage ?? null, data.intermediateYearOfPassing || null, data.btechYearOfPassing || null, data.tenthCgpa ?? null, data.tenthPercentage ?? null, data.tenthYearOfPassing || null, data.crtRegistration || null,
        data.linkedinLink || null, data.resumeLink || null, data.githubLink || null, data.hackerrankLink || null, data.leetcodeLink || null, data.codechefLink || null, data.codeforcesLink || null
      ]
    );
    return res.rows[0];
  }

  async listStudents(filter?: { branch?: string | string[]; yop?: string; search?: string }): Promise<StudentDbRow[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    if (filter?.branch && filter.branch !== 'ALL') {
      params.push(filter.branch);
      conditions.push(Array.isArray(filter.branch) ? `branch = ANY($${params.length})` : `branch = $${params.length}`);
    }
    if (filter?.yop && filter.yop !== 'ALL') {
      params.push(filter.yop);
      conditions.push(`btech_year_of_passing = $${params.length}`);
    }
    if (filter?.search) {
      params.push(`%${filter.search.trim()}%`);
      conditions.push(`(first_name ILIKE $${params.length} OR last_name ILIKE $${params.length} OR roll_number ILIKE $${params.length} OR email ILIKE $${params.length} OR mobile_number ILIKE $${params.length})`);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `SELECT * FROM students ${whereClause} ORDER BY roll_number ASC, created_at DESC`;
    await this.ready;
    const res = await this.pool.query(query, params);
    return res.rows;
  }

  async deleteStudent(id: string): Promise<boolean> {
    await this.ready;
    const res = await this.pool.query('DELETE FROM students WHERE id = $1 RETURNING id', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  async updateStudent(id: string, updates: Record<string, any>): Promise<StudentDbRow | null> {
    await this.ready;
    
    // Map frontend specific keys to DB keys
    if (updates.tenth_yop) updates.tenth_year_of_passing = updates.tenth_yop;
    if (updates.inter_yop) updates.intermediate_year_of_passing = updates.inter_yop;

    const allowedKeys = [
      'first_name', 'last_name', 'roll_number', 'date_of_birth', 'gender', 'email', 
      'mobile_number', 'aadhar_number', 'pan_number', 'passport_number', 
      'college', 'branch', 'other_branch', 'cgpa', 'percentage', 'active_backlogs', 
      'intermediate_or_diploma', 'intermediate_cgpa', 'intermediate_percentage',
      'diploma_cgpa', 'diploma_percentage', 
      'intermediate_year_of_passing', 'btech_year_of_passing', 
      'tenth_cgpa', 'tenth_percentage', 'tenth_year_of_passing', 'crt_registration',
      'linkedin_link', 'resume_link', 'github_link', 'hackerrank_link',
      'leetcode_link', 'codechef_link', 'codeforces_link'
    ];
    
    const setClauses: string[] = [];
    const values: any[] = [];
    let i = 1;

    for (const key of allowedKeys) {
      if (updates[key] !== undefined) {
        setClauses.push(`${key} = $${i}`);
        values.push(updates[key]);
        i++;
      }
    }

    if (setClauses.length === 0) return null;
    values.push(id);
    const query = `UPDATE students SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`;
    const res = await this.pool.query(query, values);
    return res.rows[0] || null;
  }

  async saveOtp(email: string, otpHash: string, expiresAt: Date): Promise<OtpRecord> {
    const normalized = email.trim().toLowerCase();
    await this.ready;
    await this.pool.query('UPDATE email_otp_verifications SET expires_at = NOW() WHERE email = $1 AND verified_at IS NULL', [normalized]);
    const res = await this.pool.query(
      `INSERT INTO email_otp_verifications (email, otp_hash, expires_at) VALUES ($1, $2, $3) RETURNING id, email, otp_hash AS "otpHash", expires_at AS "expiresAt", attempt_count AS "attemptCount", created_at AS "createdAt"`,
      [normalized, otpHash, expiresAt]
    );
    return res.rows[0];
  }

  async getLatestActiveOtp(email: string): Promise<OtpRecord | null> {
    await this.ready;
    const res = await this.pool.query(`SELECT id, email, otp_hash AS "otpHash", expires_at AS "expiresAt", attempt_count AS "attemptCount", created_at AS "createdAt", verified_at AS "verifiedAt" FROM email_otp_verifications WHERE email = $1 AND verified_at IS NULL ORDER BY created_at DESC LIMIT 1`, [email.trim().toLowerCase()]);
    return res.rows[0] || null;
  }

  async getLastOtpSentTime(email: string): Promise<Date | null> {
    await this.ready;
    const res = await this.pool.query(`SELECT created_at AS "createdAt" FROM email_otp_verifications WHERE email = $1 ORDER BY created_at DESC LIMIT 1`, [email.trim().toLowerCase()]);
    return res.rows[0] ? new Date(res.rows[0].createdAt) : null;
  }

  async updateOtpAttempts(id: string, attemptCount: number): Promise<void> {
    await this.ready;
    await this.pool.query('UPDATE email_otp_verifications SET attempt_count = $1 WHERE id = $2', [attemptCount, id]);
  }

  async markOtpVerified(id: string, token: string, tokenExpiresAt: Date): Promise<void> {
    await this.ready;
    await this.pool.query(`UPDATE email_otp_verifications SET verified_at = NOW(), verification_token = $1, token_expires_at = $2 WHERE id = $3`, [token, tokenExpiresAt, id]);
  }

  async findValidVerificationToken(email: string, token: string): Promise<OtpRecord | null> {
    await this.ready;
    const res = await this.pool.query(`SELECT id, email, otp_hash AS "otpHash", verification_token AS "verificationToken", token_expires_at AS "tokenExpiresAt", verified_at AS "verifiedAt" FROM email_otp_verifications WHERE email = $1 AND verification_token = $2 AND token_expires_at > NOW() LIMIT 1`, [email.trim().toLowerCase(), token]);
    return res.rows[0] || null;
  }

  async consumeVerificationToken(id: string): Promise<void> {
    await this.ready;
    await this.pool.query('UPDATE email_otp_verifications SET verification_token = NULL, token_expires_at = NULL WHERE id = $1', [id]);
  }
}

const databaseUrl = process.env.DATABASE_URL?.trim();
let dbInstance: PostgresDatabase | MemoryDatabase;
let isUsingPostgres = false;

if (databaseUrl && (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'))) {
  try {
    const pgDb = new PostgresDatabase(databaseUrl);
    pgDb.ready = pgDb.initSchema();
    dbInstance = pgDb;
    isUsingPostgres = true;
  } catch (err: any) {
    dbInstance = new MemoryDatabase();
  }
} else {
  dbInstance = new MemoryDatabase();
}

export const db = dbInstance;
export const isPostgresConfigured = () => isUsingPostgres;
