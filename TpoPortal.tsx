import React, { useEffect, useState } from 'react';
import type { TpoApplication, TpoDetails, TpoOpportunity, TpoSnapshot } from '../types/tpo';
import { EMPTY_TPO_DETAILS } from '../types/tpo';
import { tpoErrors } from '../lib/tpo';
import { isTenthBoardQuestion, isDegreeQuestion, isRoleQuestion, roleOptions } from '../lib/custom-tpo';

const inputClass = 'w-full border border-gray-300 rounded-md p-2.5 text-sm bg-white';
const buttonClass = 'rounded-md bg-blue-700 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50';
export async function tpoRequest(action: string, token = '', body?: Record<string, unknown>, method = 'POST') {
  const response = await fetch(body ? '/api/tpo' : `/api/tpo?action=${action}`, {
    method: body ? method : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify({ ...body, action }) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Request failed. Please retry.');
  return data;
}
export function ApplicationSummary({ snapshot }: { snapshot: TpoSnapshot }) {
  const fields = [
    ['Name', snapshot.name], ['Roll number', snapshot.rollNumber], ['College', snapshot.college],
    ['Branch', snapshot.branch], ['Gender', snapshot.gender], ['Date of birth', snapshot.dob],
    ['Email', snapshot.email], ['Phone', snapshot.phone], ['Education route', snapshot.educationRoute],
    ['10th %', snapshot.tenthPercentage], ['12th / Diploma %', snapshot.intermediatePercentage],
    ['Graduation %', snapshot.graduationPercentage], ['Graduation year', snapshot.yop], ['Backlogs', snapshot.activeBacklogs],
  ];
  return <dl className="grid sm:grid-cols-2 gap-3 rounded-lg bg-slate-50 p-4 text-sm">{fields.map(([label, value]) => <div key={String(label)}><dt className="text-gray-500">{label}</dt><dd className="font-medium break-words">{value ?? 'Missing'}</dd></div>)}</dl>;
}

export function TpoPortal({ onBack }: { onBack: () => void }) {
  const [opportunities, setOpportunities] = useState<TpoOpportunity[]>([]);
  const [opportunityId, setOpportunityId] = useState('');
  const [email, setEmail] = useState(''), [roll, setRoll] = useState(''), [otp, setOtp] = useState('');
  const [token, setToken] = useState(''), [sent, setSent] = useState(false), [cooldown, setCooldown] = useState(0);
  const [snapshot, setSnapshot] = useState<TpoSnapshot | null>(null);
  const [application, setApplication] = useState<TpoApplication | null>(null);
  const [details, setDetails] = useState<TpoDetails>({ ...EMPTY_TPO_DETAILS });
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const opportunity = opportunities.find(o => o.id === opportunityId);
  useEffect(() => { tpoRequest('opportunities').then(d => setOpportunities(d.opportunities)).catch(e => setError(e.message)); }, []);
  useEffect(() => { if (cooldown <= 0) return; const timer = setTimeout(() => setCooldown(cooldown - 1), 1000); return () => clearTimeout(timer); }, [cooldown]);
  function clearProfile() { setSnapshot(null); setApplication(null); setDetails({ ...EMPTY_TPO_DETAILS }); setConfirmed(false); setMessage(''); }
  async function run(fn: () => Promise<void>) { setBusy(true); setError(''); setMessage(''); try { await fn(); } catch (e: any) { setError(e.message); } finally { setBusy(false); } }
  async function sendCode() {
    const r = await fetch('/api/otp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    const d = await r.json(); if (!r.ok) throw new Error(d.message); setSent(true); setCooldown(d.cooldownSeconds || 60); setMessage('Check your email for the verification code.');
  }
  async function verifyCode() {
    const r = await fetch('/api/otp/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, otp }) });
    const d = await r.json(); if (!r.ok || !d.verificationToken) throw new Error(d.message || 'Verification failed.'); setToken(d.verificationToken); setOtp(''); setMessage('Email verified. Load your profile below.');
  }
  async function lookup() {
    const d = await tpoRequest('lookup', token, { opportunityId, email, rollNumber: roll });
    setSnapshot(d.snapshot); setApplication(d.application); setDetails(() => { const base = d.application?.details || { ...EMPTY_TPO_DETAILS }; const answers = { ...base.customAnswers }; const opportunity = opportunities.find(o => o.id === opportunityId); opportunity?.custom_template?.columns.forEach((c, i) => { if (c.source === 'question' && isDegreeQuestion(c.label) && !answers[`c${i}`]) answers[`c${i}`] = 'B.Tech-UG'; }); return { ...base, customAnswers: answers }; }); setConfirmed(false);
  }
  const locked = !!application && application.status !== 'Needs Correction';
  const closed = !opportunity?.is_open || new Date(opportunity.deadline).getTime() <= Date.now();
  const field = (key: keyof TpoDetails, label: string, type = 'text') => <label className="block text-sm font-medium" key={key}>{label}<input className={`${inputClass} mt-1`} type={type} min={type === 'number' ? 0 : undefined} max={type === 'number' ? 50 : undefined} step={type === 'number' ? 1 : undefined} required maxLength={120} value={String(details[key] ?? '')} onChange={e => { setDetails({ ...details, [key]: e.target.value }); setConfirmed(false); }} /></label>;
  return <section className="bg-white rounded-xl border p-5 sm:p-8 my-6 space-y-5">
    <div className="flex justify-between gap-3"><h1 className="text-2xl font-bold text-slate-900">TPO Applications</h1><button onClick={onBack} className="text-blue-700 text-sm">Back to registration</button></div>
    <p className="text-gray-600 text-sm">Already registered? Verify your saved email, review your profile and apply. New students should complete registration first.</p>
    {error && <p role="alert" className="bg-red-50 text-red-800 p-3 rounded">{error}</p>}
    {message && <p role="status" className="bg-blue-50 text-blue-900 p-3 rounded">{message}</p>}
    {!opportunities.length && !error && <p>No placement opportunities are currently listed.</p>}
    <fieldset disabled={busy} className="space-y-4">
      <label className="block text-sm font-medium">Opportunity<select className={`${inputClass} mt-1`} value={opportunityId} onChange={e => { setOpportunityId(e.target.value); clearProfile(); }}><option value="">Select opportunity</option>{opportunities.map(o => <option key={o.id} value={o.id}>{o.title} ({o.custom_template ? 'Custom' : o.template === 'SE' ? 'SE' : 'AE / ABA'})</option>)}</select></label>
      {opportunity && <p className="text-sm text-gray-600">Deadline: {new Date(opportunity.deadline).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST{closed ? ' — Closed for submissions' : ''}</p>}
      <div className="grid sm:grid-cols-2 gap-4"><label className="text-sm font-medium">Registered email<input type="email" className={`${inputClass} mt-1`} value={email} onChange={e => { setEmail(e.target.value); setToken(''); setSent(false); setOtp(''); clearProfile(); }} /></label><label className="text-sm font-medium">Roll number<input className={`${inputClass} mt-1`} value={roll} maxLength={30} onChange={e => { setRoll(e.target.value.toUpperCase()); clearProfile(); }} /></label></div>
      {!token && <div className="flex flex-wrap gap-3 items-end"><button className={buttonClass} disabled={!email || cooldown > 0} onClick={() => run(sendCode)}>{cooldown ? `Resend in ${cooldown}s` : 'Send email code'}</button>{sent && <><label className="text-sm">6-digit code<input className={inputClass} inputMode="numeric" autoComplete="one-time-code" value={otp} maxLength={6} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} /></label><button disabled={otp.length !== 6} className={buttonClass} onClick={() => run(verifyCode)}>Verify email</button></>}</div>}
      {token && <button className={buttonClass} disabled={!roll || !opportunityId} onClick={() => run(lookup)}>Load profile / Refresh status</button>}
    </fieldset>
    {snapshot && opportunity && <form className="space-y-5" onSubmit={e => { e.preventDefault(); run(async () => {
      const errors = tpoErrors(details, snapshot, opportunity); if (errors.length) throw new Error(errors.join(' '));
      if (!confirmed) throw new Error('Confirm your details before submitting.');
      const d = await tpoRequest('submit', token, { email, rollNumber: roll, opportunityId, details, version: application?.version || 0 });
      setApplication(d.application); setMessage('Application submitted. Faculty can now review it.');
    }); }}>
      <ApplicationSummary snapshot={locked && application ? application.snapshot : snapshot} />
      <p className="text-sm text-gray-600">If saved profile details are incorrect, ask faculty to correct them before applying.</p>
      {application && <div className="border rounded p-3"><strong>Status: {application.status}</strong>{application.correction_note && <p className="mt-2">Faculty note: {application.correction_note}</p>}</div>}
      <fieldset disabled={busy || locked || closed} className="space-y-4">
        {opportunity.custom_template ? <div className="grid sm:grid-cols-2 gap-4">{opportunity.custom_template.columns.map((c, i) => {
          if (c.source !== 'question') return null;
          const key = `c${i}`;
          const value = details.customAnswers?.[key] || '';
          const setAnswer = (next: string) => { setDetails(previous => ({ ...previous, customAnswers: { ...previous.customAnswers, [key]: next } })); setConfirmed(false); };
          const board = isTenthBoardQuestion(c.label);
          const degree = isDegreeQuestion(c.label);
          const roles = isRoleQuestion(c.label);
          const multiple = c.type === 'multi' || roles;
          const choices = roles ? roleOptions(c.label, c.options) : c.options;
          return <div className="block text-sm font-medium" key={i}><label htmlFor={`custom-${i}`}>{c.label}{c.required ? ' *' : ' (optional)'}</label>
            {board ? <select id={`custom-${i}`} className={inputClass} required={c.required} value={value} onChange={e => setAnswer(e.target.value)}><option value="">Select board</option><option value="CBSE">CBSE</option><option value="SSC">SSC</option>{value && !['CBSE', 'SSC'].includes(value) && <option value={value}>{value} (previous answer)</option>}</select>
            : degree ? <input id={`custom-${i}`} className={inputClass} value={value || 'B.Tech-UG'} readOnly aria-readonly="true" />
            : multiple ? <fieldset id={`custom-${i}`} className="border rounded p-3"><legend className="sr-only">{c.label}</legend>{choices.map(option => { const selected = value.split(',').map(x => x.trim()).filter(Boolean); return <label key={option} className="flex items-center gap-2 py-1"><input type="checkbox" checked={selected.includes(option)} onChange={e => setAnswer((e.target.checked ? [...selected, option] : selected.filter(x => x !== option)).join(', '))} />{option}</label>; })}</fieldset>
            : c.type === 'choice' ? <select id={`custom-${i}`} className={inputClass} required={c.required} value={value} onChange={e => setAnswer(e.target.value)}><option value="">Select</option>{c.options.map(o => <option key={o}>{o}</option>)}</select>
            : <input id={`custom-${i}`} className={inputClass} type={c.type === 'number' ? 'number' : c.type === 'date' ? 'date' : 'text'} step={c.type === 'number' ? 'any' : undefined} maxLength={2000} required={c.required} value={value} onChange={e => setAnswer(e.target.value)} />}
          </div>;
        })}</div> : <>
        <div className="grid sm:grid-cols-2 gap-4"><label className="block text-sm font-medium">10th board<select className={inputClass} required value={details.tenthBoard} onChange={e => { setDetails({ ...details, tenthBoard: e.target.value }); setConfirmed(false); }}><option value="">Select board</option><option>CBSE</option><option>SSC</option>{details.tenthBoard && !['CBSE', 'SSC'].includes(details.tenthBoard) && <option value={details.tenthBoard}>{details.tenthBoard} (previously saved)</option>}</select></label>{field('intermediateBoard', '12th / Diploma board')}{field('degree', 'Degree')}{field('gapBefore', `${opportunity.gap_before_label} (years)`, 'number')}{field('gapDuring', `${opportunity.gap_during_label} (years)`, 'number')}</div>
        {opportunity.template === 'AE_ABA' && <fieldset className="border rounded p-3"><legend className="text-sm font-medium">Roles — select one or both *</legend><div className="flex gap-5">{(['AE', 'ABA'] as const).map(role => <label key={role} className="flex gap-2 items-center"><input type="checkbox" checked={details.role === role || details.role === 'Both'} onChange={e => { const other = role === 'AE' ? 'ABA' : 'AE'; const otherSelected = details.role === other || details.role === 'Both'; setDetails({ ...details, role: e.target.checked ? (otherSelected ? 'Both' : role) : (otherSelected ? other : '') }); setConfirmed(false); }} />{role}</label>)}</div></fieldset>}
        <label className="block text-sm font-medium">{opportunity.template === 'SE' ? 'CS / IT certifications or courses' : 'Certifications'}<textarea className={inputClass} required maxLength={2000} rows={3} placeholder="Course, issuer and year; one per line. Enter None if applicable." value={details.certifications} onChange={e => setDetails({ ...details, certifications: e.target.value })} /></label>
        <label className="block text-sm font-medium">Offer in hand?<select className={inputClass} required value={details.hasOffer} onChange={e => setDetails({ ...details, hasOffer: e.target.value as TpoDetails['hasOffer'], offerDetails: '' })}><option value="">Select</option><option>Yes</option><option>No</option></select></label>
        {details.hasOffer === 'Yes' && <label className="block text-sm font-medium">Offer details<textarea className={inputClass} required maxLength={1000} value={details.offerDetails} onChange={e => setDetails({ ...details, offerDetails: e.target.value })} placeholder="Company and role" /></label>}
        </>}
        <label className="flex gap-2 text-sm"><input type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I have reviewed these details and confirm they are correct.</label>
        <button className={buttonClass} disabled={!confirmed}>{busy ? 'Saving…' : application ? 'Resubmit corrections' : 'Submit application'}</button>
      </fieldset>
    </form>}
  </section>;
}
