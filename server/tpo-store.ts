import pg from 'pg';
import { rootCertificates } from 'node:tls';
import type { TpoApplication, TpoDetails, TpoOpportunity, TpoSnapshot, ApplicationStatus } from '../src/types/tpo.js';

export interface Queryable { query(sql: string, values?: any[]): Promise<{ rows: any[] }> }
export class TpoStore {
  constructor(private sql: Queryable) {}
  async opportunities(): Promise<TpoOpportunity[]> {
    try {
      return (await this.sql.query('SELECT * FROM public.tpo_opportunities ORDER BY created_at DESC')).rows;
    } catch (error: any) {
      if (error?.code === '42P01') {
        const target = new URL(process.env.DATABASE_URL!);
        console.error('TPO schema missing', {
          host: target.hostname, database: target.pathname,
          project: target.username.startsWith('postgres.') ? target.username.slice(9) : undefined,
          relation: 'public.tpo_opportunities',
        });
      }
      throw error;
    }
  }
  async opportunity(id: string): Promise<TpoOpportunity | undefined> {
    return (await this.sql.query('SELECT * FROM public.tpo_opportunities WHERE id = $1', [id])).rows[0];
  }
  async createOpportunity(o: Omit<TpoOpportunity, 'id' | 'is_open'>): Promise<TpoOpportunity> {
    return (await this.sql.query(`INSERT INTO public.tpo_opportunities
      (title, template, deadline, gap_before_label, gap_during_label, diploma_allowed)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [o.title, o.template, o.deadline, o.gap_before_label, o.gap_during_label, o.diploma_allowed])).rows[0];
  }
  async student(roll: string, email: string): Promise<{ id: string; snapshot: TpoSnapshot } | undefined> {
    const row = (await this.sql.query(`SELECT id, college, first_name, last_name, roll_number, gender,
      to_char(date_of_birth, 'YYYY-MM-DD') AS dob, mobile_number, email, tenth_percentage,
      intermediate_percentage, diploma_percentage, intermediate_or_diploma, percentage,
      branch, other_branch, btech_year_of_passing, active_backlogs
      FROM public.students WHERE upper(roll_number) = upper($1) AND lower(email) = lower($2)`, [roll, email])).rows[0];
    if (!row) return undefined;
    const numberOrNull = (v: unknown) => v === null || v === undefined ? null : Number(v);
    return { id: row.id, snapshot: {
      college: row.college, name: `${row.first_name || ''} ${row.last_name || ''}`.trim().toUpperCase(),
      rollNumber: row.roll_number, gender: row.gender, dob: row.dob, phone: row.mobile_number, email: row.email,
      tenthPercentage: numberOrNull(row.tenth_percentage),
      intermediatePercentage: numberOrNull(row.intermediate_or_diploma === 'Diploma' ? row.diploma_percentage : row.intermediate_percentage),
      educationRoute: row.intermediate_or_diploma, graduationPercentage: numberOrNull(row.percentage),
      branch: row.branch === 'Other' ? row.other_branch || row.branch : row.branch,
      yop: row.btech_year_of_passing || '', activeBacklogs: numberOrNull(row.active_backlogs),
    } };
  }
  async application(opportunityId: string, studentId: string): Promise<TpoApplication | undefined> {
    return (await this.sql.query('SELECT * FROM public.tpo_applications WHERE opportunity_id=$1 AND student_id=$2', [opportunityId, studentId])).rows[0];
  }
  async submit(opportunityId: string, studentId: string, snapshot: TpoSnapshot, details: TpoDetails, version: number): Promise<TpoApplication | undefined> {
    // An atomic upsert prevents duplicate submissions and stale correction overwrites.
    return (await this.sql.query(`INSERT INTO public.tpo_applications (opportunity_id, student_id, snapshot, details)
      SELECT id, $2, $3::jsonb, $4::jsonb FROM public.tpo_opportunities
      WHERE id=$1 AND is_open AND deadline > now()
      ON CONFLICT (opportunity_id, student_id) DO UPDATE
      SET snapshot=EXCLUDED.snapshot, details=EXCLUDED.details, status='Submitted', correction_note='',
        reviewed_by_department=NULL, version=tpo_applications.version+1, updated_at=now()
      WHERE tpo_applications.status='Needs Correction' AND tpo_applications.version=$5
      RETURNING *`, [opportunityId, studentId, JSON.stringify(snapshot), JSON.stringify(details), version])).rows[0];
  }
  async applications(opportunityId: string, branches: string[] | null): Promise<TpoApplication[]> {
    return (await this.sql.query(`SELECT a.* FROM public.tpo_applications a
      JOIN public.students s ON s.id=a.student_id
      WHERE a.opportunity_id=$1 AND ($2::text[] IS NULL OR s.branch=ANY($2::text[]))
      ORDER BY a.snapshot->>'rollNumber'`, [opportunityId, branches])).rows;
  }
  async review(id: string, version: number, status: ApplicationStatus, note: string, department: string, branches: string[] | null): Promise<TpoApplication | undefined> {
    return (await this.sql.query(`UPDATE public.tpo_applications a
      SET status=$3, correction_note=$4, reviewed_by_department=$5, version=a.version+1, updated_at=now()
      FROM public.students s WHERE a.id=$1 AND a.version=$2 AND s.id=a.student_id
      AND ($6::text[] IS NULL OR s.branch=ANY($6::text[])) RETURNING a.*`,
    [id, version, status, note, department, branches])).rows[0];
  }
}
let store: TpoStore | undefined;
export function getTpoStore(): TpoStore {
  if (!process.env.DATABASE_URL) throw new Error('TPO database is not configured.');
  if (!store) store = new TpoStore(new pg.Pool(tpoPoolConfig(process.env.DATABASE_URL)));
  return store;
}

// Public CA distributed by Supabase Studio (valid through April 2031).
// https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt
const SUPABASE_CA = `-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----`;

export function tpoPoolConfig(connectionString: string): pg.PoolConfig {
  const url = new URL(connectionString);
  const supabase = url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.supabase.com');
  if (supabase) {
    // pg's URL SSL options replace the explicit CA configuration. Enforce
    // certificate AND hostname verification for Supabase regardless of URL mode.
    for (const key of ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
  }
  return {
    connectionString: supabase ? url.toString() : connectionString,
    ssl: supabase ? { rejectUnauthorized: true, ca: [...rootCertificates, SUPABASE_CA] } : undefined,
    max: 3,
    connectionTimeoutMillis: 10000,
  };
}
