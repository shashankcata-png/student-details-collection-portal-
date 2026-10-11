import * as XLSX from 'xlsx';
import { getTpoStore, TpoStore } from '../server/tpo-store.js';
import { verifyFacultyToken, getDepartmentAliases, DEPARTMENTS } from '../server/faculty.js';
import { validateVerificationToken } from '../server/otp.js';
import { tpoErrors } from '../src/lib/tpo.js';
import { tpoWorkbook } from '../server/tpo-export.js';
import type { TpoDetails, TpoTemplate } from '../src/types/tpo.js';

const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
const text = (v: unknown, max: number) => typeof v === 'string' ? v.trim().slice(0, max + 1) : '';
const bearer = (req: any) => typeof req.headers?.authorization === 'string' ? req.headers.authorization.replace(/^Bearer /, '') : '';
const validVersion = (v: unknown) => Number.isInteger(v) && Number(v) >= 0;

export function createTpoHandler(deps: { store: () => TpoStore; verifyEmail: typeof validateVerificationToken; verifyFaculty: typeof verifyFacultyToken }) {
  return async (req: any, res: any) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'POST', 'PATCH'].includes(req.method)) return res.status(405).json({ success: false, message: 'Method not allowed.' });
    try {
      const body = req.body || {};
      const action = req.method === 'GET' ? req.query?.action : body.action;
      if (action === 'opportunities' && req.method === 'GET') {
        const opportunities = await deps.store().opportunities();
        return res.json({ success: true, opportunities });
      }
      if (['lookup', 'submit'].includes(action) && req.method === 'POST') {
        const email = text(body.email, 254).toLowerCase(), roll = text(body.rollNumber, 30).toUpperCase();
        if (!uuid(body.opportunityId) || !/^[A-Z0-9]{1,30}$/.test(roll)) return res.status(400).json({ success: false, message: 'Select an opportunity and enter your roll number.' });
        if (!(await deps.verifyEmail(email, bearer(req)))) return res.status(401).json({ success: false, message: 'Verify your registered email to continue.' });
        const store = deps.store();
        const student = await store.student(roll, email), opportunity = await store.opportunity(body.opportunityId);
        if (!student) return res.status(404).json({ success: false, message: 'No student profile matches this roll number and verified email. Contact faculty.' });
        if (!opportunity) return res.status(404).json({ success: false, message: 'Opportunity not found.' });
        const application = await store.application(opportunity.id, student.id);
        if (action === 'lookup') return res.json({ success: true, snapshot: student.snapshot, application: application || null });
        const raw = body.details || {};
        const details: TpoDetails = {
          tenthBoard: text(raw.tenthBoard, 120), intermediateBoard: text(raw.intermediateBoard, 120), degree: text(raw.degree, 80),
          gapBefore: text(raw.gapBefore, 2), gapDuring: text(raw.gapDuring, 2), role: opportunity.template === 'SE' ? '' : raw.role,
          certifications: text(raw.certifications, 2000), hasOffer: raw.hasOffer,
          offerDetails: raw.hasOffer === 'No' ? '' : text(raw.offerDetails, 1000),
        };
        const errors = tpoErrors(details, student.snapshot, opportunity);
        if (!validVersion(body.version)) errors.push('Reload the application before submitting.');
        if (errors.length) return res.status(400).json({ success: false, message: errors.join(' '), errors });
        const saved = await store.submit(opportunity.id, student.id, student.snapshot, details, body.version);
        if (!saved) return res.status(409).json({ success: false, message: 'The opportunity closed or the application changed. Reload to check its status.' });
        return res.status(201).json({ success: true, application: saved });
      }
      const session = deps.verifyFaculty(bearer(req));
      if (!session || !DEPARTMENTS[session.dept]) return res.status(401).json({ success: false, message: 'Faculty sign-in required.' });
      const branches = session.dept === 'ALL' ? null : getDepartmentAliases(session.dept);
      const store = deps.store();
      if (action === 'create' && req.method === 'POST') {
        if (session.dept !== 'ALL') return res.status(403).json({ success: false, message: 'Only the administrator can create opportunities.' });
        const title = text(body.title, 160), gapBefore = text(body.gapBeforeLabel, 120), gapDuring = text(body.gapDuringLabel, 120);
        if (!title || title.length > 160 || !gapBefore || gapBefore.length > 120 || !gapDuring || gapDuring.length > 120 ||
            !['SE', 'AE_ABA'].includes(body.template) || !Number.isFinite(Date.parse(body.deadline)) || Date.parse(body.deadline) <= Date.now()) {
          return res.status(400).json({ success: false, message: 'Enter a title, template, future deadline and definitions for both education gaps.' });
        }
        const opportunity = await store.createOpportunity({ title, template: body.template as TpoTemplate, deadline: new Date(body.deadline).toISOString(),
          gap_before_label: gapBefore, gap_during_label: gapDuring, diploma_allowed: body.diplomaAllowed === true });
        return res.status(201).json({ success: true, opportunity });
      }
      if (action === 'review' && req.method === 'PATCH') {
        if (!uuid(body.id) || !validVersion(body.version) || !['Verified', 'Needs Correction'].includes(body.status)) return res.status(400).json({ success: false, message: 'Invalid review.' });
        const note = text(body.note, 1000);
        if (note.length > 1000 || (body.status === 'Needs Correction' && !note)) return res.status(400).json({ success: false, message: 'Provide a correction note (maximum 1000 characters).' });
        const saved = await store.review(body.id, body.version, body.status, body.status === 'Verified' ? '' : note, session.dept, branches);
        if (!saved) return res.status(409).json({ success: false, message: 'Application changed or is outside your department. Reload and try again.' });
        return res.json({ success: true, application: saved });
      }
      if (['applications', 'export'].includes(action) && req.method === 'GET') {
        if (!uuid(req.query.opportunityId)) return res.status(400).json({ success: false, message: 'Select an opportunity.' });
        const opportunity = await store.opportunity(req.query.opportunityId);
        if (!opportunity) return res.status(404).json({ success: false, message: 'Opportunity not found.' });
        let applications = await store.applications(opportunity.id, branches);
        for (const [queryKey, key] of [['branch', 'branch'], ['yop', 'yop']] as const) {
          if (typeof req.query[queryKey] === 'string' && req.query[queryKey]) applications = applications.filter(a => a.snapshot[key] === req.query[queryKey]);
        }
        if (action === 'applications') return res.json({ success: true, applications });
        applications = applications.filter(a => a.status === 'Verified');
        if (!applications.length) return res.status(400).json({ success: false, message: 'No verified applications match these filters.' });
        if (applications.some(a => tpoErrors(a.details, a.snapshot, opportunity).length)) return res.status(400).json({ success: false, message: 'Some applications have missing data. Return them for correction before exporting.' });
        const buffer = XLSX.write(tpoWorkbook(applications, opportunity), { type: 'buffer', bookType: 'biff8' });
        res.setHeader('Content-Type', 'application/vnd.ms-excel');
        res.setHeader('Content-Disposition', `attachment; filename="TPO_${opportunity.template}.xls"`);
        return res.send(buffer);
      }
      return res.status(400).json({ success: false, message: 'Unknown action.' });
    } catch (error: any) {
      console.error('TPO request failed:', error?.code || error?.name);
      return res.status(503).json({ success: false, message: 'TPO service is unavailable. Please try again later or contact faculty.' });
    }
  };
}
export default createTpoHandler({ store: getTpoStore, verifyEmail: validateVerificationToken, verifyFaculty: verifyFacultyToken });
