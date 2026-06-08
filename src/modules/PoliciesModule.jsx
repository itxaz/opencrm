import { useState } from 'react';
import { useApi } from '../hooks/useApi.js';
import { api } from '../lib/api.js';

const fmt = (n) => n == null ? '—' : Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const fmtPct = (n) => n == null ? '—' : `${(Number(n) * 100).toFixed(2)}%`;
const today = () => new Date().toISOString().split('T')[0];

const EMPTY_POLICY = {
  carrierId: '', agentId: '', policyNumber: '', insuredName: '',
  productLine: '', effectiveDate: today(), termMonths: '12', isRenewal: false,
};
const EMPTY_PREMIUM = { txnType: 'new', premiumAmount: '', txnDate: today() };

export default function PoliciesModule() {
  const { data: polData, loading, refetch } = useApi('/policies');
  const { data: carriersData } = useApi('/carriers');
  const { data: agentsData } = useApi('/agents');

  const [policyModal, setPolicyModal] = useState(false);
  const [premiumModal, setPremiumModal] = useState(null); // policy object
  const [pForm, setPForm] = useState(EMPTY_POLICY);
  const [prForm, setPrForm] = useState(EMPTY_PREMIUM);
  const [saving, setSaving] = useState(false);
  const [premiumResult, setPremiumResult] = useState(null); // { appliedPct, ledger }
  const [err, setErr] = useState('');

  const policies = polData?.policies ?? [];
  const carriers = carriersData?.carriers ?? [];
  const agents = agentsData?.agents ?? [];

  const savePolicy = async () => {
    if (!pForm.carrierId) { setErr('Select a carrier'); return; }
    if (!pForm.policyNumber.trim()) { setErr('Policy number is required'); return; }
    setSaving(true); setErr('');
    try {
      await api('/policies', {
        method: 'POST',
        body: {
          carrierId: pForm.carrierId,
          agentId: pForm.agentId || undefined,
          policyNumber: pForm.policyNumber,
          insuredName: pForm.insuredName || undefined,
          productLine: pForm.productLine || undefined,
          effectiveDate: pForm.effectiveDate || undefined,
          termMonths: pForm.termMonths ? Number(pForm.termMonths) : undefined,
          isRenewal: pForm.isRenewal,
        },
      });
      setPolicyModal(false); setPForm(EMPTY_POLICY); refetch();
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  const recordPremium = async () => {
    if (!prForm.premiumAmount) { setErr('Enter premium amount'); return; }
    setSaving(true); setErr(''); setPremiumResult(null);
    try {
      const result = await api(`/policies/${premiumModal.id}/premiums`, {
        method: 'POST',
        body: {
          txnType: prForm.txnType,
          premiumAmount: Number(prForm.premiumAmount),
          txnDate: prForm.txnDate,
        },
      });
      setPremiumResult(result);
      refetch(); // update policy list (future: commission indicator)
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  const openPremiumModal = (policy) => {
    setPremiumModal(policy);
    setPrForm({ ...EMPTY_PREMIUM, txnType: policy.is_renewal ? 'renewal' : 'new' });
    setPremiumResult(null); setErr('');
  };

  const STATUS_COLORS = { active: '#3ecf8e', cancelled: '#f76f6f', expired: '#8a90a8' };

  return (
    <div className="fade-in" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>Policies</h2>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>Record policies and premiums to project expected commissions</p>
        </div>
        <button className="btn-primary" onClick={() => { setErr(''); setPForm(EMPTY_POLICY); setPolicyModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          + New Policy
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          {loading
            ? <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
            : (
              <table>
                <thead><tr>
                  <th>Policy #</th><th>Insured</th><th>Carrier</th><th>Agent</th>
                  <th>Product</th><th>Effective</th><th>Term</th><th>Type</th><th>Actions</th>
                </tr></thead>
                <tbody>
                  {policies.length === 0
                    ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>No policies yet — add your first policy above.</td></tr>
                    : policies.map(p => (
                      <tr key={p.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--accent)', whiteSpace: 'nowrap' }}>{p.policy_number}</td>
                        <td style={{ fontSize: 13 }}>{p.insured_name ?? '—'}</td>
                        <td style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>{p.carrier_name}</td>
                        <td style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{p.agent_name ?? '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--text3)' }}>{p.product_line ?? '—'}</td>
                        <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                          {p.effective_date ? new Date(p.effective_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </td>
                        <td style={{ fontSize: 13 }}>{p.term_months ? `${p.term_months}mo` : '—'}</td>
                        <td>
                          {p.is_renewal
                            ? <span className="badge" style={{ background: '#a78bfa22', color: '#a78bfa' }}>Renewal</span>
                            : <span className="badge" style={{ background: '#4f8ef722', color: '#4f8ef7' }}>New</span>}
                        </td>
                        <td>
                          <button className="btn-primary" style={{ padding: '4px 12px', fontSize: 12, background: 'linear-gradient(135deg, #3ecf8e, #2db87a)' }}
                            onClick={() => openPremiumModal(p)}>
                            + Premium
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
        </div>
      </div>

      {/* New Policy modal */}
      {policyModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPolicyModal(false)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>New Policy</h3>
              <button className="btn-ghost" style={{ padding: '4px 8px' }} onClick={() => setPolicyModal(false)}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* Carrier */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Carrier *</label>
                <select value={pForm.carrierId} onChange={e => setPForm(f => ({ ...f, carrierId: e.target.value }))} autoFocus>
                  <option value="">Select carrier…</option>
                  {carriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {/* Policy number */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Policy Number *</label>
                <input value={pForm.policyNumber} onChange={e => setPForm(f => ({ ...f, policyNumber: e.target.value }))} placeholder="POL-10001"/>
              </div>
              {/* Insured */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Insured Name</label>
                <input value={pForm.insuredName} onChange={e => setPForm(f => ({ ...f, insuredName: e.target.value }))} placeholder="Acme Freight LLC"/>
              </div>
              {/* Agent */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Agent</label>
                <select value={pForm.agentId} onChange={e => setPForm(f => ({ ...f, agentId: e.target.value }))}>
                  <option value="">No agent / unknown</option>
                  {agents.filter(a => a.status === 'active').map(a => <option key={a.id} value={a.id}>{a.display_name}</option>)}
                </select>
              </div>
              {/* Product line */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Product Line</label>
                <input value={pForm.productLine} onChange={e => setPForm(f => ({ ...f, productLine: e.target.value }))} placeholder="cargo, auto_liability…"/>
              </div>
              {/* Effective date */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Effective Date</label>
                <input type="date" value={pForm.effectiveDate} onChange={e => setPForm(f => ({ ...f, effectiveDate: e.target.value }))}/>
              </div>
              {/* Term */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Term (months)</label>
                <input type="number" min="1" value={pForm.termMonths} onChange={e => setPForm(f => ({ ...f, termMonths: e.target.value }))} placeholder="12" style={{ width: 90 }}/>
              </div>
              {/* Is renewal */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--text2)' }}>
                  <input type="checkbox" checked={pForm.isRenewal} onChange={e => setPForm(f => ({ ...f, isRenewal: e.target.checked }))} style={{ width: 'auto' }}/>
                  This is a renewal policy
                </label>
              </div>
            </div>
            {err && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 12 }}>{err}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button className="btn-ghost" onClick={() => setPolicyModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={savePolicy} disabled={saving}>{saving ? 'Saving…' : 'Create Policy'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Record Premium modal */}
      {premiumModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && (setPremiumModal(null), setPremiumResult(null))}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>Record Premium</h3>
              <button className="btn-ghost" style={{ padding: '4px 8px' }} onClick={() => { setPremiumModal(null); setPremiumResult(null); }}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>
              <span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{premiumModal.policy_number}</span>
              {' · '}{premiumModal.carrier_name}
              {premiumModal.agent_name ? ` · ${premiumModal.agent_name}` : ''}
            </div>

            {premiumResult ? (
              /* Success state */
              <div>
                <div style={{ background: '#3ecf8e14', border: '1px solid #3ecf8e44', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
                  <div style={{ fontWeight: 700, color: '#3ecf8e', marginBottom: 10 }}>Premium recorded — commission projected</div>
                  {premiumResult.ledger ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: 'var(--text3)' }}>Applied rate</span>
                        <span style={{ fontWeight: 700 }}>{fmtPct(premiumResult.appliedPct)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: 'var(--text3)' }}>Expected commission</span>
                        <span style={{ fontWeight: 700, color: 'var(--green)' }}>{fmt(premiumResult.ledger.expected_amount)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: 'var(--text3)' }}>Agent advance</span>
                        <span style={{ fontWeight: 700 }}>{fmt(premiumResult.ledger.agent_advance_amount)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: 'var(--text3)' }}>Expected by</span>
                        <span>{premiumResult.ledger.expected_date ? new Date(premiumResult.ledger.expected_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--yellow)' }}>No commission rule found for this carrier/product line. Add a rule in Commission Rules to project commissions.</div>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button className="btn-ghost" onClick={() => { setPremiumResult(null); setPrForm({ ...EMPTY_PREMIUM, txnType: premiumModal.is_renewal ? 'renewal' : 'new' }); }}>
                    Record Another
                  </button>
                  <button className="btn-primary" onClick={() => { setPremiumModal(null); setPremiumResult(null); }}>Done</button>
                </div>
              </div>
            ) : (
              /* Form state */
              <div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Transaction Type</label>
                    <select value={prForm.txnType} onChange={e => setPrForm(f => ({ ...f, txnType: e.target.value }))}>
                      <option value="new">New business</option>
                      <option value="endorsement">Endorsement</option>
                      <option value="renewal">Renewal</option>
                      <option value="cancel">Cancellation</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Premium Amount *</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: 'var(--text3)' }}>$</span>
                      <input type="number" min="0" step="0.01" value={prForm.premiumAmount} onChange={e => setPrForm(f => ({ ...f, premiumAmount: e.target.value }))} placeholder="10,000.00" autoFocus/>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Transaction Date</label>
                    <input type="date" value={prForm.txnDate} onChange={e => setPrForm(f => ({ ...f, txnDate: e.target.value }))}/>
                  </div>
                  {err && <div style={{ color: 'var(--red)', fontSize: 12 }}>{err}</div>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
                  <button className="btn-ghost" onClick={() => { setPremiumModal(null); setPremiumResult(null); }}>Cancel</button>
                  <button className="btn-primary" onClick={recordPremium} disabled={saving}>{saving ? 'Recording…' : 'Record & Project'}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
