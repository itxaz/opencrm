import { useState } from 'react';
import { useApi } from '../hooks/useApi.js';
import { api } from '../lib/api.js';

const FIELDS = [
  { key: 'policyNumber', label: 'Policy Number', required: true },
  { key: 'commissionAmount', label: 'Commission Amount', required: true },
  { key: 'premiumAmount', label: 'Premium Amount', required: false },
  { key: 'commissionPct', label: 'Commission Rate', required: false },
  { key: 'isRenewal', label: 'New / Renewal Column', required: false },
];

const money = (v) => v == null ? '—' : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (v) => v == null ? '—' : `${(Number(v) * 100).toFixed(2)}%`;

export default function UploadsModule() {
  const { data: carriersData } = useApi('/appointments');
  const { data: batchesData, refetch: refetchBatches } = useApi('/imports');

  const [stage, setStage] = useState('upload'); // upload | map | done
  const [carrierId, setCarrierId] = useState('');
  const [fileName, setFileName] = useState('');
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState(null);     // { headers, suggestedMapping, sample, stats }
  const [mapping, setMapping] = useState({});
  const [statementDate, setStatementDate] = useState('');
  const [saveMappingName, setSaveMappingName] = useState('');
  const [autoReconcile, setAutoReconcile] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null);
  const [detail, setDetail] = useState(null);       // batch detail modal

  // appointments are { carrier_id, carrier_name, ... }
  const carriers = (carriersData?.appointments ?? []).filter(a => a.active);
  const batches = batchesData?.batches ?? [];

  const reset = () => {
    setStage('upload'); setFileName(''); setCsvText(''); setPreview(null);
    setMapping({}); setStatementDate(''); setSaveMappingName(''); setResult(null); setErr('');
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ''));
    reader.readAsText(file);
  };

  const runPreview = async () => {
    if (!carrierId) { setErr('Select a carrier'); return; }
    if (!csvText) { setErr('Choose a CSV file'); return; }
    setBusy(true); setErr('');
    try {
      const p = await api('/imports/preview', { method: 'POST', body: { csvText } });
      setPreview(p);
      setMapping(p.suggestedMapping ?? {});
      setStage('map');
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  // Re-normalize the sample client-side is overkill; re-call preview with the edited mapping.
  const refreshPreview = async (nextMapping) => {
    try {
      const p = await api('/imports/preview', { method: 'POST', body: { csvText, fieldMap: nextMapping } });
      setPreview(p);
    } catch { /* keep previous preview on error */ }
  };

  const setField = (key, header) => {
    const next = { ...mapping, [key]: header || undefined };
    setMapping(next);
    refreshPreview(next);
  };

  const commitImport = async () => {
    if (!mapping.commissionAmount) { setErr('Map the Commission Amount column'); return; }
    setBusy(true); setErr('');
    try {
      const r = await api('/imports', {
        method: 'POST',
        body: {
          carrierId, fileName, csvText, fieldMap: mapping,
          statementDate: statementDate || undefined,
          autoReconcile,
          saveMappingName: saveMappingName || undefined,
        },
      });
      setResult(r); setStage('done'); refetchBatches();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const openDetail = async (id) => {
    setDetail({ loading: true });
    try { setDetail(await api(`/imports/${id}`)); }
    catch (e) { setDetail({ error: e.message }); }
  };

  return (
    <div className="fade-in" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>Statement Upload</h2>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>
          Upload a carrier commission export (CSV), map its columns, and we'll reconcile it against your ledger.
        </p>
      </div>

      {/* Wizard */}
      <div className="card" style={{ padding: 24 }}>
        <Steps stage={stage}/>

        {stage === 'upload' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20, maxWidth: 520 }}>
            <div>
              <label style={lbl}>Carrier *</label>
              <select value={carrierId} onChange={e => setCarrierId(e.target.value)}>
                <option value="">Select an appointed carrier…</option>
                {carriers.map(a => <option key={a.carrier_id} value={a.carrier_id}>{a.carrier_name}</option>)}
              </select>
              {carriers.length === 0 && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>No active appointments — add one under Carriers first.</div>}
            </div>
            <div>
              <label style={lbl}>Commission Export File (.csv) *</label>
              <input type="file" accept=".csv,text/csv" onChange={onFile}/>
              {fileName && <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 6 }}>{fileName} · {csvText.length.toLocaleString()} chars</div>}
            </div>
            {err && <div style={errBox}>{err}</div>}
            <div>
              <button className="btn-primary" onClick={runPreview} disabled={busy}>{busy ? 'Parsing…' : 'Parse & Map →'}</button>
            </div>
          </div>
        )}

        {stage === 'map' && preview && (
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Stat label="Rows" value={preview.stats.total}/>
              <Stat label="Mappable" value={preview.stats.valid} color="var(--green)"/>
              <Stat label="Flagged" value={preview.stats.flagged} color={preview.stats.flagged ? 'var(--yellow)' : 'var(--text3)'}/>
              <Stat label="Confidence" value={`${Math.round(preview.stats.confidence * 100)}%`} color="var(--accent)"/>
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Column Mapping</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                {FIELDS.map(f => (
                  <div key={f.key}>
                    <label style={lbl}>{f.label}{f.required && ' *'}</label>
                    <select value={mapping[f.key] ?? ''} onChange={e => setField(f.key, e.target.value)}
                      style={f.required && !mapping[f.key] ? { borderColor: 'var(--red)' } : undefined}>
                      <option value="">— not mapped —</option>
                      {preview.headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Sample preview */}
            <div className="card" style={{ padding: 0 }}>
              <div style={{ overflowX: 'auto', maxHeight: 320 }}>
                <table>
                  <thead><tr><th></th><th>Policy</th><th>Premium</th><th>Commission</th><th>Rate</th><th>Renewal</th></tr></thead>
                  <tbody>
                    {preview.sample.map((row, i) => (
                      <tr key={i} style={row.flagged ? { background: '#f7c94f0d' } : undefined}>
                        <td>{row.flagged
                          ? <span title={row.flagReason} className="badge" style={{ background: '#f7c94f22', color: '#f7c94f' }}>!</span>
                          : <span className="badge" style={{ background: '#3ecf8e22', color: '#3ecf8e' }}>✓</span>}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{row.policyNumberRaw ?? '—'}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{money(row.premiumAmount)}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{money(row.commissionAmount)}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{pct(row.commissionPct)}</td>
                        <td style={{ fontSize: 12, color: 'var(--text2)' }}>{row.isRenewal == null ? '—' : row.isRenewal ? 'Renewal' : 'New'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 560 }}>
              <div>
                <label style={lbl}>Statement Date</label>
                <input type="date" value={statementDate} onChange={e => setStatementDate(e.target.value)}/>
              </div>
              <div>
                <label style={lbl}>Save this mapping as <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(optional)</span></label>
                <input value={saveMappingName} onChange={e => setSaveMappingName(e.target.value)} placeholder="e.g. Progressive CSV v2"/>
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={autoReconcile} onChange={e => setAutoReconcile(e.target.checked)} style={{ width: 'auto' }}/>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>Auto-reconcile against the commission ledger on import</span>
            </label>

            {err && <div style={errBox}>{err}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-ghost" onClick={reset}>← Start over</button>
              <button className="btn-primary" onClick={commitImport} disabled={busy}>{busy ? 'Importing…' : `Import ${preview.stats.total} rows`}</button>
            </div>
          </div>
        )}

        {stage === 'done' && result && (
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="badge" style={{ background: '#3ecf8e22', color: '#3ecf8e' }}>Imported</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{money(result.totalAmount)} across {result.rowsTotal} line items</span>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Stat label="Matched to policies" value={result.matched} color="var(--green)"/>
              <Stat label="Reconciled" value={result.reconciled} color="var(--accent)"/>
              <Stat label="Exceptions" value={result.exceptionsCreated} color={result.exceptionsCreated ? 'var(--red)' : 'var(--text3)'}/>
              <Stat label="Flagged rows" value={result.rowsFlagged} color={result.rowsFlagged ? 'var(--yellow)' : 'var(--text3)'}/>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text2)' }}>
              {result.exceptionsCreated > 0
                ? 'Review the discrepancies in the Commission Hub → Exceptions tab.'
                : 'No discrepancies — everything reconciled cleanly.'}
            </p>
            <div><button className="btn-primary" onClick={reset}>Upload another statement</button></div>
          </div>
        )}
      </div>

      {/* Recent imports */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: 12 }}>Recent Imports</div>
        <div className="card" style={{ padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>File</th><th>Carrier</th><th>Total</th><th>Rows</th><th>Flagged</th><th>Confidence</th><th>When</th><th></th></tr></thead>
              <tbody>
                {batches.length === 0
                  ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>No imports yet.</td></tr>
                  : batches.map(b => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 600, fontSize: 13 }}>{b.file_name}</td>
                      <td style={{ fontSize: 13, color: 'var(--text2)' }}>{b.carrier_name ?? '—'}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{money(b.total_amount)}</td>
                      <td style={{ fontSize: 13 }}>{b.rows_total}</td>
                      <td style={{ fontSize: 13, color: b.rows_flagged ? 'var(--yellow)' : 'var(--text3)' }}>{b.rows_flagged}</td>
                      <td style={{ fontSize: 13 }}>{b.confidence != null ? `${Math.round(Number(b.confidence) * 100)}%` : '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text3)' }}>{new Date(b.created_at).toLocaleString()}</td>
                      <td><button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => openDetail(b.id)}>View</button></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {detail && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDetail(null)}>
          <div className="modal" style={{ maxWidth: 760, width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>Import Detail</h3>
              <button className="btn-ghost" style={{ padding: '4px 8px' }} onClick={() => setDetail(null)}>✕</button>
            </div>
            {detail.loading ? <div style={{ padding: 24, color: 'var(--text3)' }}>Loading…</div>
              : detail.error ? <div style={errBox}>{detail.error}</div>
              : (
                <>
                  <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text2)', marginBottom: 14, flexWrap: 'wrap' }}>
                    <span>{detail.batch.file_name}</span>
                    <span>·</span><span>{detail.batch.carrier_name ?? '—'}</span>
                    <span>·</span><span>{money(detail.batch.total_amount)}</span>
                  </div>
                  <div style={{ overflowX: 'auto', maxHeight: 400 }}>
                    <table>
                      <thead><tr><th>Raw Policy #</th><th>Matched</th><th>Premium</th><th>Commission</th><th>Rate</th></tr></thead>
                      <tbody>
                        {detail.lineItems.map(li => (
                          <tr key={li.id}>
                            <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{li.policy_number_raw ?? '—'}</td>
                            <td>{li.matched_policy_number
                              ? <span className="badge" style={{ background: '#3ecf8e22', color: '#3ecf8e' }}>{li.matched_policy_number}</span>
                              : <span className="badge" style={{ background: '#f76f6f22', color: '#f76f6f' }}>unmatched</span>}</td>
                            <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{money(li.premium_amount)}</td>
                            <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{money(li.commission_amount)}</td>
                            <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{pct(li.commission_pct)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
          </div>
        </div>
      )}
    </div>
  );
}

const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 };
const errBox = { color: 'var(--red)', fontSize: 12, background: '#f76f6f14', border: '1px solid #f76f6f44', borderRadius: 8, padding: '8px 12px' };

function Stat({ label, value, color = 'var(--text)' }) {
  return (
    <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 16px', minWidth: 110 }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

function Steps({ stage }) {
  const steps = [['upload', 'Upload'], ['map', 'Map & Review'], ['done', 'Done']];
  const idx = steps.findIndex(s => s[0] === stage);
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {steps.map(([id, label], i) => (
        <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            opacity: i <= idx ? 1 : 0.4,
          }}>
            <span style={{
              width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700,
              background: i < idx ? 'var(--green)' : i === idx ? 'var(--accent)' : 'var(--surface3)',
              color: i <= idx ? '#fff' : 'var(--text3)',
            }}>{i < idx ? '✓' : i + 1}</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
          </div>
          {i < steps.length - 1 && <div style={{ width: 28, height: 1, background: 'var(--border2)' }}/>}
        </div>
      ))}
    </div>
  );
}
