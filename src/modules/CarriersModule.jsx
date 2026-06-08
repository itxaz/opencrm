import { useState } from 'react';
import { useApi } from '../hooks/useApi.js';
import { api } from '../lib/api.js';

export default function CarriersModule({ session }) {
  const { data: carriersData, loading: cLoading } = useApi('/carriers');
  const { data: apptData, loading: aLoading, refetch: refetchAppts } = useApi('/appointments');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ carrierId: '', carrierCode: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const isITX = session?.apiRole === 'itx_admin';
  const carriers = carriersData?.carriers ?? [];
  const appts = apptData?.appointments ?? [];
  const appointedIds = new Set(appts.map(a => a.carrier_id));
  const unappointed = carriers.filter(c => !appointedIds.has(c.id));

  const addAppointment = async () => {
    if (!form.carrierId) { setErr('Select a carrier'); return; }
    setSaving(true); setErr('');
    try {
      await api('/appointments', { method: 'POST', body: { carrierId: form.carrierId, carrierCode: form.carrierCode || undefined } });
      setModal(false); setForm({ carrierId: '', carrierCode: '' }); refetchAppts();
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  const toggleActive = async (a) => {
    try {
      await api(`/appointments/${a.id}`, { method: 'PATCH', body: { active: !a.active } });
      refetchAppts();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="fade-in" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Agency appointments */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>Carrier Appointments</h2>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>Carriers your agency is appointed with</p>
          </div>
          {unappointed.length > 0 && (
            <button className="btn-primary" onClick={() => { setErr(''); setModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              + Add Appointment
            </button>
          )}
        </div>
        <div className="card" style={{ padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            {aLoading
              ? <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
              : (
                <table>
                  <thead><tr><th>Carrier</th><th>NAIC Code</th><th>Your Producer Code</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {appts.length === 0
                      ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>No appointments yet — add your first carrier above.</td></tr>
                      : appts.map(a => (
                        <tr key={a.id}>
                          <td style={{ fontWeight: 600, fontSize: 13 }}>{a.carrier_name}</td>
                          <td style={{ color: 'var(--text3)', fontSize: 13 }}>
                            {carriers.find(c => c.id === a.carrier_id)?.naic_code ?? '—'}
                          </td>
                          <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--accent)' }}>{a.carrier_code ?? '—'}</td>
                          <td>
                            <span className="badge" style={{ background: a.active ? '#3ecf8e22' : '#ffffff12', color: a.active ? '#3ecf8e' : 'var(--text3)' }}>
                              {a.active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12, color: a.active ? 'var(--red)' : 'var(--green)' }} onClick={() => toggleActive(a)}>
                              {a.active ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
          </div>
        </div>
      </div>

      {/* Global carrier directory */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>Carrier Directory</h3>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>
              {isITX ? 'Global registry — you can add carriers as ITX admin.' : `${carriers.length} carriers available to appoint.`}
            </p>
          </div>
        </div>
        <div className="card" style={{ padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            {cLoading
              ? <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
              : (
                <table>
                  <thead><tr><th>Carrier Name</th><th>NAIC Code</th><th>Appointed?</th></tr></thead>
                  <tbody>
                    {carriers.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</td>
                        <td style={{ color: 'var(--text3)', fontSize: 13 }}>{c.naic_code ?? '—'}</td>
                        <td>
                          {appointedIds.has(c.id)
                            ? <span className="badge" style={{ background: '#3ecf8e22', color: '#3ecf8e' }}>Appointed</span>
                            : <span className="badge" style={{ background: '#ffffff0a', color: 'var(--text3)' }}>Not appointed</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </div>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>Add Carrier Appointment</h3>
              <button className="btn-ghost" style={{ padding: '4px 8px' }} onClick={() => setModal(false)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Carrier *</label>
                <select value={form.carrierId} onChange={e => setForm({ ...form, carrierId: e.target.value })} autoFocus>
                  <option value="">Select a carrier…</option>
                  {unappointed.map(c => <option key={c.id} value={c.id}>{c.name}{c.naic_code ? ` (${c.naic_code})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Your Producer Code</label>
                <input value={form.carrierCode} onChange={e => setForm({ ...form, carrierCode: e.target.value })} placeholder="e.g. AG-12345"/>
              </div>
              {err && <div style={{ color: 'var(--red)', fontSize: 12 }}>{err}</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button className="btn-ghost" onClick={() => setModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={addAppointment} disabled={saving}>{saving ? 'Saving…' : 'Add Appointment'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
