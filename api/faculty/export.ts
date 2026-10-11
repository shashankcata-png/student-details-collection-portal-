import { db } from '../../server/db.js';
import { verifyFacultyToken, getDepartmentAliases, generateStudentsExcelBuffer } from '../../server/faculty.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });
  const token = typeof req.headers.authorization === 'string' ? req.headers.authorization.replace(/^Bearer /, '') : '';
  const session = verifyFacultyToken(token);
  if (!session) return res.status(401).json({ success: false, message: 'Faculty sign-in required.' });
  const department = session.dept === 'ALL' && typeof req.query.branch === 'string' ? req.query.branch : session.dept;
  try {
    const students = await db.listStudents({ branch: department === 'ALL' ? undefined : getDepartmentAliases(department),
      yop: typeof req.query.yop === 'string' ? req.query.yop : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined });
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', 'attachment; filename="Students_Export.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(generateStudentsExcelBuffer(students, department));
  } catch {
    return res.status(500).json({ success: false, message: 'Export failed.' });
  }
}
