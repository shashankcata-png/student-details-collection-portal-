import { db } from '../../server/db.js';
import { DEPARTMENTS, getDepartmentAliases, verifyFacultyToken } from '../../server/faculty.js';

function extractSession(req: any): { dept: string } | null {
  const authHeader = req.headers.authorization;
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.query?.token) {
    token = req.query.token;
  }
  if (!token) return null;
  return verifyFacultyToken(token);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed.' });
  res.setHeader('Cache-Control', 'no-store');
  const session = extractSession(req);
  if (!session) {
    return res.status(401).json({ success: false, message: 'Unauthorized. Please log in to faculty portal.' });
  }

  const { branch, search } = req.query || {};
  let targetBranches: string[] | undefined;
  if (session.dept === 'ALL') {
    if (typeof branch === 'string' && branch && branch !== 'ALL') {
      targetBranches = getDepartmentAliases(branch);
    }
  } else {
    targetBranches = getDepartmentAliases(session.dept);
  }

  try {
    const students = await db.listStudents({
      branch: targetBranches,
      yop: typeof req.query.yop === 'string' ? req.query.yop : undefined,
      search: typeof search === 'string' && search ? search : undefined,
    });

    return res.json({
      success: true,
      department: session.dept,
      departmentName: DEPARTMENTS[session.dept]?.name || session.dept,
      count: students.length,
      students,
    });
  } catch (error: any) {
    console.error('Error in Vercel /api/faculty/students:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve students.' });
  }
}
