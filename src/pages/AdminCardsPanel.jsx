import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';

const CARDS_PER_PAGE = 8;

export default function AdminCardsPanel({ onStatus }) {
  const [cards,   setCards]   = useState([]);
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [page,    setPage]    = useState(1);

  const [addOpen,      setAddOpen]      = useState(false);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [assignOpen,   setAssignOpen]   = useState(false);

  const [addForm,      setAddForm]      = useState({ rfid_uid: '', user_id: '', initial_balance: '' });
  const [addSaving,    setAddSaving]    = useState(false);
  const [rechargeForm, setRechargeForm] = useState({ cardId: '', amount_rwf: '' });
  const [assignForm,   setAssignForm]   = useState({ cardId: '', user_id: '' });

  /* ── load ── */
  const refresh = async () => {
    setLoading(true);
    try {
      const [cR, uR] = await Promise.all([api.adminListCards(), api.users()]);
      setCards(cR.cards || []);
      setUsers((uR.users || []).filter(u => u.role === 'customer' || u.role === 'wasac_manager'));
      setPage(1);
    } catch (e) {
      onStatus?.({ type: 'error', message: e.message || 'Failed to load.' });
    } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []); // eslint-disable-line

  const lowBalanceCount = useMemo(() => cards.filter(c => Number(c.balance_rwf) < 1000).length, [cards]);

  /* ── Add Card ── */
  const submitAdd = async (e) => {
    e.preventDefault();
    if (!addForm.rfid_uid?.trim()) {
      onStatus?.({ type: 'error', message: 'RFID UID is required.' });
      return;
    }
    setAddSaving(true);
    try {
      const uid = addForm.rfid_uid.trim().toUpperCase();
      // Create card
      const cardRes = await api.adminCreateCard({
        initial_balance: Number(addForm.initial_balance) || 0,
        user_id: addForm.user_id || null,
      });
      const created = cardRes.card || cardRes;
      // Link RFID UID
      await api.adminSetCardRfid({ cardId: created.id, rfid_uid: uid });
      // Assign user if selected (and not already set in create)
      if (addForm.user_id && !created.user_id) {
        await api.adminAssignCard({ cardId: created.id, userId: addForm.user_id });
      }
      const owner = users.find(u => u.user_id === addForm.user_id);
      onStatus?.({ type: 'success', message: `Card ${uid} created${owner ? ` and assigned to ${owner.full_name || owner.email}` : ''}.` });
      setAddOpen(false);
      setAddForm({ rfid_uid: '', user_id: '', initial_balance: '' });
      await refresh();
    } catch (err) {
      onStatus?.({ type: 'error', message: err.message || 'Failed to create card.' });
    } finally { setAddSaving(false); }
  };

  /* ── Assign user ── */
  const submitAssign = async (e) => {
    e.preventDefault();
    try {
      await api.adminAssignCard({ cardId: assignForm.cardId, userId: assignForm.user_id });
      const u = users.find(u => u.user_id === assignForm.user_id);
      onStatus?.({ type: 'success', message: `Card assigned to ${u?.full_name || u?.email || 'user'}.` });
      setAssignOpen(false);
      await refresh();
    } catch (err) { onStatus?.({ type: 'error', message: err.message }); }
  };

  /* ── Recharge ── */
  const submitRecharge = async (e) => {
    e.preventDefault();
    try {
      await api.adminRechargeCard({ cardId: rechargeForm.cardId, amount_rwf: Number(rechargeForm.amount_rwf) });
      setRechargeOpen(false);
      setRechargeForm({ cardId: '', amount_rwf: '' });
      onStatus?.({ type: 'success', message: 'Recharge successful.' });
      await refresh();
    } catch (err) { onStatus?.({ type: 'error', message: err.message }); }
  };

  /* ── Toggle active / inactive ── */
  const toggleActive = async (card) => {
    try {
      await api.adminSetCardActive({ cardId: card.id, is_active: !card.is_active });
      onStatus?.({ type: 'success', message: card.is_active ? `Card ${card.card_uid} disabled.` : `Card ${card.card_uid} enabled.` });
      await refresh();
    } catch (err) { onStatus?.({ type: 'error', message: err.message }); }
  };

  /* ── Delete card ── */
  const deleteCard = async (card) => {
    if (!window.confirm(`Delete card ${card.card_uid}?\nThis cannot be undone.`)) return;
    try {
      await api.adminDeleteCard({ cardId: card.id });
      onStatus?.({ type: 'success', message: `Card ${card.card_uid} deleted.` });
      await refresh();
    } catch (err) { onStatus?.({ type: 'error', message: err.message }); }
  };

  const paged      = cards.slice((page - 1) * CARDS_PER_PAGE, page * CARDS_PER_PAGE);
  const totalPages = Math.ceil(cards.length / CARDS_PER_PAGE);

  return (
    <div className="panel-card">
      {/* Header */}
      <div className="panel-heading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <h3>RFID Card Management</h3>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {lowBalanceCount > 0 && (
            <span className="badge badge-warning">⚠️ {lowBalanceCount} low balance</span>
          )}
          <button className="btn-primary btn-sm" onClick={() => setAddOpen(true)}>+ Add Card</button>
        </div>
      </div>

      {/* Cards Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>RFID UID</th>
              <th>Card ID</th>
              <th>Assigned To</th>
              <th>Balance</th>
              <th>Status</th>
              <th style={{ width: 220 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>Loading…</td></tr>
            )}
            {!loading && cards.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                No cards yet. Click <strong>+ Add Card</strong> to create one.
              </td></tr>
            )}
            {paged.map(c => (
              <tr key={c.id}>
                {/* RFID UID */}
                <td>
                  <code style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.82rem', color: 'var(--primary)' }}>
                    {c.rfid_uid || '—'}
                  </code>
                  {!c.rfid_uid && (
                    <div style={{ fontSize: '0.7rem', color: '#e63946', marginTop: 2 }}>No RFID linked</div>
                  )}
                </td>
                {/* Card UID */}
                <td>
                  <code style={{ fontSize: '0.72rem', background: 'var(--surface2)', padding: '2px 6px', borderRadius: 4 }}>
                    {c.card_uid}
                  </code>
                </td>
                {/* Assigned To */}
                <td>
                  {c.customer_name
                    ? <strong style={{ fontSize: '0.85rem' }}>{c.customer_name}</strong>
                    : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>— unassigned</span>
                  }
                </td>
                {/* Balance */}
                <td>
                  <span style={{
                    fontWeight: 700, fontSize: '0.9rem',
                    color: Number(c.balance_rwf) < 1000 ? '#e63946' : '#12b76a',
                  }}>
                    {Number(c.balance_rwf).toLocaleString()} RWF
                  </span>
                  {Number(c.balance_rwf) < 1000 && (
                    <div style={{ fontSize: '0.68rem', color: '#e63946' }}>Low balance</div>
                  )}
                </td>
                {/* Status */}
                <td>
                  <span className={`badge ${c.is_active ? 'badge-success' : 'badge-danger'}`}>
                    {c.is_active ? '✓ Active' : '✗ Disabled'}
                  </span>
                  {c.registration_status !== 'registered' && (
                    <div><span className="badge badge-warning" style={{ fontSize: '0.65rem', marginTop: 3 }}>Pending</span></div>
                  )}
                </td>
                {/* Actions */}
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    <button className="btn-primary btn-sm"
                      onClick={() => { setRechargeForm({ cardId: c.id, amount_rwf: '' }); setRechargeOpen(true); }}>
                      💰 Recharge
                    </button>
                    <button className="btn-secondary btn-sm"
                      onClick={() => { setAssignForm({ cardId: c.id, user_id: '' }); setAssignOpen(true); }}>
                      👤 {c.customer_name ? 'Reassign' : 'Assign'}
                    </button>
                    <button
                      className={`btn-sm ${c.is_active ? 'btn-secondary' : 'btn-primary'}`}
                      style={c.is_active ? { background: '#fff3cd', color: '#856404', border: '1px solid #ffc107' } : {}}
                      onClick={() => toggleActive(c)}
                      title={c.is_active ? 'Disable this card (blocks water fetch)' : 'Enable this card'}>
                      {c.is_active ? '🔒 Disable' : '✓ Enable'}
                    </button>
                    <button className="btn-danger btn-sm" onClick={() => deleteCard(c)} title="Delete card permanently">
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {(page - 1) * CARDS_PER_PAGE + 1}–{Math.min(page * CARDS_PER_PAGE, cards.length)} of {cards.length} cards
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
              <button key={p} className={`btn-sm ${page === p ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPage(p)} style={{ minWidth: 32 }}>{p}</button>
            ))}
            <button className="btn-secondary btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        </div>
      )}

      {/* ════ ADD CARD MODAL ════ */}
      {addOpen && (
        <div className="modal-backdrop" onClick={() => setAddOpen(false)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Card</h2>
              <button className="modal-close" onClick={() => setAddOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={submitAdd} className="form-grid">
                <label>
                  RFID UID <span style={{ color: '#e63946', fontWeight: 700 }}>*</span>
                  <input
                    type="text"
                    placeholder="e.g. 7121CF17"
                    value={addForm.rfid_uid}
                    onChange={e => setAddForm(f => ({ ...f, rfid_uid: e.target.value.toUpperCase() }))}
                    required
                    autoFocus
                    style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1rem', letterSpacing: 3 }}
                  />
                  <small style={{ color: 'var(--text-muted)' }}>
                    Open Arduino Serial Monitor (115200 baud), tap the physical card on the RFID reader — the UID prints automatically.
                  </small>
                </label>

                <label>
                  Assign to Customer <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
                  <select value={addForm.user_id} onChange={e => setAddForm(f => ({ ...f, user_id: e.target.value }))}>
                    <option value="">— No assignment yet —</option>
                    {users.map(u => (
                      <option key={u.user_id} value={u.user_id}>
                        {u.full_name || u.email}
                      </option>
                    ))}
                  </select>
                  <small style={{ color: 'var(--text-muted)' }}>Only the assigned customer can use this card to fetch water.</small>
                </label>

                <label>
                  Initial Balance (RWF) <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
                  <input
                    type="number" min="0" step="100"
                    placeholder="0"
                    value={addForm.initial_balance}
                    onChange={e => setAddForm(f => ({ ...f, initial_balance: e.target.value }))}
                  />
                </label>

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={addSaving}>
                    {addSaving ? 'Creating…' : '+ Create Card'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ════ ASSIGN USER MODAL ════ */}
      {assignOpen && (
        <div className="modal-backdrop" onClick={() => setAssignOpen(false)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Assign Card to Customer</h2>
              <button className="modal-close" onClick={() => setAssignOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={submitAssign} className="form-grid">
                <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', fontSize: '0.82rem' }}>
                  Card RFID: <strong style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>
                    {cards.find(c => c.id === assignForm.cardId)?.rfid_uid || cards.find(c => c.id === assignForm.cardId)?.card_uid}
                  </strong>
                </div>
                <label>
                  Select Customer
                  <select value={assignForm.user_id} onChange={e => setAssignForm(f => ({ ...f, user_id: e.target.value }))} required>
                    <option value="">Choose customer…</option>
                    {users.map(u => (
                      <option key={u.user_id} value={u.user_id}>{u.full_name || u.email}</option>
                    ))}
                  </select>
                </label>
                <div style={{ background: 'rgba(67,97,238,0.07)', borderRadius: 8, padding: '10px 14px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  ℹ️ Only this customer will be allowed to fetch water with this card.
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setAssignOpen(false)}>Cancel</button>
                  <button type="submit" className="btn-primary">Assign</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ════ RECHARGE MODAL ════ */}
      {rechargeOpen && (() => {
        const card = cards.find(c => c.id === rechargeForm.cardId);
        const cur = Number(card?.balance_rwf || 0);
        const add = Number(rechargeForm.amount_rwf) || 0;
        return (
          <div className="modal-backdrop" onClick={() => setRechargeOpen(false)}>
            <div className="modal-panel" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Recharge Card</h2>
                <button className="modal-close" onClick={() => setRechargeOpen(false)}>×</button>
              </div>
              <div className="modal-body">
                <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>RFID</span>
                    <strong style={{ fontFamily: 'monospace', color: 'var(--primary)', fontSize: '0.85rem' }}>{card?.rfid_uid || card?.card_uid}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Owner</span>
                    <strong style={{ fontSize: '0.82rem' }}>{card?.customer_name || '—'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Current balance</span>
                    <strong style={{ color: '#12b76a' }}>{cur.toLocaleString()} RWF</strong>
                  </div>
                  {add > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>After recharge</span>
                      <strong style={{ color: 'var(--primary)', fontSize: '1rem' }}>{(cur + add).toLocaleString()} RWF</strong>
                    </div>
                  )}
                </div>
                <form onSubmit={submitRecharge} className="form-grid">
                  <label>
                    Amount to add (RWF)
                    <input type="number" min="100" step="100" value={rechargeForm.amount_rwf}
                      onChange={e => setRechargeForm(f => ({ ...f, amount_rwf: e.target.value }))}
                      required autoFocus placeholder="e.g. 500" />
                  </label>
                  <div className="modal-actions">
                    <button type="button" className="btn-secondary" onClick={() => setRechargeOpen(false)}>Cancel</button>
                    <button type="submit" className="btn-primary">💰 Recharge</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
