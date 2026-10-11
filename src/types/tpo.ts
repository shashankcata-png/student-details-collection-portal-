import type { CustomTemplate } from '../lib/custom-tpo.js';
export type TpoTemplate = 'SE' | 'AE_ABA';
export type ApplicationStatus = 'Submitted' | 'Needs Correction' | 'Verified';
export interface TpoOpportunity {
  id: string;
  title: string;
  template: TpoTemplate;
  deadline: string;
  is_open: boolean;
  gap_before_label: string;
  gap_during_label: string;
  diploma_allowed: boolean;
  custom_template?: CustomTemplate | null;
}
export interface TpoDetails {
  customAnswers?: Record<string, string>;
  tenthBoard: string;
  intermediateBoard: string;
  degree: string;
  gapBefore: string;
  gapDuring: string;
  role: '' | 'AE' | 'ABA' | 'Both';
  certifications: string;
  hasOffer: '' | 'Yes' | 'No';
  offerDetails: string;
}
export const EMPTY_TPO_DETAILS: TpoDetails = {
  tenthBoard: '', intermediateBoard: '', degree: 'B.Tech', gapBefore: '',
  gapDuring: '', role: '', certifications: '', hasOffer: '', offerDetails: '',
};
// Explicit allowlist: government identifiers are never copied into applications.
export interface TpoSnapshot {
  college: string; name: string; rollNumber: string; gender: string;
  dob: string; phone: string; email: string; tenthPercentage: number | null;
  intermediatePercentage: number | null; educationRoute: string;
  graduationPercentage: number | null; branch: string; yop: string;
  activeBacklogs: number | null;
}
export interface TpoApplication {
  id: string; opportunity_id: string; student_id: string;
  snapshot: TpoSnapshot; details: TpoDetails; status: ApplicationStatus;
  correction_note: string; version: number; updated_at: string;
}
