import { useState } from 'react';
import { useApi } from '../hooks/useApi.js';
import { api } from '../lib/api.js';

const BASIS_LABELS = {
  upfront_first_term: 'Upfront (1st term)',
  level_each_term:    'Level (each term)',
  renewal_only:       'Renewal only',
  split:              'Split (1st / renewal)',
};

const BASIS_COLORS = {
  upfront_first_term: '#4f8ef7',
  level_each_term:    '#3ecf8e',
  renewal_only:       '#a78bfa',
  split:              '#f7c94f',
};

const EMPTY_FORM = {
  carrierId: '', productLine: '', basis: 'upfront_first_term',
  firstTermPct: '', renewalPct: '', agencyRetainsRenewal: false,
  effectiveFrom: '', effectiveTo: '',
};

const fmtPct = (v) => v == null ? '—' : `${(Number(v) * 100).toFixed(2)}%`;

export default function CommissionRulesModule() {
  const { data: rulesData, loading: rLoading, refetch } = useApi('/commission-rules');
  const { data: carriersData, loading: cLoading } = useApi('/carriers');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [deleting, setDeleting] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const showFirst = ['upfront_first_term', 'level_each_term', 'split'].includes(form.basis);
  const showRenewal = ['renewal_only', 'split'].includes(form.basis);
  const showRetain = form.basis === 'upfront_first_term';

  const save = async () => {
    if (!form.carrierId) { setErr('Select a carrier'); return; }
    setSaving(true); setErr('');
    try {
      await api('/commission-rules', {
        method: 'POST',
        body: {
          carrierId: form.carrierId,
          productLine: form.productLine || undefined,
          basis: form.basis,
          firstTermPct: showFirst && form.firstTermPct !== '' ? Number(form.firstTermPct) / 100 : undefined,
          renewalPct: showRenewal && form.renewalPct !== '' ? Number(form.renewalPct) / 100 : undefined,
          agencyRetainsRenewal: form.agencyRetainsRenewal,
          effectiveFrom: form.effectiveFrom || undefined,
          effectiveTo: form.effectiveTo || undefined,
        },
      });
      setModal(false); setForm(EMPTY_FORM); refetch();
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  const deleteRule = async (id) => {
    setDeleting(id);
    try {
      await api(`/commission-rules/${id}`, { method: 'DELETE' });
      refetch();
    } catch (e) { alert(e.message); } finally { setDeleting(null); }
  };

  const rules = rulesData?.rules ?? [];
  const carriers = carriersData?.carriers ?? [];

  return (
    <div className="fade-in" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>Commission Rules</h2>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>How each carrier pays — drives expected commission calculations</p>
        </div>
        <button className="btn-primary" onClick={() => { setErr(''); setForm(EMPTY_FORM); setModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          + Add Rule
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          {rLoading || cLoading
            ? <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
            : (
              <table>
                <thead><tr>
                  <th>Carrier</th><th>Product Line</th><th>Basis</th>
                  <th>1st Term %</th><th>Renewal %</th><th>Agency Retains Renewal</th><th>Actions</th>
                </tr></thead>
                <tbody>
                  {rules.length === 0
                    ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>No rules yet. Add a rule for each carrier appointment.</td></tr>
                    : rules.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>{r.carrier_name}</td>
                        <td style={{ color: 'var(--text2)', fontSize: 13 }}>{r.product_line ?? <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>All lines</span>}</td>
                        <td>
                          <span className="badge" style={{ background: `${BASIS_COLORS[r.basis]}22`, color: BASIS_COLORS[r.basis] }}>
                            {BASIS_LABELS[r.basis] ?? r.basis}
                          </span>
                        </td>
                        <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{fmtPct(r.first_term_pct)}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{fmtPct(r.renewal_pct)}</td>
                        <td>
                          {r.agency_retains_renewal
                            ? <span className="badge" style={{ background: '#f7c94f22', color: '#f7c94f' }}>Yes</span>
                            : <span style={{ color: 'var(--text3)', fontSize: 12 }}>No</span>}
                        </td>
                        <td>
                          <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12, color: 'var(--red)' }}
                            disabled={deleting === r.id} onClick={() => deleteRule(r.id)}>
                            {deleting === r.id ? '…' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
        </div>
      </div>

      {/* Basis explainer cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {Object.entries(BASIS_LABELS).map(([k, label]) => (
          <div key={k} style={{ background: 'var(--surface)', border: `1px solid ${BASIS_COLORS[k]}44`, borderRadius: 10, padding: '10px 14px', flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: BASIS_COLORS[k], textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>
              {k === 'upfront_first_term' && 'Full commission on first sale. Agency optionally retains renewals.'}
              {k === 'level_each_term' && 'Same rate applies every policy term, including renewals.'}
              {k === 'renewal_only' && 'No commission on first sale; carrier pays only on renewals.'}
              {k === 'split' && 'Different rates for first term vs. renewals — both defined.'}
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>Add Commission Rule</h3>
              <button className="btn-ghost" style={{ padding: '4px 8px' }} onClick={() => setModal(false)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Carrier *</label>
                <select value={form.carrierId} onChange={e => set('carrierId', e.target.value)} autoFocus>
                  <option value="">Select carrier…</option>
                  {carriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Product Line <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(leave blank to apply to all lines)</span></label>
                <input value={form.productLine} onChange={e => set('productLine', e.target.value)} placeholder="e.g. auto_liability, cargo…"/>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Payout Basis *</label>
                <select value={form.basis} onChange={e => set('basis', e.target.value)}>
                  {Object.entries(BASIS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              {showFirst && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>
                    {form.basis === 'level_each_term' ? 'Rate % (all terms)' : '1st Term Rate %'}
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="number" min="0" max="100" step="0.01" value={form.firstTermPct} onChange={e => set('firstTermPct', e.target.value)} placeholder="15.00" style={{ width: 100 }}/>
                    <span style={{ color: 'var(--text3)', fontSize: 12 }}>%</span>
                  </div>
                </div>
              )}
              {showRenewal && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Renewal Rate %</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="number" min="0" max="100" step="0.01" value={form.renewalPct} onChange={e => set('renewalPct', e.target.value)} placeholder="5.00" style={{ width: 100 }}/>
                    <span style={{ color: 'var(--text3)', fontSize: 12 }}>%</span>
                  </div>
                </div>
              )}
              {showRetain && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.agencyRetainsRenewal} onChange={e => set('agencyRetainsRenewal', e.target.checked)} style={{ width: 'auto' }}/>
                  <span style={{ fontSize: 13, color: 'var(--text2)' }}>Agency retains renewals (agent gets no commission on renewal)</span>
                </label>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Effective From</label>
                  <input type="date" value={form.effectiveFrom} onChange={e => set('effectiveFrom', e.target.value)}/>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Effective To</label>
                  <input type="date" value={form.effectiveTo} onChange={e => set('effectiveTo', e.target.value)}/>
                </div>
              </div>
              {err && <div style={{ color: 'var(--red)', fontSize: 12 }}>{err}</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button className="btn-ghost" onClick={() => setModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Add Rule'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
