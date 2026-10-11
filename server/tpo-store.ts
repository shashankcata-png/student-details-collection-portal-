import pg from 'pg';
import type { TpoApplication, TpoDetails, TpoOpportunity, TpoSnapshot, ApplicationStatus } from '../src/types/tpo.js';

export interface Queryable { query(sql: string, values?: any[]): Promise<{ rows: any[] }> }
export class TpoStore {
  constructor(private sql: Queryable) {}
  async opportunities(): Promise<TpoOpportunity[]> {
    return (await this.sql.query('SELECT * FROM public.tpo_opportunities ORDER BY created_at DESC')).rows;
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
  if (!store) store = new TpoStore(new pg.Pool({ connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('supabase') ? { rejectUnauthorized: true } : undefined, max: 3 }));
  return store;
}
