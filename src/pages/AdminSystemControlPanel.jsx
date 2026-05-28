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

  return (
    <div className="panel-card">
      <div className="panel-heading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>System Water Fetch Control</span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: mqttConnected ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
            MQTT: {mqttConnected ? 'CONNECTED' : 'DISCONNECTED'}
          </div>
        </div>
      </div>

      <div style={{ background: '#eaf2fc', border: '1px solid rgba(100,116,139,0.22)', borderRadius: 18, padding: 18, color: '#0f172a' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: 12 }}>
              Current status
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, marginTop: 8 }}>
              {enabled ? (
                <span style={{ color: 'var(--success)' }}>FETCHING ENABLED</span>
              ) : (
                <span style={{ color: 'var(--danger)' }}>FETCHING STOPPED</span>
              )}
            </div>
            <div style={{ color: '#334155', marginTop: 6, lineHeight: 1.7 }}>
              When stopped, the backend will block authorization and no ACTIVE water sessions will be created.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={toggle} disabled={loading}>
              {loading ? 'Updating...' : enabled ? 'Stop Water Fetch' : 'Start Water Fetch'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18, background: '#eaf2fc', border: '1px solid rgba(100,116,139,0.22)', borderRadius: 18, padding: 18, color: '#0f172a' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <strong>Registered Hardware Devices</strong>
          </div>
          <div>
            <form style={{ display: 'flex', gap: 8, alignItems: 'center' }} onSubmit={async (e) => {
              e.preventDefault();
              setRegistering(true);
              try {
                const payload = { esp32_device_id: registerForm.esp32_device_id, device_label: registerForm.location, location: registerForm.location };
                await api.adminCreateDevice(payload);
                await api.adminRegisterDevice({ deviceId: registerForm.esp32_device_id });
                onStatus?.({ type: 'success', message: 'Device registered and register-mode sent.' });
                setRegisterForm({ esp32_device_id: '', location: '' });
                await loadDevices();
                await loadMqtt();
              } catch (err) {
                onStatus?.({ type: 'error', message: err.message || 'Register failed.' });
              } finally {
                setRegistering(false);
              }
            }}>
              <input value={registerForm.esp32_device_id} onChange={(e) => setRegisterForm({ ...registerForm, esp32_device_id: e.target.value })} placeholder="Device ID (esp32)" required />
              <input value={registerForm.location} onChange={(e) => setRegisterForm({ ...registerForm, location: e.target.value })} placeholder="Location (e.g. kicukiro-dispense)" required />
              <button className="btn-primary" type="submit" disabled={registering}>{registering ? 'Registering...' : 'Register Device'}</button>
            </form>
          </div>
        </div>

        <div style={{ marginTop: 12, overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Device ID</th>
                <th>Name</th>
                <th>Location</th>
                <th>Status</th>
                <th>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr key={device.id}>
                  <td style={{ fontFamily: 'monospace' }}>{device.esp32_device_id}</td>
                  <td>{device.device_label || '-'}</td>
                  <td>{device.location || '-'}</td>
                  <td><span className={`badge ${device.status === 'online' ? 'badge-success' : 'badge-danger'}`}>{device.status || 'offline'}</span></td>
                  <td>{device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : '-'}</td>
                </tr>
              ))}
              {!devices.length && (
                <tr><td colSpan={5} style={{ color: '#475569' }}>No devices registered.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

