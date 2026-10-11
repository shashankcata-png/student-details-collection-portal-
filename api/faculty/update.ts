import { db } from '../../server/db.js';
import { verifyFacultyToken, getDepartmentAliases } from '../../server/faculty.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // 1. Verify Faculty Login Token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyFacultyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ success: false, message: 'Invalid or expired session. Please log in again.' });
  }

  try {
    // 2. Safely parse the body
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { id, updates } = body;

    if (!id || !updates) {
      return res.status(400).json({ success: false, message: 'Student ID and updates are required.' });
    }

    if (decoded.dept !== 'ALL') {
      const aliases = getDepartmentAliases(decoded.dept);
      const permitted = await db.listStudents({ branch: aliases });
      if (!permitted.some(s => s.id === id) || (updates.branch !== undefined && !aliases.includes(updates.branch))) {
        return res.status(403).json({ success: false, message: 'Student is outside your department.' });
      }
    }

    // 3. SAFETY STRIP: If this is a soft delete or purely a status change, 
    // remove unique identifiers from the update payload to prevent 23505 constraint errors.
    if (updates.is_deleted === true || updates.status === 'deleted') {
      delete updates.roll_number;
      delete updates.email;
    }

    // 4. Update Database
    const updatedStudent = await db.updateStudent(id, updates);
    if (updatedStudent) {
      return res.status(200).json({ success: true, message: 'Student updated successfully.', student: updatedStudent });
    } else {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }
  } catch (error: any) {
    console.error('Update Error:', error);
    
    // 5. Handle Unique Constraint Violations
    if (error.code === '23505') {
      return res.status(400).json({ 
        success: false, 
        message: 'That Roll Number or Email is already in use by another student.' 
      });
    }
    
    return res.status(500).json({ success: false, message: 'Failed to update student in the database.' });
  }
}
