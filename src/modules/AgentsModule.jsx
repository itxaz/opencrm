import { useState } from 'react';
import { useApi } from '../hooks/useApi.js';
import { api } from '../lib/api.js';

const EMPTY_FORM = { displayName: '', email: '', defaultSplit: '60' };

const splitPct = (v) => v == null ? '—' : `${(Number(v) * 100).toFixed(0)}%`;

export default function AgentsModule() {
  const { data, loading, error, refetch } = useApi('/agents');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null); // agent object being edited
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setErr(''); setModal(true); };
  const openEdit = (a) => {
    setEditing(a);
    setForm({ displayName: a.display_name, email: a.email ?? '', defaultSplit: a.default_split ? String(Math.round(Number(a.default_split) * 100)) : '' });
    setErr('');
    setModal(true);
  };
  const close = () => { setModal(false); setEditing(null); };

  const save = async () => {
    if (!form.displayName.trim()) { setErr('Name is required'); return; }
    setSaving(true); setErr('');
    const split = form.defaultSplit !== '' ? Number(form.defaultSplit) / 100 : undefined;
    try {
      if (editing) {
        await api(`/agents/${editing.id}`, { method: 'PATCH', body: { displayName: form.displayName, email: form.email || undefined, defaultSplit: split } });
      } else {
        await api('/agents', { method: 'POST', body: { displayName: form.displayName, email: form.email || undefined, defaultSplit: split } });
      }
      close(); refetch();
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  const toggleStatus = async (a) => {
    try {
      await api(`/agents/${a.id}`, { method: 'PATCH', body: { status: a.status === 'active' ? 'inactive' : 'active' } });
      refetch();
    } catch (e) { alert(e.message); }
  };

  const field = (k, label, extra = {}) => (
    <div key={k}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>{label}</label>
      <input value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} {...extra}/>
    </div>
  );

  return (
    <div className="fade-in" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>Agents</h2>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>Producing agents whose commissions you track</p>
        </div>
        <button className="btn-primary" onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          + Add Agent
        </button>
      </div>

      {error && <div style={{ padding: '12px 16px', background: '#f76f6f18', border: '1px solid #f76f6f44', borderRadius: 10, color: '#f76f6f', fontSize: 13 }}>{error.message}</div>}

      <div className="card" style={{ padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          {loading
            ? <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Loading…</div>
            : (
              <table>
                <thead><tr>
                  <th>Name</th><th>Email</th><th>Agent Split</th><th>Status</th><th>Actions</th>
                </tr></thead>
                <tbody>
                  {(data?.agents ?? []).length === 0
                    ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>No agents yet — add your first agent above.</td></tr>
                    : (data?.agents ?? []).map(a => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>{a.display_name}</td>
                        <td style={{ color: 'var(--text2)', fontSize: 13 }}>{a.email ?? '—'}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{splitPct(a.default_split)}</td>
                        <td>
                          <span className="badge" style={{ background: a.status === 'active' ? '#3ecf8e22' : '#ffffff12', color: a.status === 'active' ? '#3ecf8e' : 'var(--text3)' }}>
                            {a.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => openEdit(a)}>Edit</button>
                            <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12, color: a.status === 'active' ? 'var(--red)' : 'var(--green)' }} onClick={() => toggleStatus(a)}>
                              {a.status === 'active' ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && close()}>
          <div className="modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>{editing ? 'Edit Agent' : 'Add Agent'}</h3>
              <button className="btn-ghost" style={{ padding: '4px 8px' }} onClick={close}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {field('displayName', 'Full Name *', { placeholder: 'Jane Smith', autoFocus: true })}
              {field('email', 'Email', { type: 'email', placeholder: 'jane@agency.com' })}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Agent Split %</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="number" min="0" max="100" value={form.defaultSplit} onChange={e => setForm({ ...form, defaultSplit: e.target.value })} placeholder="60" style={{ width: 90 }}/>
                  <span style={{ color: 'var(--text3)', fontSize: 12 }}>% of agency commission forwarded to agent</span>
                </div>
              </div>
              {err && <div style={{ color: 'var(--red)', fontSize: 12 }}>{err}</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button className="btn-ghost" onClick={close}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : (editing ? 'Save Changes' : 'Add Agent')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
