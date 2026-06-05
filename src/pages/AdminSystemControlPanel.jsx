import { useEffect, useState } from 'react';
import { api } from '../services/api';

export default function AdminSystemControlPanel({ onStatus }) {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [mqttConnected, setMqttConnected] = useState(false);
  const [devices, setDevices] = useState([]);
  const [registerForm, setRegisterForm] = useState({ esp32_device_id: '', location: '' });
  const [registering, setRegistering] = useState(false);

  const load = async () => {
    try {
      const res = await api.adminGetWaterFetchControl();
      setEnabled(!!res.water_fetch_enabled);
    } catch (e) {
      onStatus?.({ type: 'error', message: e.message || 'Failed to load system control.' });
    }
  };

  const loadDevices = async () => {
    try {
      const res = await api.adminListDevices();
      setDevices(res.devices || []);
    } catch (e) {
      onStatus?.({ type: 'error', message: e.message || 'Failed to load devices.' });
    }
  };

  const loadMqtt = async () => {
    try {
      const res = await api.adminGetMqttStatus();
      setMqttConnected(!!res.connected);
    } catch (e) {
      // don't spam errors for mqtt probe
      setMqttConnected(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { loadDevices(); loadMqtt(); }, []);

  const toggle = async () => {
    setLoading(true);
    try {
      const next = !enabled;
      await api.adminSetWaterFetchControl({ water_fetch_enabled: next });
      setEnabled(next);
      onStatus?.({ type: 'success', message: next ? 'Water fetching started.' : 'Water fetching stopped.' });
    } catch (e) {
      onStatus?.({ type: 'error', message: e.message || 'Update failed.' });
    } finally {
      setLoading(false);
    }
  };

  const registerDevice = async (e) => {
    e.preventDefault();
    setRegistering(true);
    try {
      const payload = { 
        esp32_device_id: registerForm.esp32_device_id, 
        device_label: registerForm.location, 
        location: registerForm.location 
      };
      await api.adminCreateDevice(payload);
      await api.adminRegisterDevice({ deviceId: registerForm.esp32_device_id });
      onStatus?.({ type: 'success', message: 'Device registered and register-mode sent successfully.' });
      setRegisterForm({ esp32_device_id: '', location: '' });
      await loadDevices();
      await loadMqtt();
    } catch (err) {
      onStatus?.({ type: 'error', message: err.message || 'Device registration failed.' });
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="panel-card">
      {/* Header Section */}
      <div className="panel-heading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
        <div>
          <h3>System Control Panel</h3>
          <p className="section-text" style={{ marginTop: 'var(--space-xs)' }}>
            Manage water fetching system and hardware devices
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
          <div className={`badge ${mqttConnected ? 'badge-success' : 'badge-danger'}`}>
            MQTT: {mqttConnected ? '● CONNECTED' : '○ DISCONNECTED'}
          </div>
        </div>
      </div>

      {/* Water Fetch Control Card */}
      <div className="card" style={{ marginBottom: 'var(--space-xl)', background: 'var(--surface2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-lg)', flexWrap: 'wrap' }}>
          <div>
            <div className="profile-meta" style={{ marginBottom: 'var(--space-sm)' }}>
              Water Fetch System Status
            </div>
            <div style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 700, marginBottom: 'var(--space-sm)' }}>
              {enabled ? (
                <span style={{ color: 'var(--success)' }}>✓ FETCHING ENABLED</span>
              ) : (
                <span style={{ color: 'var(--danger)' }}>✗ FETCHING STOPPED</span>
              )}
            </div>
            <div className="section-text" style={{ maxWidth: '500px' }}>
              {enabled 
                ? 'Water fetching is active. Users can create water sessions and consume water.' 
                : 'Water fetching is paused. No new water sessions will be created.'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
            <button 
              className={`btn-${enabled ? 'danger' : 'primary'}`} 
              onClick={toggle} 
              disabled={loading}
              style={{ minWidth: '160px' }}
            >
              {loading ? 'Processing...' : enabled ? '⏸️ Stop Water Fetch' : '▶️ Start Water Fetch'}
            </button>
          </div>
        </div>
      </div>

      {/* Hardware Devices Section */}
      <div>
        <div className="panel-heading" style={{ marginBottom: 'var(--space-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
            <div>
              <h3>Hardware Devices</h3>
              <p className="section-text" style={{ marginTop: 'var(--space-xs)' }}>
                Register and manage ESP32 water dispensing devices
              </p>
            </div>
          </div>
        </div>

        {/* Device Registration Form */}
        <div className="card" style={{ marginBottom: 'var(--space-xl)', background: 'var(--surface2)' }}>
          <div className="profile-meta" style={{ marginBottom: 'var(--space-md)', fontWeight: 600 }}>
            Register New Device
          </div>
          <form onSubmit={registerDevice} style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ fontSize: '0.75rem', marginBottom: 'var(--space-xs)' }}>
                Device ID (ESP32)
              </label>
              <input
                value={registerForm.esp32_device_id}
                onChange={(e) => setRegisterForm({ ...registerForm, esp32_device_id: e.target.value })}
                placeholder="e.g., ESP32_WASAC_001"
                required
              />
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ fontSize: '0.75rem', marginBottom: 'var(--space-xs)' }}>
                Location / Label
              </label>
              <input
                value={registerForm.location}
                onChange={(e) => setRegisterForm({ ...registerForm, location: e.target.value })}
                placeholder="e.g., Kicukiro Dispenser"
                required
              />
            </div>
            <button 
              className="btn-primary" 
              type="submit" 
              disabled={registering}
              style={{ marginBottom: '2px' }}
            >
              {registering ? 'Registering...' : '+ Register Device'}
            </button>
          </form>
          
          <div className="success-banner" style={{ marginTop: 'var(--space-md)', fontSize: '0.75rem', padding: 'var(--space-sm)' }}>
            💡 After registration, the device will enter registration mode. Tap an RFID card to complete the pairing.
          </div>
        </div>

        {/* Devices Table */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Device ID</th>
                <th>Name / Label</th>
                <th>Location</th>
                <th>Status</th>
                <th>Last Seen</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr key={device.id}>
                  <td>
                    <code style={{ 
                      background: 'rgba(0,0,0,0.05)', 
                      padding: '2px 6px', 
                      borderRadius: 'var(--radius-sm)',
                      fontFamily: 'monospace',
                      fontSize: '0.75rem'
                    }}>
                      {device.esp32_device_id}
                    </code>
                  </td>
                  <td>
                    <strong>{device.device_label || '—'}</strong>
                  </td>
                  <td>{device.location || '—'}</td>
                  <td>
                    <span className={`badge ${device.status === 'online' ? 'badge-success' : 'badge-danger'}`}>
                      {device.status === 'online' ? '🟢 Online' : '🔴 Offline'}
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
                      onClick={async () => {
                        try {
                          await api.adminRegisterDevice({ deviceId: device.esp32_device_id });
                          onStatus?.({ type: 'success', message: `Registration mode sent to ${device.esp32_device_id}` });
                        } catch (err) {
                          onStatus?.({ type: 'error', message: err.message });
                        }
                      }}
                      title="Put device in registration mode"
                    >
                      🔄 Re-register
                    </button>
                  </td>
                </tr>
              ))}
              {!devices.length && (
                <tr>
                  <td colSpan="6" className="empty-state">
                    <div>🔌 No hardware devices registered</div>
                    <p className="section-text" style={{ marginTop: 'var(--space-sm)' }}>
                      Use the form above to register your first ESP32 water dispenser device.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}