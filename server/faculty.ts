import crypto from 'crypto';
import * as XLSX from 'xlsx';
import { db, type StudentDbRow } from './db.js';

const FACULTY_SECRET = process.env.FACULTY_JWT_SECRET || '';
const GLOBAL_FACULTY_PASS = process.env.FACULTY_PASSWORD || '';

export interface DepartmentInfo {
  code: string;
  name: string;
  defaultPass: string;
  aliases: string[];
}

export const DEPARTMENTS: Record<string, DepartmentInfo> = {
  ALL: {
    code: 'ALL',
    name: 'All Departments (Dean / Admin)',
    defaultPass: 'admin@avn2026',
    aliases: [],
  },
  CSE: {
    code: 'CSE',
    name: 'Computer Science & Engineering (CSE)',
    defaultPass: 'cse@avn2026',
    aliases: ['Computer Science & Engineering (CSE)', 'CSE'],
  },
  'CSE-AIML': {
    code: 'CSE-AIML',
    name: 'CSE – Artificial Intelligence & Machine Learning (AI & ML)',
    defaultPass: 'aiml@avn2026',
    aliases: [
      'CSE – Artificial Intelligence & Machine Learning (AI & ML)',
      'AI & ML',
      'CSE-AIML',
    ],
  },
  'CSE-DS': {
    code: 'CSE-DS',
    name: 'CSE – Data Science (DS)',
    defaultPass: 'ds@avn2026',
    aliases: ['CSE – Data Science (DS)', 'CSE-DS', 'DS'],
  },
  'CSE-CS': {
    code: 'CSE-CS',
    name: 'CSE – Cyber Security (CS)',
    defaultPass: 'cs@avn2026',
    aliases: ['CSE – Cyber Security (CS)', 'CSE-CS', 'CS'],
  },
  'AI-DS': {
    code: 'AI-DS',
    name: 'Artificial Intelligence & Data Science (AI & DS)',
    defaultPass: 'aids@avn2026',
    aliases: [
      'Artificial Intelligence & Data Science (AI & DS)',
      'AI & DS',
      'AI-DS',
    ],
  },
  ECE: {
    code: 'ECE',
    name: 'Electronics & Communication Engineering (ECE)',
    defaultPass: 'ece@avn2026',
    aliases: ['Electronics & Communication Engineering (ECE)', 'ECE'],
  },
  CE: {
    code: 'CE',
    name: 'Civil Engineering (CE)',
    defaultPass: 'civil@avn2026',
    aliases: ['Civil Engineering (CE)', 'CIVIL', 'CE'],
  },
  ME: {
    code: 'ME',
    name: 'Mechanical Engineering (ME)',
    defaultPass: 'mech@avn2026',
    aliases: ['Mechanical Engineering (ME)', 'MECH', 'ME'],
  },
  Other: {
    code: 'Other',
    name: 'Other Departments',
    defaultPass: 'other@avn2026',
    aliases: ['Other'],
  },
};

/**
 * Get all branch aliases for a department code
 */
export function getDepartmentAliases(departmentCode: string): string[] {
  const dept = DEPARTMENTS[departmentCode];
  if (!dept) return [departmentCode];
  return dept.aliases.length > 0 ? dept.aliases : [dept.name];
}

/**
 * Verify department credentials
 */
export function verifyFacultyCredentials(department: string, pass: string): boolean {
  const dept = DEPARTMENTS[department];
  if (!dept || typeof pass !== 'string' || FACULTY_SECRET.length < 32) return false;
  let configured: Record<string, string> = {};
  try { configured = JSON.parse(process.env.FACULTY_DEPARTMENT_PASSWORDS || '{}'); } catch { return false; }
  // Preserve existing department logins as requested by the portal owner.
  // An explicit private override replaces that department's legacy password.
  const expected = department === 'ALL'
    ? (configured.ALL || GLOBAL_FACULTY_PASS || dept.defaultPass)
    : (configured[department] || dept.defaultPass);
  if (typeof expected !== 'string' || !expected) return false;
  const actualHash = crypto.createHash('sha256').update(pass.trim()).digest();
  const expectedHash = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(actualHash, expectedHash);
}

/**
 * Create signed faculty session token
 */
export function createFacultyToken(department: string): string {
  if (FACULTY_SECRET.length < 32 || !DEPARTMENTS[department]) throw new Error('Faculty authentication is not configured.');
  const payload = {
    dept: department,
    exp: Date.now() + 12 * 60 * 60 * 1000, // 12 hours
    iat: Date.now(),
  };
  const str = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', FACULTY_SECRET).update(str).digest('base64url');
  return `${str}.${sig}`;
}

