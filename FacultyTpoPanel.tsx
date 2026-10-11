import { TemplateUpload } from './TemplateUpload';
import { templateErrors, type CustomTemplate } from '../lib/custom-tpo';
import React, { useEffect, useState } from 'react';
import type { TpoApplication, TpoOpportunity } from '../types/tpo';
import { ApplicationSummary, tpoRequest } from './TpoPortal';
const input = 'border border-gray-300 rounded p-2 text-sm bg-white';
const button = 'bg-blue-700 text-white rounded px-3 py-2 text-sm disabled:opacity-50';

export function FacultyTpoPanel({ token, department }: { token: string; department: string }) {
  const [opportunities, setOpportunities] = useState<TpoOpportunity[]>([]), [selected, setSelected] = useState('');
  const [applications, setApplications] = useState<TpoApplication[]>([]), [opened, setOpened] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [note, setNote] = useState('');
  const [status, setStatus] = useState(''), [branch, setBranch] = useState(''), [yop, setYop] = useState('');
  const [customTemplate, setCustomTemplate] = useState<CustomTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingOpp, setEditingOpp] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [draft, setDraft] = useState({ title: '', template: 'SE', deadline: '', gapBeforeLabel: '', gapDuringLabel: '', diplomaAllowed: false });
  useEffect(() => { tpoRequest('managedOpportunities', token).then(d => setOpportunities(d.opportunities)).catch(e => setError(e.message)); }, [token]);
  async function run(fn: () => Promise<void>) { setBusy(true); setError(''); try { await fn(); } catch (e: any) { setError(e.message); } finally { setBusy(false); } }
  async function load(id = selected) {
    const r = await fetch(`/api/tpo?action=applications&opportunityId=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json(); if (!r.ok) throw new Error(d.message); setApplications(d.applications); setOpened(null);
  }
  const matching = applications.filter(a => (!branch || a.snapshot.branch === branch) && (!yop || a.snapshot.yop === yop));
  const shown = matching.filter(a => !status || a.status === status);
  const verified = matching.filter(a => a.status === 'Verified').length;
  return <section className="my-6 bg-white border rounded-lg p-5 space-y-4">
    <div className="flex flex-wrap justify-between gap-3"><h2 className="text-xl font-bold">TPO Applications & Exports</h2>{department === 'ALL' && <button className={button} onClick={() => setCreating(!creating)}>Create opportunity</button>}</div>
    {error && <p role="alert" className="bg-red-50 text-red-800 p-3 rounded">{error}</p>}
    {creating && <form className="border rounded p-4 space-y-3" onSubmit={e => { e.preventDefault(); run(async () => {
      if (draft.template === 'CUSTOM') { const errors = templateErrors(customTemplate); if (errors.length) throw new Error(errors.join(' ')); }
      const d = await tpoRequest('create', token, { ...draft, template: draft.template === 'CUSTOM' ? 'SE' : draft.template, customTemplate: draft.template === 'CUSTOM' ? customTemplate : null, deadline: new Date(draft.deadline).toISOString() });
      setOpportunities([d.opportunity, ...opportunities]); setSelected(d.opportunity.id); setApplications([]); setCreating(false);
    }); }}>
      <p className="text-sm text-gray-600">Choose a built-in format or upload this employer's Excel template. Opening an opportunity makes it visible to students. Normal student exports remain unchanged.</p>
      <fieldset disabled={busy} className="grid sm:grid-cols-2 gap-3">
        <label className="text-sm">Opportunity title<input className={`${input} w-full`} required maxLength={160} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
        <label className="text-sm">Template<select className={`${input} w-full`} value={draft.template} onChange={e => setDraft({ ...draft, template: e.target.value })}><option value="SE">SE</option><option value="AE_ABA">AE / ABA</option><option value="CUSTOM">Upload employer template</option></select></label>
        <label className="text-sm">Deadline (your local time)<input type="datetime-local" required className={`${input} w-full`} value={draft.deadline} onChange={e => setDraft({ ...draft, deadline: e.target.value })} /></label>
        {draft.template === 'CUSTOM' ? <TemplateUpload value={customTemplate} onChange={setCustomTemplate} /> : <>
        <label className="text-sm">First gap definition<input required maxLength={120} className={`${input} w-full`} value={draft.gapBeforeLabel} onChange={e => setDraft({ ...draft, gapBeforeLabel: e.target.value })} /></label>
        <label className="text-sm">Second gap definition<input required maxLength={120} className={`${input} w-full`} value={draft.gapDuringLabel} onChange={e => setDraft({ ...draft, gapDuringLabel: e.target.value })} /></label>
        <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={draft.diplomaAllowed} onChange={e => setDraft({ ...draft, diplomaAllowed: e.target.checked })} />Employer accepts Diploma in the 12th column</label></>}
        <button className={button}>Open opportunity</button>
      </fieldset>
    </form>}
    <div className="flex flex-wrap gap-3"><label className="text-sm">Opportunity<select className={`${input} block`} disabled={busy} value={selected} onChange={e => { setSelected(e.target.value); setApplications([]); setBranch(''); setYop(''); setStatus(''); if (e.target.value) run(() => load(e.target.value)); }}><option value="">Select opportunity</option>{opportunities.map(o => <option key={o.id} value={o.id}>{o.title} ({o.custom_template ? 'Custom' : o.template}){o.archived_at ? ' — Deleted' : ''}</option>)}</select></label>
      <label className="text-sm">Status<select className={`${input} block`} value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{['Submitted', 'Needs Correction', 'Verified'].map(s => <option key={s}>{s}</option>)}</select></label>
      <label className="text-sm">Branch<select className={`${input} block`} value={branch} onChange={e => setBranch(e.target.value)}><option value="">All permitted branches</option>{[...new Set(applications.map(a => a.snapshot.branch))].sort().map(s => <option key={s}>{s}</option>)}</select></label>
      <label className="text-sm">Graduation year<select className={`${input} block`} value={yop} onChange={e => setYop(e.target.value)}><option value="">All years</option>{[...new Set(applications.map(a => a.snapshot.yop).filter(Boolean))].sort().map(s => <option key={s}>{s}</option>)}</select></label>
    </div>
    {selected && department === 'ALL' && <div className="rounded border p-3 text-sm space-y-2">
      <p>{opportunities.find(o => o.id === selected)?.archived_at ? 'Deleted: hidden from students. Saved applications remain available below. Restore makes it visible again; the original deadline still applies.' : 'Delete hides this opportunity from students and stops new submissions. Saved applications and exports are retained.'}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} className={button} onClick={() => run(async () => {
          const archived = !!opportunities.find(o => o.id === selected)?.archived_at;
          if (!window.confirm(archived ? 'Restore this opportunity to the student list?' : 'Delete this opportunity from the student list? Existing applications will be retained.')) return;
          const d = await tpoRequest(archived ? 'restore' : 'archive', token, { id: selected }, 'PATCH');
          setOpportunities(prev => prev.map(o => o.id === selected ? d.opportunity : o));
        })}>{opportunities.find(o => o.id === selected)?.archived_at ? 'Restore opportunity' : 'Delete opportunity'}</button>
        <button type="button" disabled={busy} className="bg-gray-700 text-white rounded px-3 py-2 text-sm disabled:opacity-50" onClick={() => {
          const opp = opportunities.find(o => o.id === selected);
          if (opp) {
            setEditTitle(opp.title);
            try {
              const dt = new Date(opp.deadline);
              const localIso = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
              setEditDeadline(localIso);
            } catch { setEditDeadline(''); }
            setEditingOpp(!editingOpp);
          }
        }}>{editingOpp ? 'Cancel edit' : 'Edit details / deadline'}</button>
      </div>
      {editingOpp && <form className="border-t pt-3 mt-2 space-y-2" onSubmit={e => { e.preventDefault(); run(async () => {
        const d = await tpoRequest('edit', token, { id: selected, title: editTitle, deadline: new Date(editDeadline).toISOString() }, 'PATCH');
        setOpportunities(prev => prev.map(o => o.id === selected ? d.opportunity : o));
        setEditingOpp(false);
      }); }}>
        <div className="grid sm:grid-cols-2 gap-2">
          <label className="text-xs font-medium">Title<input className={`${input} w-full`} required maxLength={160} value={editTitle} onChange={e => setEditTitle(e.target.value)} /></label>
          <label className="text-xs font-medium">Deadline<input type="datetime-local" required className={`${input} w-full`} value={editDeadline} onChange={e => setEditDeadline(e.target.value)} /></label>
        </div>
        <button className={button} disabled={busy}>Save changes</button>
      </form>}
    </div>}
    {selected && <><p className="text-sm">{matching.length} applications · {verified} verified and ready for export. Downloads include verified applications matching branch and year, regardless of the status view.</p>
      <div className="flex gap-3"><button disabled={busy} className={button} onClick={() => run(() => load())}>Refresh</button><button disabled={busy || !verified} className={button} onClick={() => run(async () => {
        const params = new URLSearchParams({ action: 'export', opportunityId: selected, branch, yop });
        const r = await fetch(`/api/tpo?${params}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) throw new Error((await r.json()).message);
        const url = URL.createObjectURL(await r.blob()), a = document.createElement('a');
        a.href = url; a.download = opportunities.find(o => o.id === selected)?.custom_template ? 'TPO_Custom.xlsx' : `TPO_${opportunities.find(o => o.id === selected)?.template}.xls`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      })}>Download {opportunities.find(o => o.id === selected)?.custom_template ? 'opportunity' : opportunities.find(o => o.id === selected)?.template === 'SE' ? 'SE' : 'AE / ABA'} sheet ({verified})</button></div>
      {!shown.length && <p className="text-gray-500 text-sm">No applications match this view.</p>}
      <div className="space-y-3">{shown.map(a => <article className="border rounded p-3" key={a.id}>
        <button className="w-full flex flex-wrap justify-between gap-2 text-left" onClick={() => { setOpened(opened === a.id ? null : a.id); setNote(a.correction_note); }}><span className="font-medium">{a.snapshot.rollNumber} · {a.snapshot.name}</span><span className="text-sm text-blue-800">{a.status} — Review</span></button>
        {opened === a.id && <div className="mt-4 space-y-4"><ApplicationSummary snapshot={a.snapshot} /><dl className="grid sm:grid-cols-2 gap-3 text-sm">{(opportunities.find(o => o.id === selected)?.custom_template ? opportunities.find(o => o.id === selected)!.custom_template!.columns.flatMap((c, i) => c.source === 'question' ? [[c.label, a.details.customAnswers?.[`c${i}`] || '—']] : []) : [
          ['10th board', a.details.tenthBoard], ['12th / Diploma board', a.details.intermediateBoard], ['Degree', a.details.degree],
          [opportunities.find(o => o.id === selected)?.gap_before_label || 'First gap', a.details.gapBefore], [opportunities.find(o => o.id === selected)?.gap_during_label || 'Second gap', a.details.gapDuring],
          ['Role', a.details.role || 'SE'], ['Certifications', a.details.certifications], ['Offer', a.details.hasOffer === 'Yes' ? a.details.offerDetails : 'No'],
        ]).map(([k, v], i) => <div key={i}><dt className="text-gray-500">{k}</dt><dd className="whitespace-pre-wrap break-words">{v}</dd></div>)}</dl>
          <label className="block text-sm">Correction note<textarea className={`${input} w-full`} value={note} maxLength={1000} onChange={e => setNote(e.target.value)} /></label>
          <div className="flex gap-3">{['Verified', 'Needs Correction'].map(next => <button key={next} disabled={busy || (next === 'Needs Correction' && !note.trim())} className={button} onClick={() => run(async () => {
            const d = await tpoRequest('review', token, { id: a.id, version: a.version, status: next, note }, 'PATCH'); setApplications(prev => prev.map(row => row.id === a.id ? d.application : row)); setOpened(null);
          })}>{next === 'Verified' ? 'Mark verified' : 'Request correction'}</button>)}</div>
        </div>}
      </article>)}</div>
    </>}
  </section>;
}
