import React from 'react';
import { Branch } from '../types/student';
import { calculateBtechPercentageFromCgpa, calculatePercentageFromCgpa } from '../lib/validation';

interface AcademicDetailsProps {
  college: string;
  branch: Branch | '';
  otherBranch: string;
  cgpa: string;
  percentage: string;
  activeBacklogs: number;
  // Education fields
  intermediateOrDiploma: 'Intermediate' | 'Diploma' | '';
  intermediateCgpa: string;
  intermediatePercentage: string;
  diplomaCgpa: string;
  diplomaPercentage: string;
  intermediateYearOfPassing: string;
  btechYearOfPassing: string;
  tenthCgpa: string;
  tenthPercentage: string;
  tenthYearOfPassing: string;
  crtRegistration: 'Registered' | 'Not Registered' | '';
  onChange: (field: string, value: any) => void;
  errors: Record<string, string | undefined>;
}

export const AcademicDetailsSection: React.FC<AcademicDetailsProps> = ({
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
  onChange,
  errors,
}) => {
  const handleEducationCgpaChange = (cgpaField: string, percentageField: string, value: string) => {
    onChange(cgpaField, value);
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0 && num <= 10) {
      onChange(percentageField, calculatePercentageFromCgpa(num).toFixed(2));
    } else if (value === '') {
      onChange(percentageField, '');
    }
  };

  const branches: Branch[] = [
    'Computer Science & Engineering (CSE)',
    'CSE – Artificial Intelligence & Machine Learning (AI & ML)',
    'CSE – Data Science (DS)',
    'CSE – Cyber Security (CS)',
    'Artificial Intelligence & Data Science (AI & DS)',
    'Electronics & Communication Engineering (ECE)',
    'Civil Engineering (CE)',
    'Mechanical Engineering (ME)',
    'Other',
  ];

  // UPDATED: Added earlier years (2018-2022) so users can select their 10th and Inter YOP
  const passingYears = [
    '2018',
    '2019',
    '2020',
    '2021',
    '2022',
    '2023',
    '2024',
    '2025',
    '2026',
    '2027',
    '2028',
    '2029',
    '2030',
  ];

  const handleCgpaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange('cgpa', val);

    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0 && num <= 10) {
      const calcPct = calculateBtechPercentageFromCgpa(num).toFixed(2);
      onChange('percentage', calcPct);
    } else if (val === '') {
      onChange('percentage', '');
    }
  };

  const handleBacklogsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      onChange('activeBacklogs', 0);
      return;
    }
    const intVal = parseInt(val, 10);
    if (!isNaN(intVal) && intVal >= 0) {
      onChange('activeBacklogs', intVal);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-xs overflow-hidden mb-5">
      {/* Section Header */}
      <div className="bg-gray-50/80 px-6 py-4 border-b border-gray-200">
        <h2 className="text-base font-bold text-gray-800 tracking-wide uppercase">
          3. Academic &amp; Education Details
        </h2>
      </div>

      <div className="p-6 space-y-6">
        {/* Field: College / Institution */}
        <div>
          <label htmlFor="college" className="block text-sm font-medium text-gray-700 mb-1.5">
            College / Institution <span className="text-red-500">*</span>
          </label>
          <input
            id="college"
            type="text"
            value={college}
            readOnly aria-readonly="true"
            className={`w-full px-3.5 py-2.5 rounded-md border text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none transition-colors ${
              errors.college
                ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400'
                : 'border-gray-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600'
            }`}
          />
          {errors.college ? (
            <p className="mt-1 text-xs text-red-600">{errors.college}</p>
          ) : (
            <p className="mt-1 text-xs text-gray-400">Institution is fixed and cannot be edited.</p>
          )}
        </div>

        {/* Field: Branch / Department */}
        <div>
          <label htmlFor="branch" className="block text-sm font-medium text-gray-700 mb-1.5">
            Branch / Department <span className="text-red-500">*</span>
          </label>
          <select
            id="branch"
            value={branch}
            onChange={(e) => onChange('branch', e.target.value as Branch)}
            className={`w-full sm:w-80 px-3.5 py-2.5 rounded-md border text-sm text-gray-900 bg-white focus:outline-none transition-colors ${
              errors.branch
                ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400'
                : 'border-gray-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600'
            }`}
          >
            <option value="">Select Branch</option>
            {branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          {errors.branch && (
            <p className="mt-1 text-xs text-red-600">{errors.branch}</p>
          )}

          {/* Conditional Input: Specify Branch if Other */}
          {branch === 'Other' && (
            <div className="mt-3">
              <label htmlFor="otherBranch" className="block text-sm font-medium text-gray-700 mb-1.5">
                Specify Branch / Department <span className="text-red-500">*</span>
              </label>
              <input
                id="otherBranch"
                type="text"
                value={otherBranch}
                onChange={(e) => onChange('otherBranch', e.target.value)}
                placeholder="e.g. Automobile Engineering"
                className={`w-full sm:w-80 px-3.5 py-2.5 rounded-md border text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none transition-colors ${
                  errors.otherBranch
                    ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400'
                    : 'border-gray-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600'
                }`}
              />
              {errors.otherBranch && (
                <p className="mt-1 text-xs text-red-600">{errors.otherBranch}</p>
              )}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 1. FIRST: B.TECH CGPA (and Percentage auto-conversion & Active Backlogs)   */}
        {/* ========================================================================= */}
        <div className="pt-2 border-t border-gray-100 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* B.Tech CGPA */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="cgpa" className="block text-sm font-medium text-gray-700">
                  B.Tech CGPA (0–10) <span className="text-red-500">*</span>
                </label>
              </div>
              <input
                id="cgpa"
                type="number"
                step="0.01"
                min="0"
                max="10"
                value={cgpa}
                onChange={handleCgpaChange}
                placeholder="e.g. 8.50"
                className={`w-full px-3.5 py-2.5 rounded-md border text-sm text-gray-900 bg-white focus:outline-none transition-colors ${errors.cgpa ? 'border-red-400' : 'border-gray-300 focus:border-blue-600'}`}
              />
              {errors.cgpa && (
                <p className="mt-1 text-xs text-red-600">{errors.cgpa}</p>
              )}
            </div>

            {/* B.Tech Percentage */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="percentage" className="block text-sm font-medium text-gray-700">
                  B.Tech Percentage (%) <span className="text-red-500">*</span>
                </label>
                <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">Calculated</span>
              </div>
              <input
                id="percentage"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={percentage}
                readOnly
                placeholder="e.g. 77.50"
                className={`w-full px-3.5 py-2.5 rounded-md border text-sm text-gray-900 bg-blue-50/30 focus:outline-none transition-colors ${errors.percentage ? 'border-red-400' : 'border-blue-200'}`}
              />
              {errors.percentage && (
                <p className="mt-1 text-xs text-red-600">{errors.percentage}</p>
              )}
              {!errors.percentage && <p className="mt-1 text-xs text-gray-400">Calculated automatically using the standard CGPA formula.</p>}
            </div>
          </div>

          {/* CGPA & Percentage Match Error if any */}
          {errors.cgpaPercentageMatch && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-xs text-red-700 font-medium flex items-center gap-1.5">
                <svg className="w-4 h-4 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{errors.cgpaPercentageMatch}</span>
              </p>
              <p className="mt-1 text-[11px] text-red-600 ml-5.5">
                B.Tech Formula: Percentage = (CGPA × 10) − 5
              </p>
            </div>
          )}

          {/* Active Backlogs */}
          <div>
            <label htmlFor="activeBacklogs" className="block text-sm font-medium text-gray-700 mb-1.5">
              Active Backlogs <span className="text-red-500">*</span>
            </label>
            <input
              id="activeBacklogs"
              type="number"
              min="0"
              step="1"
              value={activeBacklogs}
              onChange={handleBacklogsChange}
              className={`w-full sm:w-44 px-3.5 py-2.5 rounded-md border text-sm text-gray-900 bg-white focus:outline-none transition-colors ${
                errors.activeBacklogs
                  ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400'
                  : 'border-gray-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600'
              }`}
            />
            {errors.activeBacklogs ? (
              <p className="mt-1 text-xs text-red-600">{errors.activeBacklogs}</p>
            ) : (
              <p className="mt-1 text-xs text-gray-400">Enter &apos;0&apos; if you have cleared all subjects without active backlogs.</p>
            )}
          </div>
        </div>

        {/* B.Tech Year of Passing — immediately after Active Backlogs */}
        <div className="pt-2 border-t border-gray-100">
          <label htmlFor="btechYearOfPassing" className="block text-sm font-medium text-gray-700 mb-1.5">B.Tech Year of Passing (YOP) <span className="text-red-500">*</span></label>
          <select id="btechYearOfPassing" value={btechYearOfPassing} onChange={(e) => onChange('btechYearOfPassing', e.target.value)} className={`w-full sm:w-80 px-3.5 py-2.5 rounded-md border text-sm text-gray-900 bg-white focus:outline-none ${errors.btechYearOfPassing ? 'border-red-400' : 'border-gray-300 focus:border-blue-600'}`}>
            <option value="">Select Year of Passing</option>{passingYears.map((yr) => <option key={yr} value={yr}>{yr}</option>)}
          </select>
          {errors.btechYearOfPassing && <p className="mt-1 text-xs text-red-600">{errors.btechYearOfPassing}</p>}
        </div>

        {/* ========================================================================= */}
        {/* 2. THEN: INTERMEDIATE / DIPLOMA                                        */}
        {/* ========================================================================= */}
        <div className="pt-2 border-t border-gray-100 space-y-6">
          <div id="intermediateOrDiploma">
            <span className="block text-sm font-medium text-gray-700 mb-2">
              Intermediate / Diploma <span className="text-red-500">*</span>
            </span>
            <div className="flex flex-wrap items-center gap-6 pt-1">
              {(['Intermediate', 'Diploma'] as const).map((option) => (
                <label key={option} className="inline-flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="intermediateOrDiploma"
                    value={option}
                    checked={intermediateOrDiploma === option}
                    onChange={() => onChange('intermediateOrDiploma', option)}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
            {errors.intermediateOrDiploma && <p className="mt-1.5 text-xs text-red-600">{errors.intermediateOrDiploma}</p>}
          </div>

          {intermediateOrDiploma === 'Intermediate' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="intermediateCgpa" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Intermediate CGPA (0–10) <span className="text-red-500">*</span>
                </label>
                <input id="intermediateCgpa" type="number" step="0.01" min="0" max="10" value={intermediateCgpa}
                  onChange={(e) => handleEducationCgpaChange('intermediateCgpa', 'intermediatePercentage', e.target.value)}
                  placeholder="e.g. 9.20" className={`w-full px-3.5 py-2.5 rounded-md border text-sm text-gray-900 bg-white focus:outline-none ${errors.intermediateCgpa ? 'border-red-400' : 'border-gray-300 focus:border-blue-600'}`} />
                {errors.intermediateCgpa ? <p className="mt-1 text-xs text-red-600">{errors.intermediateCgpa}</p> : <p className="mt-1 text-xs text-gray-400">Percentage is calculated automatically.</p>}
              </div>
              <div>
                <label htmlFor="intermediatePercentage" className="block text-sm font-medium text-gray-700 mb-1.5">Intermediate Percentage (%)</label>
                <input id="intermediatePercentage" type="number" value={intermediatePercentage} readOnly className="w-full px-3.5 py-2.5 rounded-md border border-blue-200 text-sm text-gray-900 bg-blue-50/30" />
              </div>
              <div>
                <label htmlFor="intermediateYearOfPassing" className="block text-sm font-medium text-gray-700 mb-1.5">Intermediate Year of Passing</label>
                <select id="intermediateYearOfPassing" value={intermediateYearOfPassing} onChange={(e) => onChange('intermediateYearOfPassing', e.target.value)} className="w-full px-3.5 py-2.5 rounded-md border border-gray-300 text-sm text-gray-900 bg-white focus:outline-none focus:border-blue-600">
                  <option value="">Select Year of Passing</option>{passingYears.map((yr) => <option key={yr} value={yr}>{yr}</option>)}
                </select>
                {errors.intermediateYearOfPassing && <p className="mt-1 text-xs text-red-600">{errors.intermediateYearOfPassing}</p>}
              </div>
            </div>
          )}

          {intermediateOrDiploma === 'Diploma' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="diplomaCgpa" className="block text-sm font-medium text-gray-700 mb-1.5">Diploma CGPA (0–10) <span className="text-red-500">*</span></label>
                <input id="diplomaCgpa" type="number" step="0.01" min="0" max="10" value={diplomaCgpa}
                  onChange={(e) => handleEducationCgpaChange('diplomaCgpa', 'diplomaPercentage', e.target.value)}
                  placeholder="e.g. 8.80" className={`w-full px-3.5 py-2.5 rounded-md border text-sm text-gray-900 bg-white focus:outline-none ${errors.diplomaCgpa ? 'border-red-400' : 'border-gray-300 focus:border-blue-600'}`} />
                {errors.diplomaCgpa ? <p className="mt-1 text-xs text-red-600">{errors.diplomaCgpa}</p> : <p className="mt-1 text-xs text-gray-400">Percentage is calculated automatically.</p>}
              </div>
              <div>
                <label htmlFor="diplomaPercentage" className="block text-sm font-medium text-gray-700 mb-1.5">Diploma Percentage (%)</label>
                <input id="diplomaPercentage" type="number" value={diplomaPercentage} readOnly className="w-full px-3.5 py-2.5 rounded-md border border-blue-200 text-sm text-gray-900 bg-blue-50/30" />
              </div>
              <div>
                <label htmlFor="intermediateYearOfPassing" className="block text-sm font-medium text-gray-700 mb-1.5">Diploma Year of Passing</label>
                <select id="intermediateYearOfPassing" value={intermediateYearOfPassing} onChange={(e) => onChange('intermediateYearOfPassing', e.target.value)} className="w-full px-3.5 py-2.5 rounded-md border border-gray-300 text-sm text-gray-900 bg-white focus:outline-none focus:border-blue-600">
                  <option value="">Select Year of Passing</option>{passingYears.map((yr) => <option key={yr} value={yr}>{yr}</option>)}
                </select>
                {errors.intermediateYearOfPassing && <p className="mt-1 text-xs text-red-600">{errors.intermediateYearOfPassing}</p>}
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 3. LAST: 10TH                                                            */}
        {/* ========================================================================= */}
        <div className="pt-2 border-t border-gray-100 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="tenthCgpa" className="block text-sm font-medium text-gray-700 mb-1.5">10th CGPA (0–10) <span className="text-red-500">*</span></label>
              <input id="tenthCgpa" type="number" step="0.01" min="0" max="10" value={tenthCgpa}
                onChange={(e) => handleEducationCgpaChange('tenthCgpa', 'tenthPercentage', e.target.value)}
                placeholder="e.g. 9.50" className={`w-full px-3.5 py-2.5 rounded-md border text-sm text-gray-900 bg-white focus:outline-none ${errors.tenthCgpa ? 'border-red-400' : 'border-gray-300 focus:border-blue-600'}`} />
              {errors.tenthCgpa ? <p className="mt-1 text-xs text-red-600">{errors.tenthCgpa}</p> : <p className="mt-1 text-xs text-gray-400">Percentage is calculated automatically.</p>}
            </div>
            <div>
              <label htmlFor="tenthPercentage" className="block text-sm font-medium text-gray-700 mb-1.5">10th Percentage (%)</label>
              <input id="tenthPercentage" type="number" value={tenthPercentage} readOnly className="w-full px-3.5 py-2.5 rounded-md border border-blue-200 text-sm text-gray-900 bg-blue-50/30" />
            </div>
            <div>
              <label htmlFor="tenthYearOfPassing" className="block text-sm font-medium text-gray-700 mb-1.5">10th Year of Passing</label>
              <select id="tenthYearOfPassing" value={tenthYearOfPassing} onChange={(e) => onChange('tenthYearOfPassing', e.target.value)} className="w-full px-3.5 py-2.5 rounded-md border border-gray-300 text-sm text-gray-900 bg-white focus:outline-none focus:border-blue-600">
                <option value="">Select Year of Passing</option>{passingYears.map((yr) => <option key={yr} value={yr}>{yr}</option>)}
              </select>
              {errors.tenthYearOfPassing && <p className="mt-1 text-xs text-red-600">{errors.tenthYearOfPassing}</p>}
            </div>
          </div>
        </div>

        {/* CRT Registration */}
        <div className="pt-2 border-t border-gray-100">
          <span className="block text-sm font-medium text-gray-700 mb-2">CRT Registration <span className="text-red-500">*</span></span>
          <div className="flex flex-wrap gap-6">
            {(['Registered', 'Not Registered'] as const).map((option) => (
              <label key={option} className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="radio" name="crtRegistration" value={option} checked={crtRegistration === option}
                  onChange={(e) => onChange('crtRegistration', e.target.value)} className="w-4 h-4 text-blue-600" />
                <span>{option}</span>
              </label>
            ))}
          </div>
          {errors.crtRegistration && <p className="mt-1.5 text-xs text-red-600">{errors.crtRegistration}</p>}
        </div>

        {/* ========================================================================= */}
      </div>
    </div>
  );
};
