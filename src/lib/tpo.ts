import type { TpoDetails, TpoOpportunity, TpoSnapshot } from '../types/tpo.js';

export function tpoErrors(details: TpoDetails, snapshot: TpoSnapshot, opportunity: TpoOpportunity): string[] {
  const errors: string[] = [];
  for (const [value, label, max] of [
    [details.tenthBoard, '10th board', 120], [details.intermediateBoard, '12th / Diploma board', 120],
    [details.degree, 'Degree', 80],
  ] as const) {
    if (typeof value !== 'string' || !value.trim() || value.length > max) errors.push(`${label} is required (maximum ${max} characters).`);
  }
  for (const [value, label] of [[details.gapBefore, opportunity.gap_before_label], [details.gapDuring, opportunity.gap_during_label]]) {
    if (typeof value !== 'string' || !/^\d{1,2}$/.test(value) || Number(value) > 50) errors.push(`${label}: enter a whole number from 0 to 50.`);
  }
  if (opportunity.template === 'AE_ABA' && !['AE', 'ABA', 'Both'].includes(details.role)) errors.push('Select AE, ABA or Both.');
  if (typeof details.certifications !== 'string' || !details.certifications.trim() || details.certifications.length > 2000) errors.push('Enter certifications, or None (maximum 2000 characters).');
  if (!['Yes', 'No'].includes(details.hasOffer)) errors.push('Select whether you have an offer.');
  if (typeof details.offerDetails !== 'string' || details.offerDetails.length > 1000 || (details.hasOffer === 'Yes' && !details.offerDetails.trim())) errors.push('Enter offer details (maximum 1000 characters).');
  for (const [value, label] of [[snapshot.tenthPercentage, '10th'], [snapshot.intermediatePercentage, '12th / Diploma'], [snapshot.graduationPercentage, 'Graduation']] as const) {
    if (value === null || !Number.isFinite(value) || value < 0 || value > 100) errors.push(`${label} percentage is missing or invalid in your profile. Ask faculty to correct it.`);
  }
  if (snapshot.educationRoute === 'Diploma' && !opportunity.diploma_allowed) errors.push('This opportunity has not enabled Diploma in place of 12th. Contact faculty.');
  if (!['Intermediate', 'Diploma'].includes(snapshot.educationRoute)) errors.push('Your education route is missing. Ask faculty to correct it.');
  return errors;
}
