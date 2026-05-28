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
      onStatus?.({ type: 'success', message: 'Device created.' });
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
      onStatus?.({ type: 'success', message: 'Register mode sent to device.' });
    } catch (err) {
      onStatus?.({ type: 'error', message: err.message || 'Failed to send register mode.' });
    }
  };

  return (
    <div className="panel-card">
      <div className="panel-heading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span>Hardware Devices</span>
        <button className="btn-secondary" onClick={() => setOpen(true)}>Add Hardware Device</button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Device ID</th>
              <th>Name</th>
              <th>Location</th>
              <th>Status</th>
              <th>Last Seen</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => (
              <tr key={device.id}>
                <td style={{ fontFamily: 'monospace' }}>{device.esp32_device_id}</td>
                <td>{device.device_label || '-'}</td>
                <td>{device.location || '-'}</td>
                <td>
                  <span className={`badge ${device.status === 'online' ? 'badge-success' : 'badge-danger'}`}>
                    {device.status || 'offline'}
                  </span>
                </td>
                <td>{device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : '-'}</td>
                <td className="table-actions">
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => registerDevice(device.esp32_device_id)}
                  >
                    Register Device
                  </button>
                </td>
              </tr>
            ))}
            {!devices.length && (
              <tr>
                <td colSpan={6} style={{ color: 'var(--muted)' }}>No hardware devices found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Hardware Device</h2>
              <button className="modal-close" onClick={() => setOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <form className="form-grid" onSubmit={submit}>
                <label>
                  ESP32 Device ID
                  <input
                    value={form.esp32_device_id}
                    onChange={(e) => setForm({ ...form, esp32_device_id: e.target.value })}
                    placeholder="Must match the ID in the ESP32 code"
                    required
                  />
                </label>
                <label>
                  Device Name
                  <input
                    value={form.device_label}
                    onChange={(e) => setForm({ ...form, device_label: e.target.value })}
                    placeholder="Kicukiro dispense"
                  />
                </label>
                <label>
                  Location
                  <input
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="Kicukiro"
                  />
                </label>
                <label>
                  Flow Threshold
                  <input
                    type="number"
                    min="1"
                    value={form.flow_rate_threshold}
                    onChange={(e) => setForm({ ...form, flow_rate_threshold: e.target.value })}
                  />
                </label>
                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Create'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}