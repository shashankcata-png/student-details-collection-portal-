import { db } from '../../server/db.js';
import { validateVerificationToken, consumeVerificationToken } from '../../server/otp.js';
import {
  validateEmail,
  validateMobileNumber,
  validateRollNumber,
  calculateBtechPercentageFromCgpa,
  calculatePercentageFromCgpa
} from '../../src/lib/validation.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const {
      firstName,
      lastName,
      rollNumber,
      dateOfBirth,
      gender,
      email,
      verificationToken,
      mobileNumber,
      aadharNumber,
      panNumber,
      passportNumber,
      college,
      branch,
      otherBranch,
      cgpa,
      percentage,
      activeBacklogs,
      intermediateOrDiploma,
      intermediateCgpa,
      intermediatePercentage,
      diplomaCgpa,
      diplomaPercentage,
      intermediateYearOfPassing,
      btechYearOfPassing,
      tenthCgpa,
      tenthPercentage,
      tenthYearOfPassing,
      crtRegistration,
    } = req.body || {};

    const errors: Record<string, string> = {};

    // 1. Verify First Name
    const trimmedFirstName = typeof firstName === 'string' ? firstName.trim() : '';
    if (!trimmedFirstName) {
      errors.firstName = 'First name is required.';
    } else if (trimmedFirstName.length < 2 || trimmedFirstName.length > 50) {
      errors.firstName = 'First name must be between 2 and 50 characters.';
    }

    // 2. Verify Last Name
    const trimmedLastName = typeof lastName === 'string' ? lastName.trim() : '';
    if (!trimmedLastName) {
      errors.lastName = 'Last name is required.';
    } else if (trimmedLastName.length > 50) {
      errors.lastName = 'Last name cannot exceed 50 characters.';
    }

    // 3. Verify Roll Number
    const rollError = validateRollNumber(rollNumber || '');
    if (rollError) {
      errors.rollNumber = rollError;
    }

    // 4. Verify Date of Birth
    if (!dateOfBirth) {
      errors.dateOfBirth = 'Date of birth is required.';
    } else {
      const dob = new Date(dateOfBirth);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (isNaN(dob.getTime()) || dob > today) {
        errors.dateOfBirth = 'Date of birth cannot be a future date.';
      }
    }

    // 5. Verify Gender
    if (!gender || !['Male', 'Female', 'Other'].includes(gender)) {
      errors.gender = 'Please select a valid gender option.';
    }

    // 6. Verify Email & Verification Token
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const emailError = validateEmail(cleanEmail);
    if (emailError) {
      errors.email = emailError;
    } else {
      if (!verificationToken || typeof verificationToken !== 'string') {
        errors.email = 'Please verify your email before submitting.';
      } else {
        const isTokenValid = await validateVerificationToken(cleanEmail, verificationToken);
        if (!isTokenValid) {
          errors.email = 'Email verification has expired or is invalid. Please verify again.';
        }
      }
    }

    // 7. Verify Mobile Number
    const mobileError = validateMobileNumber(mobileNumber || '');
    if (mobileError) {
      errors.mobileNumber = mobileError;
    }

    // 8. Verify identity documents
    const cleanAadhar = typeof aadharNumber === 'string' ? aadharNumber.replace(/\s/g, '') : '';
    if (!/^\d{12}$/.test(cleanAadhar)) {
      errors.aadharNumber = 'Aadhaar number must be exactly 12 digits.';
    }
    const cleanPan = typeof panNumber === 'string' ? panNumber.trim().toUpperCase() : '';
    if (cleanPan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(cleanPan)) {
      errors.panNumber = 'Please enter a valid PAN number.';
    }
    const cleanPassport = typeof passportNumber === 'string' ? passportNumber.trim().toUpperCase() : '';
    if (cleanPassport && !/^[A-Z0-9]{6,9}$/.test(cleanPassport)) {
      errors.passportNumber = 'Please enter a valid Passport number.';
    }

    // 9. Verify College
    const trimmedCollege = 'AVN INSTITUTE OF ENGINEERING AND TECHNOLOGY';
    if (!trimmedCollege) {
      errors.college = 'College / Institution is required.';
    } else if (trimmedCollege.length > 200) {
      errors.college = 'College name cannot exceed 200 characters.';
    }

    // 10. Verify Branch 
    const validBranches = [
      'Computer Science & Engineering (CSE)',
      'CSE – Artificial Intelligence & Machine Learning (AI & ML)',
      'CSE – Data Science (DS)',
      'CSE – Cyber Security (CS)',
      'Artificial Intelligence & Data Science (AI & DS)',
      'Electronics & Communication Engineering (ECE)',
      'Civil Engineering (CE)',
      'Mechanical Engineering (ME)',
      'Other',
      'CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT', 'AI & ML', 'AI & DS', 'CE', 'ME'
    ];
    
    if (!branch || !validBranches.includes(branch)) {
      errors.branch = 'Please select your branch.';
    } else if (branch === 'Other' && (!otherBranch || !String(otherBranch).trim())) {
      errors.otherBranch = 'Please specify your branch/department.';
    }

    // 11. Verify CGPA & Percentage
    const numCgpa = parseFloat(cgpa);
    const numPct = parseFloat(percentage);

    if (isNaN(numCgpa) || numCgpa < 0 || numCgpa > 10) {
      errors.cgpa = 'CGPA must be between 0 and 10.';
    }

    if (isNaN(numPct) || numPct < 0 || numPct > 100) {
      errors.percentage = 'Percentage must be between 0 and 100.';
    }

    if (!errors.cgpa && !errors.percentage) {
      if (Math.abs(calculateBtechPercentageFromCgpa(numCgpa) - numPct) > 0.1) {
        errors.cgpaPercentageMatch = 'CGPA and Percentage do not match. Please check the values.';
      }
    }

    // 12. Verify Active Backlogs
    const numBacklogs = Number(activeBacklogs);
    if (activeBacklogs === undefined || activeBacklogs === null || isNaN(numBacklogs)) {
      errors.activeBacklogs = 'Active backlogs is required.';
    } else if (!Number.isInteger(numBacklogs) || numBacklogs < 0) {
      errors.activeBacklogs = 'Active backlogs cannot be negative.';
    }

    // 13. Verify Intermediate / Diploma
    if (!intermediateOrDiploma || !['Intermediate', 'Diploma'].includes(intermediateOrDiploma)) {
      errors.intermediateOrDiploma = 'Please select either Intermediate or Diploma.';
    }

    if (intermediateOrDiploma === 'Intermediate') {
      const intNum = parseFloat(intermediateCgpa);
      const intPct = parseFloat(intermediatePercentage);
      if (isNaN(intNum) || intNum < 0 || intNum > 10) errors.intermediateCgpa = 'Intermediate CGPA must be between 0 and 10.';
      const expectedIntPct = calculatePercentageFromCgpa(intNum);
      if (isNaN(intPct) || Math.abs(intPct - expectedIntPct) > 0.1) errors.intermediatePercentage = 'Intermediate percentage does not match the CGPA calculation.';
      if (!intermediateYearOfPassing) errors.intermediateYearOfPassing = 'Intermediate Year of Passing is required.';
    } else if (intermediateOrDiploma === 'Diploma') {
      const dipNum = parseFloat(diplomaCgpa);
      const dipPct = parseFloat(diplomaPercentage);
      if (isNaN(dipNum) || dipNum < 0 || dipNum > 10) errors.diplomaCgpa = 'Diploma CGPA must be between 0 and 10.';
      const expectedDipPct = calculatePercentageFromCgpa(dipNum);
      if (isNaN(dipPct) || Math.abs(dipPct - expectedDipPct) > 0.1) errors.diplomaPercentage = 'Diploma percentage does not match the CGPA calculation.';
      if (!intermediateYearOfPassing) errors.intermediateYearOfPassing = 'Diploma Year of Passing is required.';
    }

    // 14. Verify B.Tech Year of Passing
    const btechYopStr = String(btechYearOfPassing || '');
    if (!btechYopStr.trim()) {
      errors.btechYearOfPassing = 'Please select your B.Tech Year of Passing.';
    }

    // 15. Verify 10th CGPA, percentage and year of passing
    const tenthNum = parseFloat(tenthCgpa);
    const tenthPct = parseFloat(tenthPercentage);
    if (isNaN(tenthNum) || tenthNum < 0 || tenthNum > 10) errors.tenthCgpa = '10th CGPA must be between 0 and 10.';
    const expectedTenthPct = calculatePercentageFromCgpa(tenthNum);
    if (isNaN(tenthPct) || Math.abs(tenthPct - expectedTenthPct) > 0.1) errors.tenthPercentage = '10th percentage does not match the CGPA calculation.';
    if (!tenthYearOfPassing) errors.tenthYearOfPassing = '10th Year of Passing is required.';

    if (!['Registered', 'Not Registered'].includes(crtRegistration)) {
      errors.crtRegistration = 'Please select your CRT registration status.';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Please resolve all validation errors before submitting.',
        errors,
      });
    }

    // 16. Check duplicate roll number
    const normalizedRoll = String(rollNumber || '').trim().toUpperCase();
    const existingStudent = await db.findStudentByRollNumber(normalizedRoll);
    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: 'This roll number has already been registered.',
        errors: {
          rollNumber: 'This roll number has already been registered.',
        },
      });
    }

    // 17. Insert Student into Database
    try {
      const student = await db.insertStudent({
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        rollNumber: normalizedRoll,
        dateOfBirth,
        gender,
        email: cleanEmail,
        emailVerified: true,
        mobileNumber: String(mobileNumber || '').trim(),
        aadharNumber: cleanAadhar,
        panNumber: cleanPan || null,
        passportNumber: cleanPassport || null,
        college: trimmedCollege,
        branch: String(branch).substring(0, 48),
        otherBranch: branch === 'Other' && otherBranch ? String(otherBranch).trim().substring(0, 48) : null,
        cgpa: numCgpa,
        percentage: numPct,
        activeBacklogs: numBacklogs,
        intermediateOrDiploma: intermediateOrDiploma || null,
        intermediateCgpa: intermediateOrDiploma === 'Intermediate' && !isNaN(parseFloat(intermediateCgpa)) ? parseFloat(intermediateCgpa) : null,
        intermediatePercentage: intermediateOrDiploma === 'Intermediate' && !isNaN(parseFloat(intermediatePercentage)) ? parseFloat(intermediatePercentage) : null,
        diplomaCgpa: intermediateOrDiploma === 'Diploma' && !isNaN(parseFloat(diplomaCgpa)) ? parseFloat(diplomaCgpa) : null,
        diplomaPercentage: intermediateOrDiploma === 'Diploma' && !isNaN(parseFloat(diplomaPercentage)) ? parseFloat(diplomaPercentage) : null,
        intermediateYearOfPassing: intermediateYearOfPassing ? String(intermediateYearOfPassing).trim() : null,
        btechYearOfPassing: btechYearOfPassing ? String(btechYearOfPassing).trim() : null,
        tenthCgpa: !isNaN(parseFloat(tenthCgpa)) ? parseFloat(tenthCgpa) : null,
        tenthPercentage: !isNaN(parseFloat(tenthPercentage)) ? parseFloat(tenthPercentage) : null,
        tenthYearOfPassing: tenthYearOfPassing ? String(tenthYearOfPassing).trim() : null,
        crtRegistration: crtRegistration ? String(crtRegistration).trim() : null,
      });

      // 18. Invalidate single-use token
      await consumeVerificationToken(cleanEmail, verificationToken);

      return res.status(201).json({
        success: true,
        message: 'Your student details have been submitted successfully.',
        submissionId: student.id,
        student: {
          name: `${student.first_name} ${student.last_name}`,
          rollNumber: student.roll_number,
          email: student.email,
          submissionId: student.id,
        },
      });
    } catch (dbError: any) {
      console.error('[DB INSERT ERROR]:', dbError);
      
      if (dbError.code === '23505') {
        return res.status(400).json({
          success: false,
          message: 'This roll number has already been registered.',
          errors: {
            rollNumber: 'This roll number has already been registered.',
          },
        });
      }
      return res.status(500).json({
        success: false,
        message: dbError?.message || dbError?.toString() || 'Database insertion failed.',
        errorDetails: dbError
      });
    }
  } catch (error: any) {
    console.error('Vercel handler error in /api/students/submit:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'An unexpected server error occurred.',
    });
  }
}