/**
 * Verify faculty session token
 */
export function verifyFacultyToken(token: string): { dept: string } | null {
  if (FACULTY_SECRET.length < 32 || !token || token.split('.').length !== 2) return null;
  const [str, sig] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', FACULTY_SECRET).update(str).digest('base64url');

  if (Buffer.byteLength(sig) !== Buffer.byteLength(expectedSig) || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;

  try {
    const payload = JSON.parse(Buffer.from(str, 'base64url').toString('utf8'));
    if (!Number.isFinite(payload.exp) || payload.exp < Date.now() || !DEPARTMENTS[payload.dept]) return null;
    return { dept: payload.dept };
  } catch {
    return null;
  }
}

/**
 * Generate Excel workbook buffer from student records
 */
export function generateStudentsExcelBuffer(students: StudentDbRow[], department: string): Buffer {
  const data = students.map((s, idx) => ({
    'S.No': idx + 1,
    'Roll Number / Hall Ticket': s.roll_number,
    'Full Name': `${s.first_name || ''} ${s.last_name || ''}`.trim(),
    'Department / Branch': s.branch === 'Other' && s.other_branch ? `${s.branch} (${s.other_branch})` : s.branch,
    'Academic Session': '2026–2027',
    'College / Institution': s.college,
    'Email Address': s.email,
    'Mobile Number': `+91 ${s.mobile_number}`,
    'Aadhaar Number': s.aadhar_number || '-',
    'PAN Number': s.pan_number || '-',
    'Passport Number': s.passport_number || '-',
    'Date of Birth': s.date_of_birth,
    'Gender': s.gender,
    'B.Tech CGPA (0-10)': Number(s.cgpa),
    'B.Tech Percentage (%)': `${Number(s.percentage)}%`,
    'B.Tech Year of Passing (YOP)': s.btech_year_of_passing || '-',
    'Intermediate / Diploma': s.intermediate_or_diploma || '-',
    'Inter / Diploma CGPA': s.intermediate_or_diploma === 'Intermediate'
      ? (s.intermediate_cgpa !== null && s.intermediate_cgpa !== undefined ? Number(s.intermediate_cgpa) : '-')
      : (s.intermediate_or_diploma === 'Diploma'
          ? (s.diploma_cgpa !== null && s.diploma_cgpa !== undefined ? Number(s.diploma_cgpa) : '-')
          : '-'),
    'Inter / Diploma Percentage (%)': s.intermediate_or_diploma === 'Intermediate'
      ? (s.intermediate_percentage !== null && s.intermediate_percentage !== undefined ? `${Number(s.intermediate_percentage)}%` : '-')
      : (s.intermediate_or_diploma === 'Diploma'
          ? (s.diploma_percentage !== null && s.diploma_percentage !== undefined ? `${Number(s.diploma_percentage)}%` : '-')
          : '-'),
    'Inter / Diploma Year of Passing': s.intermediate_year_of_passing || '-',
    '10th CGPA': s.tenth_cgpa !== null && s.tenth_cgpa !== undefined ? Number(s.tenth_cgpa) : '-',
    '10th Percentage (%)': s.tenth_percentage !== null && s.tenth_percentage !== undefined ? `${Number(s.tenth_percentage)}%` : '-',
    '10th Year of Passing': s.tenth_year_of_passing || '-',
    'Active Backlogs': Number(s.active_backlogs),
    'CRT Registration': s.crt_registration || '-',
    'Submission Date': s.created_at ? new Date(s.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
    'Submission ID': s.id,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);

  // Set column widths for readability
  worksheet['!cols'] = [
    { wch: 6 },  // S.No
    { wch: 18 }, // Roll Number
    { wch: 25 }, // Full Name
    { wch: 32 }, // Department
    { wch: 18 }, // Academic Session
    { wch: 35 }, // College
    { wch: 28 }, // Email
    { wch: 16 }, // Mobile
    { wch: 14 }, // DOB
    { wch: 10 }, // Gender
    { wch: 12 }, // CGPA
    { wch: 15 }, // Percentage
    { wch: 15 }, // Backlogs
    { wch: 22 }, // Date
    { wch: 38 }, // ID
  ];

  const workbook = XLSX.utils.book_new();
  const sheetName = department === 'ALL' ? 'All_Students' : `${department.replace(/[^a-zA-Z0-9]/g, '_')}_Students`;
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
