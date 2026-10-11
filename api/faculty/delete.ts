import { db } from '../../server/db.js';
import { verifyFacultyToken, getDepartmentAliases } from '../../server/faculty.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyFacultyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ success: false, message: 'Invalid or expired session.' });
  }

  try {
    const { id } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Student ID is required.' });
    }

    if (decoded.dept !== 'ALL') {
      const permitted = await db.listStudents({ branch: getDepartmentAliases(decoded.dept) });
      if (!permitted.some(s => s.id === id)) return res.status(403).json({ success: false, message: 'Student is outside your department.' });
    }

    // Call the delete method from your db class
    const deleted = await db.deleteStudent(id); 
    
    if (deleted) {
      return res.status(200).json({ success: true, message: 'Student deleted successfully.' });
    } else {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }
  } catch (error: any) {
    if (error.code === '23503') return res.status(409).json({ success: false, message: 'This student has placement applications and cannot be deleted.' });
    console.error('Delete Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete student.' });
  }
}
