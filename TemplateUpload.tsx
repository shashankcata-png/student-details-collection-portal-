import React, { useState } from 'react';
import { PROFILE_FIELDS, suggestSource, templateErrors, type CustomTemplate, type TemplateColumn } from '../lib/custom-tpo';
const input = 'border border-gray-300 rounded p-2 text-sm bg-white w-full';
export function TemplateUpload({ value, onChange }: { value: CustomTemplate | null; onChange: (value: CustomTemplate | null) => void }) {
  const [sheets, setSheets] = useState<Record<string, string[][]>>({});
  const [sheetName, setSheetName] = useState(''), [filename, setFilename] = useState('');
  const [headerRow, setHeaderRow] = useState(1), [error, setError] = useState(''), [loading, setLoading] = useState(false);
  function selectHeader(name: string, row: number, source = sheets, file = filename) {
    setSheetName(name); setHeaderRow(row);
    const rows = source[name], headers = rows?.[row - 1];
    if (!headers?.some(h => h.trim())) { onChange(null); setError('Choose a row containing column headings.'); return; }
    const columns: TemplateColumn[] = headers.map((header, i) => ({ header, source: suggestSource(header), label: header || `Column ${i + 1}`, type: 'text', required: !!header.trim(), options: [] }));
    onChange({ version: 1, filename: file, sheetName: name, headerRow: row, preamble: Array.from({ length: row - 1 }, (_, i) => rows[i] || []), columns }); setError('');
  }
  function update(i: number, patch: Partial<TemplateColumn>) { if (value) onChange({ ...value, columns: value.columns.map((c, n) => n === i ? { ...c, ...patch } : c) }); }
  return <div className="sm:col-span-2 space-y-3 rounded border p-3">
    <p className="text-sm">Upload a blank employer template (.xls or .xlsx, up to 1 MB). Choose its sheet and heading row, then review every mapping. Text above the heading and column order are retained; sample rows, styling, merged cells, formulas and macros are not included. Custom exports download as .xlsx.</p>
    <label className="block text-sm">Employer Excel template<input className={input} type="file" accept=".xls,.xlsx" disabled={loading} onChange={async e => {
      const file = e.target.files?.[0]; onChange(null); setSheets({}); setError('');
      if (!file) return;
      if (!/\.(xls|xlsx)$/i.test(file.name) || file.size > 1024 * 1024) { setError('Choose an .xls or .xlsx file no larger than 1 MB.'); return; }
      setLoading(true);
      try {
        const XLSX = await import('xlsx');
        const book = XLSX.read(await file.arrayBuffer(), { type: 'array', sheetRows: 30, cellFormula: false, cellHTML: false, bookVBA: false });
        const parsed: Record<string, string[][]> = Object.create(null);
        for (const name of book.SheetNames) {
          const sheet = book.Sheets[name];
          const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
          if (range.e.c >= 50) throw new Error('Templates support at most 50 columns. Remove unused columns and upload again.');
          parsed[name] = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '', blankrows: true, range: { s: { r: 0, c: 0 }, e: { r: Math.min(range.e.r, 29), c: range.e.c } } }).map(r => r.map(v => String(v)));
        }
        const name = book.SheetNames[0]; if (!name) throw new Error('The workbook has no sheets.');
        setSheets(parsed); setFilename(file.name.slice(0, 160));
        const suggested = parsed[name].reduce((best, row, i, rows) => row.filter(Boolean).length > rows[best].filter(Boolean).length ? i : best, 0) + 1;
        selectHeader(name, suggested, parsed, file.name.slice(0, 160));
      } catch (e: any) { setError(e.message || 'Unable to read this workbook. Save it as .xlsx and retry.'); } finally { setLoading(false); }
    }} /></label>
    {loading && <p role="status">Reading template…</p>}{error && <p role="alert" className="text-red-700">{error}</p>}
    {!!Object.keys(sheets).length && <div className="grid sm:grid-cols-2 gap-3"><label>Worksheet<select className={input} value={sheetName} onChange={e => selectHeader(e.target.value, 1)}>{Object.keys(sheets).map(s => <option key={s}>{s}</option>)}</select></label><label>Heading row<select className={input} value={headerRow} onChange={e => selectHeader(sheetName, Number(e.target.value))}>{sheets[sheetName]?.map((r, i) => <option key={i} value={i + 1}>Row {i + 1}: {r.filter(Boolean).join(' | ').slice(0, 100)}</option>)}</select></label></div>}
    {value && <>
      <p className="text-sm font-medium">{value.columns.length} columns · New questions appear only in this opportunity. Give repeated headings distinct question labels.</p>
      {value.preamble.length > 0 && <details><summary className="text-sm">Preview text above headings (visible to students)</summary><pre className="whitespace-pre-wrap text-xs">{value.preamble.map(r => r.join(' | ')).join('\n')}</pre></details>}
      {value.columns.map((c, i) => <div className="grid sm:grid-cols-2 gap-2 border-t pt-3" key={i}>
        <label className="text-sm">Column {i + 1}: {c.header || '(blank)'}<select aria-label={`Column ${i + 1} mapping`} className={input} value={c.source} onChange={e => update(i, { source: e.target.value })}><option value="question">Ask student a new question</option><option value="serial">Automatic serial number</option><option value="blank">Leave blank</option>{Object.entries(PROFILE_FIELDS).map(([key, label]) => <option key={key} value={key}>Saved profile: {label}</option>)}</select></label>
        {c.source === 'question' && <><label className="text-sm">Question label<input className={input} required maxLength={160} value={c.label} onChange={e => update(i, { label: e.target.value })} /></label><label className="text-sm">Answer type<select className={input} value={c.type} onChange={e => update(i, { type: e.target.value as TemplateColumn['type'] })}><option value="text">Text</option><option value="number">Number</option><option value="date">Date</option><option value="choice">Choose from a list</option><option value="multi">Multiple checkboxes</option></select></label>{(c.type === 'choice' || c.type === 'multi') && <label className="text-sm">Choices (one per line)<textarea className={input} value={c.options.join('\n')} onChange={e => update(i, { options: e.target.value.split('\n') })} /></label>}</>}
        {!['blank', 'serial'].includes(c.source) && <label className="text-sm flex gap-2 items-center"><input type="checkbox" checked={c.required} onChange={e => update(i, { required: e.target.checked })} />Required</label>}
      </div>)}
      {templateErrors(value).map((e, i) => <p className="text-red-700 text-sm" key={i}>{e}</p>)}
    </>}
  </div>;
}
