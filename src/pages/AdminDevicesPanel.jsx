import { useEffect, useState } from 'react';
import { api } from '../services/api';

export default function AdminDevicesPanel({ onStatus }) {
  const [devices, setDevices] = useState([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ esp32_device_id: '', device_label: '', location: '', flow_rate_threshold: 50 });

  const refresh = async () => {
    try {
      const res = await api.adminListDevices();
      setDevices(res.devices || []);
    } catch (err) {
      onStatus?.({ type: 'error', message: err.message || 'Failed to load devices.' });
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.adminCreateDevice(form);
      onStatus?.({ type: 'success', message: 'Device created successfully.' });
      setOpen(false);
      setForm({ esp32_device_id: '', device_label: '', location: '', flow_rate_threshold: 50 });
      await refresh();
    } catch (err) {
      onStatus?.({ type: 'error', message: err.message || 'Failed to create device.' });
    } finally {
      setSaving(false);
    }
  };

  const registerDevice = async (deviceId) => {
    try {
      await api.adminRegisterDevice({ deviceId });
      onStatus?.({ type: 'success', message: 'Registration mode sent to device.' });
    } catch (err) {
      onStatus?.({ type: 'error', message: err.message || 'Failed to send registration mode.' });
    }
  };

  const deleteDevice = async (deviceId, deviceName) => {
    const confirmed = window.confirm(`Delete device "${deviceName || deviceId}"? This action cannot be undone.`);
    if (!confirmed) return;
    
    try {
      await api.adminDeleteDevice({ deviceId });
      onStatus?.({ type: 'success', message: `Device ${deviceId} deleted successfully.` });
      await refresh();
    } catch (err) {
      onStatus?.({ type: 'error', message: err.message || 'Failed to delete device.' });
    }
  };

  const getDeviceStatus = (device) => {
    if (device.status === 'online') {
      return { text: 'Online', variant: 'success', icon: '🟢' };
    }
    if (device.status === 'offline') {
      return { text: 'Offline', variant: 'danger', icon: '🔴' };
    }
    return { text: device.status || 'Unknown', variant: 'warning', icon: '⚠️' };
  };

  return (
    <div className="panel-card">
      {/* Header Section */}
      <div className="panel-heading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
        <h3>Hardware Device Management</h3>
        <button className="btn-primary btn-sm" onClick={() => setOpen(true)}>
          + Add Device
        </button>
      </div>

      {/* Statistics Summary */}
      {devices.length > 0 && (
        <div style={{ 
          display: 'flex', 
          gap: 'var(--space-md)', 
          flexWrap: 'wrap',
          marginBottom: 'var(--space-lg)',
          padding: 'var(--space-md)',
          background: 'var(--surface2)',
          borderRadius: 'var(--radius-lg)'
        }}>
          <div>
            <span className="badge badge-success">🟢 Online: {devices.filter(d => d.status === 'online').length}</span>
          </div>
          <div>
            <span className="badge badge-danger">🔴 Offline: {devices.filter(d => d.status === 'offline').length}</span>
          </div>
          <div>
            <span className="badge badge-info">📡 Total: {devices.length}</span>
          </div>
        </div>
      )}

      {/* Devices Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Device ID</th>
              <th>Name / Label</th>
              <th>Location</th>
              <th>Flow Threshold</th>
              <th>Status</th>
              <th>Last Seen</th>
              <th style={{ width: 200 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => {
              const status = getDeviceStatus(device);
              return (
                <tr key={device.id}>
                  <td>
                    <code style={{ 
                      background: 'rgba(0,0,0,0.05)', 
                      padding: '2px 6px', 
                      borderRadius: 'var(--radius-sm)',
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      letterSpacing: '0.05em'
                    }}>
                      {device.esp32_device_id}
                    </code>
                  </td>
                  <td>
                    <strong>{device.device_label || '—'}</strong>
                    {!device.device_label && (
                      <div className="profile-meta" style={{ fontSize: '0.7rem' }}>
                        No label set
                      </div>
                    )}
                  </td>
                  <td>{device.location || '—'}</td>
                  <td>
                    <span className="badge badge-info" style={{ fontFamily: 'monospace' }}>
                      {device.flow_rate_threshold || 50} L/min
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${status.variant}`}>
                      {status.icon} {status.text}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.75rem' }}>
                    {device.last_seen_at 
                      ? new Date(device.last_seen_at).toLocaleString() 
                      : 'Never'}
                  </td>
                  <td className="table-actions">
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() => registerDevice(device.esp32_device_id)}
                      title="Put device in registration mode for card pairing"
                    >
                      🔄 Register
                    </button>
                    <button
                      className="btn-danger btn-sm"
                      onClick={() => deleteDevice(device.esp32_device_id, device.device_label)}
                      title="Delete device permanently"
                    >
                      🗑️ Delete
                    </button>
                  </td>
                </tr>
              );
            })}
            {!devices.length && (
              <tr>
                <td colSpan="7" className="empty-state">
                  <div>🔌 No Hardware Devices Found</div>
                  <p className="section-text" style={{ marginTop: 'var(--space-sm)' }}>
                    Click the "Add Hardware Device" button to register your first ESP32 water dispenser.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Device Modal */}
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Register New Hardware Device</h2>
              <button className="modal-close" onClick={() => setOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <form className="form-grid" onSubmit={submit}>
                <label>
                  ESP32 Device ID *
                  <input
                    value={form.esp32_device_id}
                    onChange={(e) => setForm({ ...form, esp32_device_id: e.target.value })}
                    placeholder="e.g., ESP32_WASAC_001"
                    required
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Must match <code>DEVICE_ID</code> in your ESP32 firmware (e.g. <code>ESP32-001</code>)</small>
                </label>

                <label>
                  Device Name
                  <input
                    value={form.device_label}
                    onChange={(e) => setForm({ ...form, device_label: e.target.value })}
                    placeholder="e.g., Kicukiro Main Dispenser"
                  />
                </label>

                <label>
                  Location
                  <input
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="e.g., Kicukiro District"
                  />
                </label>

                <label>
                  Flow Rate Threshold (L/min)
                  <input
                    type="number"
                    min="1"
                    max="500"
                    step="5"
                    value={form.flow_rate_threshold}
                    onChange={(e) => setForm({ ...form, flow_rate_threshold: parseInt(e.target.value) || 50 })}
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Leak detection triggers above this value (default: 50)</small>
                </label>

                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? 'Creating...' : 'Create Device'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}