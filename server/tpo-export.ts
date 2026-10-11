import * as XLSX from 'xlsx';
import type { TpoApplication, TpoOpportunity } from '../src/types/tpo.js';

export function tpoWorkbook(applications: TpoApplication[], opportunity: TpoOpportunity): XLSX.WorkBook {
  const headers = ['S.No', 'College', 'Name of the student', 'Roll number', 'Gender', 'DOB', 'Contact No.', 'Email id',
    '10%', 'Board', '12%', 'Board', 'Gap in Yrs', 'Grad %', 'Degree', 'B.Tech/B.E Branch', 'Gap in Yrs',
    ...(opportunity.template === 'AE_ABA' ? ['Role                    (AE , ABA or Both)', 'Any Certification'] : ['Any Certification / Course in CS/IT ']),
    'Offer in hand (If any)'];
  const rows: (string | number | null)[][] = [[], ['', '', 'Name of the College/University: ', applications[0]?.snapshot.college || '', '', '', '', '', '', '', 'Date:',
    new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' })], [], headers];
  applications.forEach((a, index) => {
    const s = a.snapshot, d = a.details;
    rows.push([index + 1, s.college, s.name, s.rollNumber, s.gender, s.dob, s.phone, s.email,
      s.tenthPercentage, d.tenthBoard, s.intermediatePercentage, d.intermediateBoard,
      Number(d.gapBefore), s.graduationPercentage, d.degree, s.branch, Number(d.gapDuring),
      ...(opportunity.template === 'AE_ABA' ? [d.role] : []), d.certifications,
      d.hasOffer === 'Yes' ? d.offerDetails : 'No']);
  });
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!ref'] = `A1:${XLSX.utils.encode_col(headers.length - 1)}${rows.length}`;
  sheet['!cols'] = headers.map((_, i) => ({ wch: [1, 2, 7, 15].includes(i) ? 32 : 18 }));
  sheet['!autofilter'] = { ref: `A4:${XLSX.utils.encode_col(headers.length - 1)}${Math.max(4, rows.length)}` };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'TPO');
  return workbook;
}
