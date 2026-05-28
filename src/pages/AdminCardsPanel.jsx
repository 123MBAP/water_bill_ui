import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';

export default function AdminCardsPanel({ onStatus }) {
  const [cards, setCards] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);

  const [registerOpen, setRegisterOpen] = useState(false);
  const [rechargeOpen, setRechargeOpen] = useState(false);

  const [registering, setRegistering] = useState(false);
  const [registerResult, setRegisterResult] = useState(null);
  const [registerForm, setRegisterForm] = useState({ deviceId: '', initial_balance: '' });
  const [rechargeForm, setRechargeForm] = useState({ cardId: '', amount_rwf: '' });

  const refresh = async () => {
    setLoading(true);
    try {
      const [cardsRes, devicesRes] = await Promise.all([api.adminListCards(), api.adminListDevices()]);
      setCards(cardsRes.cards || []);
      setDevices(devicesRes.devices || []);

    } catch (e) {
      onStatus?.({ type: 'error', message: e.message || 'Failed to load cards.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lowBalanceCount = useMemo(() => {
    return cards.filter((c) => Number(c.balance_rwf) < 1000).length;
  }, [cards]);

  const submitRegister = async (e) => {
    e.preventDefault();
    setRegistering(true);
    try {
      const card = await api.adminCreateCard({
        initial_balance: Number(registerForm.initial_balance) || 0,
      });
      if (registerForm.deviceId) {
        await api.adminRegisterDevice({ deviceId: registerForm.deviceId });
      }
      const createdCard = card.card || card;
      setRegisterResult(createdCard);
      onStatus?.({
        type: 'success',
        message: createdCard.reused
          ? `Reused pending card ${createdCard.card_uid}.`
          : createdCard.rfid_uid
            ? `Registered card ${createdCard.card_uid} to RFID ${createdCard.rfid_uid}.`
            : `Registered card ${createdCard.card_uid}. Waiting for RFID tap.`,
      });
      setRegisterOpen(false);
      await refresh();
    } catch (err) {
      onStatus?.({ type: 'error', message: err.message || 'Register card failed.' });
    } finally {
      setRegistering(false);
    }
  };

  const submitRecharge = async (e) => {
    e.preventDefault();
    try {
      await api.adminRechargeCard({
        cardId: rechargeForm.cardId,
        amount_rwf: Number(rechargeForm.amount_rwf),
      });
      setRechargeOpen(false);
      setRechargeForm({ cardId: '', amount_rwf: '' });
      onStatus?.({ type: 'success', message: 'Recharge successful.' });
      await refresh();
    } catch (err) {
      onStatus?.({ type: 'error', message: err.message || 'Recharge failed.' });
    }
  };

  const toggleActive = async (card) => {
    try {
      await api.adminSetCardActive({ cardId: card.id, is_active: !card.is_active });
      onStatus?.({ type: 'success', message: card.is_active ? 'Card deactivated.' : 'Card activated.' });
      await refresh();
    } catch (err) {
      onStatus?.({ type: 'error', message: err.message || 'Update failed.' });
    }
  };

  const deleteCard = async (card) => {
    const confirmed = window.confirm(`Delete card ${card.card_uid}? This cannot be undone.`);
    if (!confirmed) return;

    try {
      await api.adminDeleteCard({ cardId: card.id });
      onStatus?.({ type: 'success', message: `Card ${card.card_uid} deleted.` });
      if (registerResult?.id === card.id) {
        setRegisterResult(null);
      }
      await refresh();
    } catch (err) {
      onStatus?.({ type: 'error', message: err.message || 'Delete failed.' });
    }
  };

  const openRegisterModal = () => {
    setRegisterForm({ deviceId: '', initial_balance: '' });
    setRegisterResult(null);
    setRegisterOpen(true);
  };

  return (
    <div className="panel-card">
      <div className="panel-heading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div>Cards Management</div>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            Register a new blank card, then assign it to a customer later.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span className="badge badge-warning">Low balance: {lowBalanceCount}</span>
          <button className="btn-primary" onClick={openRegisterModal}>Register Card</button>
        </div>
      </div>

      {registerResult && (
        <div className="card" style={{ marginBottom: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.2)' }}>
          <div style={{ fontWeight: 800 }}>Last registered card</div>
          <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
            <div>
              Card ID:{' '}
              <span className="badge badge-success" style={{ fontFamily: 'monospace', letterSpacing: '0.08em' }}>
                {registerResult.card_uid}
              </span>
            </div>
            <div>
              {registerResult.rfid_uid ? (
                <>
                  Registered card <span style={{ fontFamily: 'monospace' }}>{registerResult.card_uid}</span> to RFID <span style={{ fontFamily: 'monospace' }}>{registerResult.rfid_uid}</span>
                </>
              ) : (
                <>
                  Registered card <span style={{ fontFamily: 'monospace' }}>{registerResult.card_uid}</span>. Waiting for RFID tap.
                </>
              )}
            </div>
            <div>Status: <span className={`badge ${registerResult.registration_status === 'registered' ? 'badge-success' : 'badge-warning'}`}>
              {registerResult.registration_status === 'registered' ? 'Registered' : 'Waiting tap'}
            </span></div>
          </div>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Card ID</th>
              <th>RFID</th>
              <th>Status</th>
              <th>Balance</th>
              <th>Active</th>
              <th style={{ width: 260 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.id}>
                <td>{c.customer_name || 'Unassigned'}</td>
                <td>
                  <span className="badge badge-success" style={{ fontFamily: 'monospace', letterSpacing: '0.08em' }}>
                    {c.card_uid}
                  </span>
                </td>
                <td style={{ fontFamily: 'monospace' }}>{c.rfid_uid || '-'}</td>
                <td>
                  <span className={`badge ${c.registration_status === 'registered' ? 'badge-success' : 'badge-warning'}`}>
                    {c.registration_status === 'registered' ? 'Registered' : 'Waiting tap'}
                  </span>
                </td>
                <td>{Number(c.balance_rwf).toLocaleString()} RWF</td>
                <td>
                  <span className={`badge ${c.is_active ? 'badge-success' : 'badge-danger'}`}>{c.is_active ? 'Active' : 'Disabled'}</span>
                </td>

                <td className="table-actions">
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => {
                      setRechargeForm({ cardId: c.id, amount_rwf: '' });
                      setRechargeOpen(true);
                    }}
                  >Recharge</button>
                  <button className="btn-secondary btn-sm" onClick={() => toggleActive(c)}>
                    {c.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button className="btn-secondary btn-sm" onClick={() => deleteCard(c)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!loading && cards.length === 0 && (
              <tr>
                <td colSpan={7} style={{ color: 'var(--muted)' }}>
                  No cards found. Use the Register Card button above to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {registerOpen && (
        <div className="modal-backdrop" onClick={() => setRegisterOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Register Card</h2>
              <button className="modal-close" onClick={() => setRegisterOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={submitRegister} className="form-grid">
                <label>
                  Device
                  <select
                    value={registerForm.deviceId}
                    onChange={(e) => setRegisterForm({ ...registerForm, deviceId: e.target.value })}
                    required
                  >
                    <option value="">Select hardware device</option>
                    {devices.map((device) => (
                      <option key={device.id} value={device.esp32_device_id}>
                        {device.device_label || device.location || device.esp32_device_id} ({device.esp32_device_id})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Initial Balance (RWF, optional)
                  <input
                    type="number"
                    min="0"
                    value={registerForm.initial_balance}
                    onChange={(e) => setRegisterForm({ ...registerForm, initial_balance: e.target.value })}
                    placeholder="0"
                  />
                </label>
                <div style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
                  Card ID is auto-generated. Select the device, click register, then tap a blank card on the reader. The backend keeps the card unassigned until the RFID tap is received.
                </div>
                {registerResult && (
                  <div className="card" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <div style={{ fontWeight: 800 }}>Card created</div>
                    <div style={{ marginTop: 8, fontFamily: 'monospace' }}>{registerResult.card_uid}</div>
                    <div style={{ marginTop: 8 }}>
                      {registerResult.rfid_uid ? (
                        <>
                          Registered card <span style={{ fontFamily: 'monospace' }}>{registerResult.card_uid}</span> to RFID <span style={{ fontFamily: 'monospace' }}>{registerResult.rfid_uid}</span>
                        </>
                      ) : (
                        <>
                          Registered card <span style={{ fontFamily: 'monospace' }}>{registerResult.card_uid}</span>. RFID waiting for tap.
                        </>
                      )}
                    </div>
                    <div style={{ marginTop: 8, color: 'var(--muted)' }}>
                      {registerResult.registration_status === 'registered' ? 'Card is registered.' : 'Waiting for RFID tap.'}
                    </div>
                  </div>
                )}

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setRegisterOpen(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={registering || !devices.length}>
                    {registering ? 'Registering...' : 'Register'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {rechargeOpen && (
        <div className="modal-backdrop" onClick={() => setRechargeOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Recharge Card</h2>
              <button className="modal-close" onClick={() => setRechargeOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={submitRecharge} className="form-grid">
                <label>
                  Amount (RWF)
                  <input
                    type="number"
                    min="1"
                    value={rechargeForm.amount_rwf}
                    onChange={(e) => setRechargeForm({ ...rechargeForm, amount_rwf: e.target.value })}
                    required
                  />
                </label>
                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setRechargeOpen(false)}>Cancel</button>
                  <button type="submit" className="btn-primary">Recharge</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

