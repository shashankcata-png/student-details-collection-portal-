import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { StudentRecord } from '../types/student';
import { CollegeBanner } from './CollegeBanner';
import { FacultyTpoPanel } from './FacultyTpoPanel';

interface FacultyPortalProps {
  onBackToStudentForm: () => void;
}

interface DepartmentOption {
  code: string;
  name: string;
}

export const FacultyPortal: React.FC<FacultyPortalProps> = ({ onBackToStudentForm }) => {
  // Auth state
  const [token, setToken] = useState<string>(() => localStorage.getItem('faculty_token') || '');
  const [facultyDept, setFacultyDept] = useState<string>(() => localStorage.getItem('faculty_dept') || '');
  const [facultyDeptName, setFacultyDeptName] = useState<string>(() => localStorage.getItem('faculty_dept_name') || '');

  // Login form state
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('CSE');
  const [password, setPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // Portal data state
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Edit Modal State
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<StudentRecord>>({});
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedYop, setSelectedYop] = useState<string>('ALL');
  const [selectedAdminBranch, setSelectedAdminBranch] = useState<string>('ALL');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/faculty/departments')
      .then((res) => res.json())
      .then((data) => {
        if (data.departments) {
          setDepartments(data.departments);
        }
      })
      .catch(() => {});
  }, []);

  const fetchStudents = async () => {
    if (!token) return;
    setIsLoadingStudents(true);
    setLoadError(null);

    try {
      const params = new URLSearchParams();
      if (facultyDept === 'ALL' && selectedAdminBranch !== 'ALL') {
        params.append('branch', selectedAdminBranch);
      }
      if (selectedYop !== 'ALL') {
        params.append('yop', selectedYop);
      }
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      const res = await fetch(`/api/faculty/students?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        handleLogout();
        setLoginError('Session expired. Please log in again.');
        return;
      }

      const data = await res.json();
      if (res.ok && data.success) {
        setStudents(data.students || []);
      } else {
        setLoadError(data.message || 'Failed to load students.');
      }
    } catch {
      setLoadError('Network error while retrieving students.');
    } finally {
      setIsLoadingStudents(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchStudents();
    }
  }, [token, selectedAdminBranch, selectedYop]);

  const handleDeleteStudent = async (id: string, rollNumber: string) => {
    if (!window.confirm(`WARNING: Are you sure you want to delete the record for ${rollNumber}? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(id);
    try {
      const res = await fetch('/api/faculty/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStudents((prev) => prev.filter((s) => s.id !== id));
      } else {
        alert(data.message || 'Failed to delete student.');
      }
    } catch (err) {
      alert('Network error while deleting student. Please try again.');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    
    setIsUpdating(true);
    try {
      const res = await fetch('/api/faculty/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: editingStudent.id, updates: editFormData }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStudents((prev) => prev.map((s) => (s.id === editingStudent.id ? { ...s, ...data.student } : s)));
        setEditingStudent(null);
        alert('Student details updated successfully!');
      } else {
        alert(data.message || 'Failed to update student details.');
      }
    } catch (err) {
      alert('Network error while updating details. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const openEditModal = (student: StudentRecord) => {
    setEditingStudent(student);
    setEditFormData({
      first_name: student.first_name,
      last_name: student.last_name,
      roll_number: student.roll_number,
      branch: student.branch,
      other_branch: student.other_branch,
      college: student.college,
      date_of_birth: student.date_of_birth,
      gender: student.gender,
      aadhar_number: student.aadhar_number,
      pan_number: student.pan_number,
      passport_number: student.passport_number,
      tenth_cgpa: student.tenth_cgpa,
      tenth_percentage: student.tenth_percentage,
      tenth_year_of_passing: student.tenth_year_of_passing,
      intermediate_or_diploma: student.intermediate_or_diploma,
      intermediate_cgpa: student.intermediate_cgpa,
      intermediate_percentage: student.intermediate_percentage,
      diploma_cgpa: student.diploma_cgpa,
      diploma_percentage: student.diploma_percentage,
      intermediate_year_of_passing: student.intermediate_year_of_passing,
      cgpa: student.cgpa,
      percentage: student.percentage,
      active_backlogs: student.active_backlogs,
      btech_year_of_passing: student.btech_year_of_passing,
      crt_registration: student.crt_registration,
      email: student.email,
      mobile_number: student.mobile_number,
      linkedin_link: student.linkedin_link,
      resume_link: student.resume_link,
      github_link: student.github_link,
      hackerrank_link: student.hackerrank_link,
      leetcode_link: student.leetcode_link,
      codechef_link: student.codechef_link,
      codeforces_link: student.codeforces_link,
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!selectedDept || !password.trim()) {
      setLoginError('Please select a department and enter the password.');
      return;
    }

    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/faculty/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department: selectedDept, password }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.token) {
        setToken(data.token);
        setFacultyDept(data.department);
        setFacultyDeptName(data.departmentName);
        localStorage.setItem('faculty_token', data.token);
        localStorage.setItem('faculty_dept', data.department);
        localStorage.setItem('faculty_dept_name', data.departmentName);
        setPassword('');
      } else {
        setLoginError(data.message || 'Invalid credentials.');
      }
    } catch {
      setLoginError('Network error during login. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setToken('');
    setFacultyDept('');
    setFacultyDeptName('');
    localStorage.removeItem('faculty_token');
    localStorage.removeItem('faculty_dept');
    localStorage.removeItem('faculty_dept_name');
    setStudents([]);
  };

  const filteredStudents = useMemo(() => {
    let result = students;
    if (selectedYop !== 'ALL') {
      result = result.filter((s) => s.btech_year_of_passing === selectedYop);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          (s.first_name && s.first_name.toLowerCase().includes(q)) ||
          (s.last_name && s.last_name.toLowerCase().includes(q)) ||
          (s.roll_number && s.roll_number.toLowerCase().includes(q)) ||
          (s.email && s.email.toLowerCase().includes(q)) ||
          (s.mobile_number && s.mobile_number.includes(q))
      );
    }
    return result;
  }, [students, selectedYop, searchQuery]);

  const stats = useMemo(() => {
    const total = filteredStudents.length;
    if (total === 0) {
      return { total: 0, avgCgpa: '0.00', zeroBacklogs: 0, activeBacklogsCount: 0 };
    }
    const sumCgpa = filteredStudents.reduce((acc, curr) => acc + Number(curr.cgpa || 0), 0);
    const avgCgpa = (sumCgpa / total).toFixed(2);
    const zeroBacklogs = filteredStudents.filter((s) => Number(s.active_backlogs) === 0).length;
    const activeBacklogsCount = total - zeroBacklogs;

    return { total, avgCgpa, zeroBacklogs, activeBacklogsCount };
  }, [filteredStudents]);

  const handleExportToExcel = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      // Session is sent in the authorization header.
      if (facultyDept === 'ALL' && selectedAdminBranch !== 'ALL') {
        params.append('branch', selectedAdminBranch);
      }
      if (selectedYop !== 'ALL') {
        params.append('yop', selectedYop);
      }
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      const exportUrl = `/api/faculty/export?${params.toString()}`;
      const response = await fetch(exportUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        const deptTag = (facultyDept === 'ALL' && selectedAdminBranch !== 'ALL' ? selectedAdminBranch : facultyDept).replace(/[^a-zA-Z0-9]/g, '_');
        a.href = url;
        a.download = `AVN_Students_${deptTag}_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        clientSideExcelExport();
      }
    } catch {
      clientSideExcelExport();
    } finally {
      setIsExporting(false);
    }
  };

  const clientSideExcelExport = () => {
    const exportData = filteredStudents.map((s, idx) => ({
      'S.No': idx + 1,
      'Roll Number / Hall Ticket': s.roll_number,
      'Full Name': `${s.first_name || ''} ${s.last_name || ''}`.trim() || '-',
      'First Name': s.first_name || '-',
      'Last Name': s.last_name || '-',
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
      'CGPA (0-10)': Number(s.cgpa),
      'Percentage (%)': `${Number(s.percentage)}%`,
      'Active Backlogs': Number(s.active_backlogs),
      'CRT Registration': s.crt_registration || '-',
      'Submission Date': s.created_at ? new Date(s.created_at).toLocaleString() : '',
      'Submission ID': s.id,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
      { wch: 6 }, { wch: 18 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 18 },
      { wch: 35 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 10 },
      { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 22 }, { wch: 36 },
    ];

    const workbook = XLSX.utils.book_new();
    const sheetTitle = (facultyDept === 'ALL' ? 'All_Students' : `${facultyDept}_Students`).replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetTitle.slice(0, 31));
    XLSX.writeFile(workbook, `AVN_Students_${sheetTitle}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (!token) {
    return (
      <div className="max-w-4xl mx-auto my-6 sm:my-8 px-4">
        <CollegeBanner />
        <div className="max-w-xl mx-auto bg-white rounded-lg border border-gray-200 shadow-xs overflow-hidden">
          <div className="h-2.5 bg-blue-700 w-full" />
          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded border border-blue-100">
                Department Faculty Access
              </span>
              <button
                type="button"
                onClick={onBackToStudentForm}
                className="text-xs text-gray-500 hover:text-blue-600 transition-colors flex items-center gap-1 cursor-pointer"
              >
                ← Back to Student Form
              </button>
            </div>

            <div className="flex items-center gap-3.5 mb-2">
              <img
                src="/avn-logo.png"
                alt="AVN Crest Logo"
                className="w-12 h-12 object-contain rounded-md shadow-xs border border-gray-100 bg-white p-0.5 shrink-0"
                referrerPolicy="no-referrer"
              />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight leading-tight">
                  Faculty Department Login
                </h1>
                <p className="text-xs text-gray-500">
                  AVN Institute of Engineering &amp; Technology
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              Select your department to access student registrations for <span className="font-semibold text-gray-800">Academic Session 2026–2027</span>.
            </p>

            {loginError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div>
                <label htmlFor="deptSelect" className="block text-sm font-medium text-gray-700 mb-1">
                  Select Department <span className="text-red-500">*</span>
                </label>
                <select
                  id="deptSelect"
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-md border border-gray-300 text-sm text-gray-900 bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                >
                  {departments.length > 0 ? (
                    departments.map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="CSE">Computer Science & Engineering (CSE)</option>
                      <option value="CSE-AIML">CSE – Artificial Intelligence & Machine Learning (AI & ML)</option>
                      <option value="CSE-DS">CSE – Data Science (DS)</option>
                      <option value="CSE-CS">CSE – Cyber Security (CS)</option>
                      <option value="AI-DS">Artificial Intelligence & Data Science (AI & DS)</option>
                      <option value="ECE">Electronics & Communication Engineering (ECE)</option>
                      <option value="CE">Civil Engineering (CE)</option>
                      <option value="ME">Mechanical Engineering (ME)</option>
                      <option value="ALL">All Departments (Dean / Admin)</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label htmlFor="deptPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Faculty Department Password <span className="text-red-500">*</span>
                </label>
                <input
                  id="deptPassword"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter department password"
                  className="w-full px-3.5 py-2.5 rounded-md border border-gray-300 text-sm text-gray-900 bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className={`w-full py-2.5 px-4 rounded-md text-sm font-semibold text-white transition-colors cursor-pointer ${
                  isLoggingIn
                    ? 'bg-blue-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                }`}
              >
                {isLoggingIn ? 'Authenticating...' : 'Login to Department Portal'}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
              <span>Authorized Faculty &amp; Staff Access Only</span>
              <span>AVN Institute &bull; 2026</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto my-6 px-4 relative">
      <CollegeBanner />
      <FacultyTpoPanel token={token} department={facultyDept} />
      <div className="bg-white rounded-lg border border-gray-200 shadow-xs overflow-hidden mb-6">
        <div className="h-2.5 bg-blue-700 w-full" />
        <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <img
              src="/avn-logo.png"
              alt="AVN Crest Logo"
              className="w-13 h-13 object-contain rounded-md shadow-xs border border-gray-100 bg-white p-0.5 shrink-0 hidden sm:block"
              referrerPolicy="no-referrer"
            />
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Faculty Authenticated
                </span>
                <span className="text-xs font-mono font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  Dept: {facultyDept}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                {facultyDeptName || `${facultyDept} Department Portal`}
              </h1>
              <p className="text-xs text-gray-500 mt-1">
                AVN Institute of Engineering and Technology &bull; Academic Session 2026–2027 &bull; Student Details Registry
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportToExcel}
              disabled={isExporting || filteredStudents.length === 0}
              className={`px-4 py-2.5 rounded-md text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-xs ${
                filteredStudents.length === 0
                  ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white active:bg-emerald-800'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {isExporting ? 'Exporting...' : 'Export to Excel (.xlsx)'}
            </button>

            <button
              type="button"
              onClick={onBackToStudentForm}
              className="px-3.5 py-2.5 rounded-md text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 transition-colors cursor-pointer"
            >
              Student Form
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="px-3.5 py-2.5 rounded-md text-sm font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-xs">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Registered Students</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">In current filter view</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-xs">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Average CGPA</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stats.avgCgpa}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Scale of 0.00 – 10.00</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-xs">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">0 Backlogs (Clean)</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.zeroBacklogs}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">All clear students</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-xs">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active Backlogs</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{stats.activeBacklogsCount}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Need academic support</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-xs mb-6">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Roll Number, Name, Email, or Mobile..."
              className="w-full pl-9 pr-3.5 py-2 rounded-md border border-gray-300 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {facultyDept === 'ALL' && (
              <select
                value={selectedAdminBranch}
                onChange={(e) => setSelectedAdminBranch(e.target.value)}
                className="px-3 py-2 rounded-md border border-gray-300 text-sm text-gray-800 bg-white focus:outline-none focus:border-blue-600"
              >
                <option value="ALL">All Branches</option>
                <option value="CSE">Computer Science & Engineering (CSE)</option>
                <option value="CSE-AIML">CSE – AI & ML</option>
                <option value="CSE-DS">CSE – Data Science (DS)</option>
                <option value="CSE-CS">CSE – Cyber Security (CS)</option>
                <option value="AI-DS">AI & Data Science (AI & DS)</option>
                <option value="ECE">Electronics & Communication (ECE)</option>
                <option value="CE">Civil Engineering (CE)</option>
                <option value="ME">Mechanical Engineering (ME)</option>
                <option value="Other">Other</option>
              </select>
            )}

            <select
              value={selectedYop}
              onChange={(e) => setSelectedYop(e.target.value)}
              className="px-3 py-2 rounded-md border border-gray-300 text-sm text-gray-800 bg-white focus:outline-none focus:border-blue-600"
            >
              <option value="ALL">All Passing Years (YOP)</option>
              {['2024', '2025', '2026', '2027', '2028', '2029', '2030'].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={fetchStudents}
              disabled={isLoadingStudents}
              className="p-2 rounded-md text-gray-600 hover:text-blue-600 hover:bg-gray-100 border border-gray-300 transition-colors cursor-pointer"
              title="Refresh Records"
            >
              <svg className={`w-4 h-4 ${isLoadingStudents ? 'animate-spin text-blue-600' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-6">
          {loadError}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
            Student Records ({filteredStudents.length})
          </h2>
          <span className="text-xs text-gray-500">
            Showing verified submissions &bull; Ready for Excel export
          </span>
        </div>

        {isLoadingStudents ? (
          <div className="p-12 text-center text-sm text-gray-500">
            <svg className="animate-spin h-6 w-6 text-blue-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            Loading department students...
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500">
            <p className="font-medium text-gray-700">No student records found</p>
            <p className="text-xs text-gray-400 mt-1">
              {searchQuery
                ? 'Try adjusting your search query or filters.'
                : `No students have registered yet under ${facultyDept}. Submit the form from the student view.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-700 border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Roll Number</th>
                  <th className="py-3 px-4">First Name</th>
                  <th className="py-3 px-4">Last Name</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4">B.Tech CGPA</th>
                  <th className="py-3 px-4">Inter / Diploma</th>
                  <th className="py-3 px-4">10th CGPA</th>
                  <th className="py-3 px-4">YOP</th>
                  <th className="py-3 px-4">Percentage</th>
                  <th className="py-3 px-4">Backlogs</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Mobile</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStudents.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="py-3 px-4 text-xs text-gray-400">{idx + 1}</td>
                    <td className="py-3 px-4 font-mono font-semibold text-gray-900 whitespace-nowrap">
                      {s.roll_number}
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">
                      {s.first_name}
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">
                      {s.last_name}
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-blue-700">
                      <span className="bg-blue-50 px-2 py-0.5 rounded border border-blue-100 whitespace-nowrap">
                        {s.branch}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-900 font-mono">
                      {Number(s.cgpa).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-xs whitespace-nowrap">
                      {s.intermediate_or_diploma ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="font-medium text-gray-800">{s.intermediate_or_diploma}:</span>
                          <span className="font-mono text-blue-700 font-semibold">
                            {s.intermediate_or_diploma === 'Intermediate' ? s.intermediate_cgpa : s.diploma_cgpa}
                          </span>
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-700 font-mono whitespace-nowrap">
                      {s.tenth_cgpa !== null && s.tenth_cgpa !== undefined ? Number(s.tenth_cgpa).toFixed(2) : '-'}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-700 font-mono whitespace-nowrap">
                      {s.btech_year_of_passing || '-'}
                    </td>
                    <td className="py-3 px-4 text-gray-600 font-mono">
                      {Number(s.percentage).toFixed(2)}%
                    </td>
                    <td className="py-3 px-4">
                      {Number(s.active_backlogs) === 0 ? (
                        <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          0 (Clear)
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                          {s.active_backlogs}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-600">
                      <div className="flex items-center gap-1">
                        <span>{s.email}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-600 font-mono whitespace-nowrap">
                      +91 {s.mobile_number}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(s)}
                          className="p-1.5 rounded-md text-blue-600 bg-blue-50 hover:bg-blue-100 hover:text-blue-700 transition-colors cursor-pointer"
                          title="Modify Details"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(s.id, s.roll_number)}
                          disabled={isDeleting === s.id}
                          className={`p-1.5 rounded-md transition-colors ${
                            isDeleting === s.id
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 cursor-pointer'
                          }`}
                          title={`Delete ${s.roll_number}`}
                        >
                          {isDeleting === s.id ? (
                            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Student Modal Popup */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">Modify Student Details</h3>
              <button onClick={() => setEditingStudent(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form id="editStudentForm" onSubmit={handleUpdateStudent} className="space-y-6">
                
                {/* 1. Personal Details */}
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 border-b pb-1">Personal & Identity Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                      <input type="text" value={editFormData.first_name || ''} onChange={e => setEditFormData({...editFormData, first_name: e.target.value.toUpperCase()})} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                      <input type="text" value={editFormData.last_name || ''} onChange={e => setEditFormData({...editFormData, last_name: e.target.value.toUpperCase()})} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                      <select value={editFormData.gender || ''} onChange={e => setEditFormData({...editFormData, gender: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500">
                        <option value="">Select</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                      <input type="date" value={editFormData.date_of_birth ? editFormData.date_of_birth.split('T')[0] : ''} onChange={e => setEditFormData({...editFormData, date_of_birth: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Aadhaar Number</label>
                      <input type="text" value={editFormData.aadhar_number || ''} onChange={e => setEditFormData({...editFormData, aadhar_number: e.target.value.replace(/\D/g, '')})} maxLength={12} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">PAN Number</label>
                      <input type="text" value={editFormData.pan_number || ''} onChange={e => setEditFormData({...editFormData, pan_number: e.target.value.toUpperCase()})} maxLength={10} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Passport Number</label>
                      <input type="text" value={editFormData.passport_number || ''} onChange={e => setEditFormData({...editFormData, passport_number: e.target.value.toUpperCase()})} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500" />
                    </div>
                  </div>
                </div>

                {/* 2. Academic Details */}
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 border-b pb-1">Academic Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">College</label>
                      <input type="text" value={editFormData.college || ''} readOnly aria-readonly="true" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Roll Number</label>
                      <input type="text" value={editFormData.roll_number || ''} onChange={e => setEditFormData({...editFormData, roll_number: e.target.value.toUpperCase()})} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500" maxLength={10} required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                      <input type="text" value={editFormData.branch || ''} onChange={e => setEditFormData({...editFormData, branch: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500" required />
                    </div>
                    {editFormData.branch === 'Other' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Other Branch Name</label>
                        <input type="text" value={editFormData.other_branch || ''} onChange={e => setEditFormData({...editFormData, other_branch: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500" />
                      </div>
                    )}
                    
                    {/* 10th Details */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">10th Details</label>
                      <div className="flex gap-2">
                        <input type="number" step="0.01" placeholder="CGPA" value={editFormData.tenth_cgpa || ''} onChange={e => setEditFormData({...editFormData, tenth_cgpa: parseFloat(e.target.value)})} className="w-1/2 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500" />
                        <input type="text" placeholder="YOP" value={editFormData.tenth_year_of_passing || ''} onChange={e => setEditFormData({...editFormData, tenth_year_of_passing: e.target.value})} className="w-1/2 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500" />
                      </div>
                    </div>
                    
                    {/* Inter/Diploma Details */}
                    <div className="flex gap-2 col-span-1 md:col-span-2 lg:col-span-1">
                      <div className="w-1/3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Inter/Diploma</label>
                        <select value={editFormData.intermediate_or_diploma || ''} onChange={e => setEditFormData({...editFormData, intermediate_or_diploma: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500">
                          <option value="Intermediate">Intermediate</option>
                          <option value="Diploma">Diploma</option>
                        </select>
                      </div>
                      <div className="w-1/3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">CGPA</label>
                        <input type="number" step="0.01" placeholder="CGPA" value={editFormData.intermediate_or_diploma === 'Diploma' ? (editFormData.diploma_cgpa || '') : (editFormData.intermediate_cgpa || '')} 
                          onChange={e => {
                            if (editFormData.intermediate_or_diploma === 'Diploma') {
                              setEditFormData({...editFormData, diploma_cgpa: parseFloat(e.target.value)});
                            } else {
                              setEditFormData({...editFormData, intermediate_cgpa: parseFloat(e.target.value)});
                            }
                          }} 
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500" />
                      </div>
                      <div className="w-1/3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">YOP</label>
                        <input type="text" placeholder="YOP" value={editFormData.intermediate_year_of_passing || ''} onChange={e => setEditFormData({...editFormData, intermediate_year_of_passing: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">B.Tech CGPA</label>
                      <input type="number" step="0.01" value={editFormData.cgpa || ''} onChange={e => setEditFormData({...editFormData, cgpa: parseFloat(e.target.value)})} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Percentage (%)</label>
                      <input type="number" step="0.01" value={editFormData.percentage || ''} onChange={e => setEditFormData({...editFormData, percentage: parseFloat(e.target.value)})} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Active Backlogs</label>
                      <input type="number" value={editFormData.active_backlogs === undefined ? '' : editFormData.active_backlogs} onChange={e => setEditFormData({...editFormData, active_backlogs: parseInt(e.target.value)})} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Passing Year (YOP)</label>
                      <input type="text" value={editFormData.btech_year_of_passing || ''} onChange={e => setEditFormData({...editFormData, btech_year_of_passing: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">CRT Registration</label>
                      <select value={editFormData.crt_registration || ''} onChange={e => setEditFormData({...editFormData, crt_registration: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500">
                        <option value="">Select</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 3. Contact Details */}
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 border-b pb-1">Contact Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                      <input type="email" value={editFormData.email || ''} onChange={e => setEditFormData({...editFormData, email: e.target.value.toLowerCase()})} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                      <input type="text" value={editFormData.mobile_number || ''} onChange={e => setEditFormData({...editFormData, mobile_number: e.target.value.replace(/\D/g, '')})} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500" maxLength={10} required />
                    </div>
                  </div>
                </div>

              </form>
            </div>
            
            {/* Modal Footer Buttons */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button type="button" onClick={() => setEditingStudent(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer">
                Cancel
              </button>
              <button type="submit" form="editStudentForm" disabled={isUpdating} className={`px-4 py-2 text-sm font-medium text-white rounded-md cursor-pointer ${isUpdating ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {isUpdating ? 'Saving Changes...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
