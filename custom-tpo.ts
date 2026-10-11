import type { TpoSnapshot } from '../types/tpo.js';
export const PROFILE_FIELDS = {
  college: 'College', name: 'Student name', rollNumber: 'Roll number', gender: 'Gender', dob: 'Date of birth',
  phone: 'Phone', email: 'Email', tenthPercentage: '10th percentage', intermediatePercentage: '12th / Diploma percentage',
  educationRoute: 'Intermediate / Diploma', graduationPercentage: 'Graduation percentage', branch: 'Branch',
  yop: 'Graduation year', activeBacklogs: 'Active backlogs',
} as const;
export interface TemplateColumn {
  header: string; source: string; label: string; type: 'text' | 'number' | 'date' | 'choice' | 'multi'; required: boolean; options: string[];
}
export interface CustomTemplate {
  version: 1; filename: string; sheetName: string; headerRow: number; preamble: string[][]; columns: TemplateColumn[];
}
export function templateErrors(value: unknown): string[] {
  const t = value as CustomTemplate;
  if (!t || typeof t !== 'object' || JSON.stringify(t).length > 100000) return ['Upload a valid template (maximum 100 KB of headings and setup).'];
  if (t.version !== 1 || typeof t.filename !== 'string' || t.filename.length > 160 ||
      typeof t.sheetName !== 'string' || !t.sheetName || t.sheetName.length > 31 || /[\\/?*\[\]:]/.test(t.sheetName) ||
      !Number.isInteger(t.headerRow) || t.headerRow < 1 || t.headerRow > 30 ||
      !Array.isArray(t.preamble) || t.preamble.length !== t.headerRow - 1 ||
      t.preamble.some(r => !Array.isArray(r) || r.length > 50 || r.some(v => typeof v !== 'string' || v.length > 500)) ||
      !Array.isArray(t.columns) || !t.columns.length || t.columns.length > 50) return ['Invalid template layout. Use up to 50 columns and a header within the first 30 rows.'];
  const errors: string[] = [];
  t.columns.forEach((c, i) => {
    if (!c || typeof c.header !== 'string' || c.header.length > 160 || typeof c.label !== 'string' || !c.label.trim() || c.label.length > 160 ||
        !['question', 'serial', 'blank', ...Object.keys(PROFILE_FIELDS)].includes(c.source) ||
        !['text', 'number', 'date', 'choice', 'multi'].includes(c.type) || typeof c.required !== 'boolean' ||
        !Array.isArray(c.options) || c.options.length > 30 || c.options.some(s => typeof s !== 'string' || !s.trim() || s.length > 100) ||
        (c.source === 'question' && (c.type === 'choice' || c.type === 'multi') && !c.options.length)) errors.push(`Check mapping and question settings for column ${i + 1}.`);
  });
  if (!t.columns.some(c => c.source !== 'blank')) errors.push('Map at least one column.');
  return errors;
}
export function customErrors(t: CustomTemplate, answers: Record<string, string> | undefined, snapshot: TpoSnapshot): string[] {
  const errors: string[] = [];
  t.columns.forEach((c, i) => {
    if (c.source === 'serial' || c.source === 'blank') return;
    const v = c.source === 'question' ? answers?.[`c${i}`] : snapshot[c.source as keyof TpoSnapshot];
    if (v === undefined || v === null || String(v).trim() === '') { if (c.required) errors.push(`${c.label} is required${c.source !== 'question' ? ' in your saved profile; contact faculty' : ''}.`); return; }
    if (c.source !== 'question') return;
    if (typeof v !== 'string' || v.length > 2000) { errors.push(`${c.label}: maximum 2000 characters.`); return; }
    if (c.type === 'number' && (!/^-?\d+(\.\d+)?$/.test(v) || !Number.isFinite(Number(v)))) errors.push(`${c.label}: enter a valid number.`);
    if (c.type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v)) errors.push(`${c.label}: enter a valid date.`);
    if (c.type === 'choice' && !c.options.includes(v)) errors.push(`${c.label}: select one of the listed options.`);
    if (c.type === 'multi' && (!v.split(',').map(x => x.trim()).every(x => c.options.includes(x)) || !v.trim())) errors.push(`${c.label}: select valid options.`);
    if (c.type === 'text' && isRoleQuestion(c.label) && !v.split(',').map(x => x.trim()).every(x => roleOptions(c.label, c.options).includes(x))) errors.push(`${c.label}: select valid roles.`);
  });
  return errors;
}
export function suggestSource(header: string): string {
  const h = header.toLowerCase().replace(/[^a-z0-9]/g, '');
  const aliases: Record<string, string> = { sno: 'serial', serialno: 'serial', serialnumber: 'serial', college: 'college', name: 'name', studentname: 'name', nameofthestudent: 'name', rollnumber: 'rollNumber', rollno: 'rollNumber', gender: 'gender', dob: 'dob', dateofbirth: 'dob', contactno: 'phone', mobile: 'phone', mobilenumber: 'phone', phone: 'phone', email: 'email', emailid: 'email', branch: 'branch', btechbebranch: 'branch', graduationyear: 'yop', yop: 'yop', activebacklogs: 'activeBacklogs', backlogs: 'activeBacklogs' };
  return !header.trim() ? 'blank' : aliases[h] || 'question';
}

export const isTenthBoardQuestion = (label: string) => /(?:10th|tenth|ssc).*board|board.*(?:10th|tenth|ssc)/i.test(label);
export const isDegreeQuestion = (label: string) => /^(?:degree|qualification|degree\s*\(.*\))$/i.test(label.trim());
export const isRoleQuestion = (label: string) => /\brole(?:s)?\b/i.test(label);
export function roleOptions(label: string, options: string[]): string[] {
  if (options.length) return options;
  const matches = ['SE', 'AE', 'ABA'].filter(role => new RegExp('\\b' + role + '\\b', 'i').test(label));
  return matches.length ? matches : ['SE', 'AE', 'ABA'];
}
