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
    
  const [rfidOpen, setRfidOpen] = useState(false);
  const [rfidForm, setRfidForm] = useState({ cardId: '', deviceId: '' });
  const [rfidScanning, setRfidScanning] = useState(false);
  const [rfidIntervalId, setRfidIntervalId] = useState(null);

  const closeRfidModal = () => {
    if (rfidIntervalId) {
      clearInterval(rfidIntervalId);
      setRfidIntervalId(null);
    }
    setRfidOpen(false);
    setRfidForm({ cardId: '', deviceId: '' });
    setRfidScanning(false);
  };

  useEffect(() => {
    return () => {
      if (rfidIntervalId) clearInterval(rfidIntervalId);
    };
  }, [rfidIntervalId]);

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

  const submitRfid = async (e) => {
    e.preventDefault();
    if (!rfidForm.deviceId || !rfidForm.cardId) return;
    setRfidScanning(true);
    try {
      await api.adminPrepareCardScan({
        cardId: rfidForm.cardId,
        deviceId: rfidForm.deviceId,
      });

      const selectedDeviceObj = devices.find(d => d.esp32_device_id === rfidForm.deviceId);
      const deviceLabel = selectedDeviceObj?.device_label || selectedDeviceObj?.location || rfidForm.deviceId;

      onStatus?.({ type: 'info', message: `Scan initiated. Please tap your card on ${deviceLabel}.` });

      // Start polling for rfid_uid update
      const intervalId = setInterval(async () => {
        try {
          const res = await api.adminListCards();
          const updatedCard = res.cards?.find(c => c.id === rfidForm.cardId);
          if (updatedCard && updatedCard.rfid_uid) {
            clearInterval(intervalId);
            setRfidIntervalId(null);
            setRfidScanning(false);
            setRfidOpen(false);
            onStatus?.({ type: 'success', message: `Card ${updatedCard.card_uid} linked to RFID ${updatedCard.rfid_uid} successfully!` });
            await refresh();
          }
        } catch (err) {
          console.error('Error polling card:', err);
        }
      }, 2000);

      setRfidIntervalId(intervalId);
    } catch (err) {
      setRfidScanning(false);
      onStatus?.({ type: 'error', message: err.message || 'Failed to start RFID scan.' });
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
    const confirmed = window.confirm(`Delete card ${card.card_uid}? This action cannot be undone.`);
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
      {/* Header Section */}
      <div className="panel-heading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
        <div>
          <h3>Smart Card Management</h3>
          <p className="section-text" style={{ marginTop: 'var(--space-xs)' }}>
            Register new RFID cards, manage balances, and assign to customers
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
          {lowBalanceCount > 0 && (
            <span className="badge badge-warning">
              ⚠️ Low Balance: {lowBalanceCount}
            </span>
          )}
          <button className="btn-primary" onClick={openRegisterModal}>
            + Register New Card
          </button>
        </div>
      </div>

      {/* Recently Registered Card Alert */}
      {registerResult && (
        <div className="success-banner" style={{ marginBottom: 'var(--space-lg)' }}>
          <div style={{ fontWeight: 700, marginBottom: 'var(--space-sm)' }}>
            ✓ Card Successfully Registered
          </div>
          <div style={{ display: 'grid', gap: 'var(--space-xs)', fontSize: '0.875rem' }}>
            <div>
              <strong>Card ID:</strong>{' '}
              <code style={{ 
                background: 'rgba(0,0,0,0.1)', 
                padding: '2px 6px', 
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'monospace',
                letterSpacing: '0.08em'
              }}>
                {registerResult.card_uid}
              </code>
            </div>
            <div>
              {registerResult.rfid_uid ? (
                <>
                  <strong>RFID UID:</strong>{' '}
                  <code style={{ fontFamily: 'monospace' }}>{registerResult.rfid_uid}</code>
                </>
              ) : (
                <span className="badge badge-warning">⏳ Waiting for RFID tap on device</span>
              )}
            </div>
            <div>
              <strong>Status:</strong>{' '}
              <span className={`badge ${registerResult.registration_status === 'registered' ? 'badge-success' : 'badge-warning'}`}>
                {registerResult.registration_status === 'registered' ? 'Registered ✓' : 'Pending Scan'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Cards Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Card ID</th>
              <th>RFID UID</th>
              <th>Status</th>
              <th>Balance (RWF)</th>
              <th>Active</th>
              <th style={{ width: 280 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.customer_name || 'Unassigned'}</strong>
                  {!c.customer_name && (
                    <div className="profile-meta" style={{ fontSize: '0.7rem', marginTop: '2px' }}>
                      No owner assigned
                    </div>
                  )}
                </td>
                <td>
                  <code style={{ 
                    background: 'rgba(0,0,0,0.05)', 
                    padding: '2px 6px', 
                    borderRadius: 'var(--radius-sm)',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    letterSpacing: '0.08em'
                  }}>
                    {c.card_uid}
                  </code>
                </td>
                <td>
                  {c.rfid_uid ? (
                    <code style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{c.rfid_uid}</code>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                      <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>Not scanned</span>
                      <button 
                        className="btn-secondary btn-sm" 
                        style={{ padding: '2px 8px', fontSize: '0.7rem', display: 'inline-flex' }}
                        onClick={() => {
                          setRfidForm({ cardId: c.id, deviceId: '' });
                          setRfidOpen(true);
                        }}
                        title="Set RFID UID via device tap"
                      >
                        ✏️ Link RFID
                      </button>
                    </div>
                  )}
                </td>
                <td>
                  <span className={`badge ${c.registration_status === 'registered' ? 'badge-success' : 'badge-warning'}`}>
                    {c.registration_status === 'registered' ? 'Registered' : 'Pending'}
                  </span>
                </td>
                <td>
                  <span style={{ fontWeight: 600, color: Number(c.balance_rwf) < 1000 ? 'var(--warning)' : 'inherit' }}>
                    {Number(c.balance_rwf).toLocaleString()}
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}> RWF</span>
                </td>
                <td>
                  <span className={`badge ${c.is_active ? 'badge-success' : 'badge-danger'}`}>
                    {c.is_active ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="table-actions">
                  <button
                    className="btn-primary btn-sm"
                    onClick={() => {
                      setRechargeForm({ cardId: c.id, amount_rwf: '' });
                      setRechargeOpen(true);
                    }}
                    disabled={!c.rfid_uid}
                    title={c.rfid_uid ? "Add credit to card" : "Card must be scanned first"}
                  >
                    💰 Recharge
                  </button>
                  <button 
                    className="btn-secondary btn-sm" 
                    onClick={() => toggleActive(c)}
                    title={c.is_active ? 'Disable card' : 'Activate card'}
                  >
                    {c.is_active ? '🔒 Deactivate' : '✓ Activate'}
                  </button>
                  <button 
                    className="btn-danger btn-sm" 
                    onClick={() => deleteCard(c)}
                    title="Delete card permanently"
                  >
                    🗑️ Delete
                  </button>
                </td>
              </tr>
            ))}
            {!loading && cards.length === 0 && (
              <tr>
                <td colSpan="7" className="empty-state">
                  <div>📇 No cards found</div>
                  <p className="section-text" style={{ marginTop: 'var(--space-sm)' }}>
                    Use the "Register New Card" button above to create your first RFID card.
                  </p>
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan="7" className="text-center">
                  <div className="app-loading" style={{ minHeight: '200px' }}>
                    Loading cards...
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Register Card Modal */}
      {registerOpen && (
        <div className="modal-backdrop" onClick={() => setRegisterOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Register New RFID Card</h2>
              <button className="modal-close" onClick={() => setRegisterOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={submitRegister} className="form-grid">
                <label>
                  Select Hardware Device
                  <select
                    value={registerForm.deviceId}
                    onChange={(e) => setRegisterForm({ ...registerForm, deviceId: e.target.value })}
                    required
                  >
                    <option value="">Choose a device...</option>
                    {devices.map((device) => (
                      <option key={device.id} value={device.esp32_device_id}>
                        {device.device_label || device.location || device.esp32_device_id} 
                        {device.is_online && ' 🟢'}
                        {!device.is_online && ' 🔴'}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Initial Balance (Optional)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={registerForm.initial_balance}
                    onChange={(e) => setRegisterForm({ ...registerForm, initial_balance: e.target.value })}
                    placeholder="0 RWF"
                  />
                </label>

                <div className="success-banner" style={{ fontSize: '0.75rem', padding: 'var(--space-sm)' }}>
                  <strong>ℹ️ How it works:</strong>
                  <ol style={{ marginTop: 'var(--space-sm)', marginLeft: 'var(--space-lg)', lineHeight: '1.6' }}>
                    <li>Select a device and click register</li>
                    <li>Tap a blank RFID card on the selected device reader</li>
                    <li>The card will be automatically registered and ready for assignment</li>
                  </ol>
                </div>

                {!devices.length && (
                  <div className="alert-banner" style={{ fontSize: '0.75rem' }}>
                    ⚠️ No devices available. Please add a hardware device first.
                  </div>
                )}

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setRegisterOpen(false)}>
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn-primary" 
                    disabled={registering || !devices.length}
                  >
                    {registering ? 'Registering...' : 'Register Card'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Recharge Card Modal */}
      {rechargeOpen && (() => {
        const cardToRecharge = cards.find(c => c.id === rechargeForm.cardId);
        const currentBalance = cardToRecharge ? Number(cardToRecharge.balance_rwf) : 0;
        const addedAmount = Number(rechargeForm.amount_rwf) || 0;
        const newBalance = currentBalance + addedAmount;
        return (
          <div className="modal-backdrop" onClick={() => setRechargeOpen(false)}>
            <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Recharge Card Balance</h2>
                <button className="modal-close" onClick={() => setRechargeOpen(false)}>×</button>
              </div>
              <div className="modal-body">
                <div style={{ marginBottom: 'var(--space-md)', background: 'var(--surface2)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-xs)' }}>
                    <span className="profile-meta">Card ID:</span>
                    <strong style={{ fontFamily: 'monospace' }}>{cardToRecharge?.card_uid}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-xs)' }}>
                    <span className="profile-meta">Current Balance:</span>
                    <strong>{currentBalance.toLocaleString()} RWF</strong>
                  </div>
                  {addedAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-xs)', borderTop: '1px dashed var(--border)', paddingTop: 'var(--space-xs)' }}>
                      <span className="profile-meta" style={{ color: 'var(--success)' }}>New Balance:</span>
                      <strong style={{ color: 'var(--success)' }}>{newBalance.toLocaleString()} RWF</strong>
                    </div>
                  )}
                </div>

                <form onSubmit={submitRecharge} className="form-grid">
                  <label>
                    Amount to Add (RWF)
                    <input
                      type="number"
                      min="100"
                      step="1"
                      value={rechargeForm.amount_rwf}
                      onChange={(e) => setRechargeForm({ ...rechargeForm, amount_rwf: e.target.value })}
                      required
                      autoFocus
                      placeholder="Enter amount to add in RWF"
                    />
                  </label>

                  <div className="success-banner" style={{ fontSize: '0.75rem', padding: 'var(--space-sm)' }}>
                    <strong>💡 Tip:</strong> Minimum recharge is 100 RWF. The balance will be updated immediately.
                  </div>

                  <div className="modal-actions">
                    <button type="button" className="btn-secondary" onClick={() => setRechargeOpen(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary">
                      Process Recharge
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Link RFID Modal */}
      {rfidOpen && (
        <div className="modal-backdrop" onClick={closeRfidModal}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Link RFID Card</h2>
              <button className="modal-close" onClick={closeRfidModal}>×</button>
            </div>
            <div className="modal-body">
              {!rfidScanning ? (
                <form onSubmit={submitRfid} className="form-grid">
                  <label>
                    Select Registration Device
                    <select
                      value={rfidForm.deviceId}
                      onChange={(e) => setRfidForm({ ...rfidForm, deviceId: e.target.value })}
                      required
                    >
                      <option value="">Choose a device...</option>
                      {devices.map((device) => (
                        <option key={device.id} value={device.esp32_device_id}>
                          {device.device_label || device.location || device.esp32_device_id} 
                          {device.is_online && ' 🟢'}
                          {!device.is_online && ' 🔴'}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="success-banner" style={{ fontSize: '0.75rem', padding: 'var(--space-sm)' }}>
                    <strong>ℹ️ How it works:</strong>
                    <ol style={{ marginTop: 'var(--space-sm)', marginLeft: 'var(--space-lg)', lineHeight: '1.6' }}>
                      <li>Select a device and click Link RFID</li>
                      <li>Go to the device and tap your physical RFID card on the reader</li>
                      <li>The card will be linked automatically</li>
                    </ol>
                  </div>

                  {!devices.length && (
                    <div className="alert-banner" style={{ fontSize: '0.75rem' }}>
                      ⚠️ No devices available. Please add a hardware device first.
                    </div>
                  )}

                  <div className="modal-actions">
                    <button type="button" className="btn-secondary" onClick={closeRfidModal}>
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="btn-primary" 
                      disabled={!devices.length}
                    >
                      Start Scan
                    </button>
                  </div>
                </form>
              ) : (
                <div style={{ textAlign: 'center', padding: 'var(--space-xl) 0' }}>
                  <div className="app-loading" style={{ minHeight: '80px', marginBottom: 'var(--space-md)' }}>
                    ⏳ Waiting for card tap...
                  </div>
                  <h3 style={{ color: 'var(--primary-light)' }}>Tap card on {
                    devices.find(d => d.esp32_device_id === rfidForm.deviceId)?.device_label || 
                    devices.find(d => d.esp32_device_id === rfidForm.deviceId)?.location || 
                    rfidForm.deviceId
                  }</h3>
                  <p className="section-text" style={{ marginTop: 'var(--space-sm)' }}>
                    Please tap the physical RFID card against the RFID reader of the selected device to link it.
                  </p>
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    style={{ marginTop: 'var(--space-xl)', marginInline: 'auto' }}
                    onClick={closeRfidModal}
                  >
                    Cancel Scan
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}