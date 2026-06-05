import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import KpiCard from '../components/KpiCard';
import LeakAlerts from '../components/LeakAlerts';
import Modal from '../components/Modal';
import { UsageBarChart, UsageLineChart } from '../components/UsageChart';
import { api, downloadBlob } from '../services/api';
import AdminSystemControlPanel from './AdminSystemControlPanel';
import AdminCardsPanel from './AdminCardsPanel';
import AdminDevicesPanel from './AdminDevicesPanel';

const nav = [
  { to: '/', label: 'Home' },
  { to: '/admin', label: 'Overview' },
  { to: '/admin/system', label: 'System Control' },
  { to: '/admin/devices', label: 'Hardware Devices' },
  { to: '/admin/cards', label: 'Cards' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/alerts', label: 'Leak Alerts' },
  { to: '/admin/reports', label: 'Reports' },
];

const getSectionFromPath = (pathname) => {
  const path = pathname.split('/').filter(Boolean).pop();
  return path === 'admin' || !path ? 'overview' : path;
};

const roleOptions = [
  { value: 'customer', label: 'Customer' },
  { value: 'wasac_manager', label: 'Manager' },
];

export default function AdminDashboard() {
  const location = useLocation();
  const tab = getSectionFromPath(location.pathname);
  const { profile } = useAuth();
  const [stats, setStats] = useState(null);
  const [graph, setGraph] = useState([]);
  const [topConsumers, setTopConsumers] = useState([]);
  const [waterLoss, setWaterLoss] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [users, setUsers] = useState([]);
  const [adminCards, setAdminCards] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTargetUser, setAssignTargetUser] = useState(null);
  const [assignCardId, setAssignCardId] = useState('');
  const [status, setStatus] = useState(null);
  const [newUser, setNewUser] = useState({ username: '', password: '12345678', full_name: '', role: 'customer', assigned_card_id: '' });
  const [saving, setSaving] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const [mqttConnected, setMqttConnected] = useState(false);
  const [waterFetchEnabled, setWaterFetchEnabled] = useState(true);
  const [devices, setDevices] = useState([]);

  const load = async () => {
    try {
      const [
        overview,
        graphData,
        top,
        loss,
        alertData,
        userData,
        cardData,
        mqttRes,
        fetchControlRes,
        devicesRes
      ] = await Promise.allSettled([
        api.overview(),
        api.usageGraph('monthly'),
        api.topConsumers(),
        api.waterLoss(),
        api.leakAlerts(false),
        api.users(),
        api.adminListCards(),
        api.adminGetMqttStatus(),
        api.adminGetWaterFetchControl(),
        api.adminListDevices(),
      ]);

      if (overview.status === 'fulfilled') setStats(overview.value.stats);
      if (graphData.status === 'fulfilled') setGraph(graphData.value.data || []);
      if (top.status === 'fulfilled') setTopConsumers(top.value.data || []);
      if (loss.status === 'fulfilled') setWaterLoss(loss.value.report);
      if (alertData.status === 'fulfilled') setAlerts(alertData.value.alerts || []);
      if (userData.status === 'fulfilled') setUsers(userData.value.users || []);
      if (cardData.status === 'fulfilled') setAdminCards(cardData.value.cards || []);
      if (mqttRes.status === 'fulfilled') setMqttConnected(!!mqttRes.value.connected);
      if (fetchControlRes.status === 'fulfilled') setWaterFetchEnabled(!!fetchControlRes.value.water_fetch_enabled);
      if (devicesRes.status === 'fulfilled') setDevices(devicesRes.value.devices || []);

      const failed = [overview, graphData, top, loss, alertData, userData, cardData].filter((result) => result.status === 'rejected');
      if (failed.length) {
        setStatus({
          type: 'error',
          message: failed[0].reason?.message || 'Some dashboard data could not be loaded.',
        });
      }
    } catch (e) {
      console.error(e);
      setStatus({ type: 'error', message: e.message || 'Failed to load dashboard data.' });
    }
  };

  useEffect(() => { load(); }, []);

  const resolveAlert = async (id) => {
    try {
      await api.resolveAlert(id);
      setStatus({ type: 'success', message: 'Alert resolved successfully.' });
      load();
    } catch (e) {
      setStatus({ type: 'error', message: e.message });
    }
  };

  const downloadRevenue = async () => {
    try {
      const from = new Date(new Date().setDate(1)).toISOString().split('T')[0];
      const to = new Date().toISOString().split('T')[0];
      const blob = await api.downloadRevenue(from, to);
      downloadBlob(blob, `revenue-${from}.pdf`);
      setStatus({ type: 'success', message: 'Report downloaded successfully.' });
    } catch (e) {
      setStatus({ type: 'error', message: e.message });
    }
  };

  const saveUserRole = async (userId, role) => {
    try {
      await api.updateUserRole(userId, { role });
      setStatus({ type: 'success', message: 'User role updated.' });
      setUsers((current) => current.map((user) => (user.user_id === userId ? { ...user, role } : user)));
    } catch (e) {
      setStatus({ type: 'error', message: e.message });
    }
  };

  const userHasCard = (userId) => adminCards.some((card) => card.user_id === userId);

  const openAssignCardModal = (user) => {
    setAssignTargetUser(user);
    setAssignCardId('');
    setShowAssignModal(true);
  };

  const closeAssignCardModal = () => {
    setShowAssignModal(false);
    setAssignTargetUser(null);
    setAssignCardId('');
  };

  const assignCardToUser = async (e) => {
    e.preventDefault();
    if (!assignTargetUser || !assignCardId) return;
    setSaving(true);
    try {
      await api.adminAssignCard({ cardId: assignCardId, userId: assignTargetUser.user_id });
      setStatus({ type: 'success', message: 'Card assigned successfully.' });
      closeAssignCardModal();
      load();
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Card assignment failed.' });
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (userId) => {
    const confirmed = window.confirm('Delete this user? This action cannot be undone.');
    if (!confirmed) return;
    try {
      await api.deleteUser(userId);
      setStatus({ type: 'success', message: 'User deleted successfully.' });
      setUsers((current) => current.filter((user) => user.user_id !== userId));
    } catch (e) {
      setStatus({ type: 'error', message: e.message });
    }
  };

  const openUserModal = (user = null) => {
    setEditingUser(user);
    setNewUser({
      username: user?.email || user?.username || '',
      password: '12345678',
      full_name: user?.full_name || '',
      role: user?.role || 'customer',
    });
    setShowUserModal(true);
  };

  const closeUserModal = () => {
    setShowUserModal(false);
    setEditingUser(null);
    setNewUser({ username: '', password: '12345678', full_name: '', role: 'customer' });
  };

  const createUser = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingUser) {
        await api.updateUserRole(editingUser.user_id, { role: newUser.role });
        setStatus({ type: 'success', message: 'User role updated successfully.' });
      } else {
        const loginEmail = newUser.username?.trim();
        if (!loginEmail) {
          throw new Error('Email is required.');
        }

        const payload = {
          ...newUser,
          email: loginEmail,
          username: loginEmail,
        };

        await api.adminCreateUser(payload);
        setStatus({ type: 'success', message: 'User created successfully.' });
      }
      closeUserModal();
      load();
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout navItems={nav}>
      <div className="dashboard-page">
        {/* Header Section */}
          <div className="admin-header-row">
            <div>
              <p className="admin-breadcrumb">
                Admin / {tab === 'overview' ? 'Overview' : tab === 'system' ? 'System Control' : tab === 'devices' ? 'Hardware Devices' : tab === 'users' ? 'Users' : tab === 'alerts' ? 'Leak Alerts' : 'Reports'}
              </p>
              <h1 className="admin-heading">
                {tab === 'overview'
                  ? `Welcome back, ${profile?.full_name || 'Administrator'}`
                  : tab === 'system'
                  ? 'System Control Panel'
                  : tab === 'devices'
                  ? 'Hardware Device Management'
                  : tab === 'users'
                  ? 'User Management'
                  : tab === 'alerts'
                  ? 'Leak Detection & Alerts'
                  : 'Analytics & Reports'}
              </h1>
              <p className="admin-subtitle">
                {tab === 'overview'
                  ? 'Monitor water usage, manage users, and resolve leaks from one central dashboard.'
                  : tab === 'system'
                  ? 'Control the backend water-fetch switch and monitor system health.'
                  : tab === 'devices'
                  ? 'Create and manage ESP32 hardware devices, assign locations, and monitor online status.'
                  : tab === 'users'
                  ? 'Create, edit, and manage user accounts across the WASAC water management system.'
                  : tab === 'alerts'
                  ? 'Review active leak alerts and resolve potential issues before they become critical.'
                  : 'Export detailed reports and track revenue summary data.'}
              </p>
            </div>
            <div className="admin-cta-row">
              <input 
                className="admin-search" 
                placeholder="Search users, devices..." 
                aria-label="Search"
              />
              <button className="btn-secondary btn-sm" onClick={() => openUserModal()}>
                Add User
              </button>
              <button className="btn-primary btn-sm" onClick={downloadRevenue}>
                Export Revenue
              </button>
            </div>
          </div>

          {/* Status Messages */}
          {status && (
            <div className={`status-banner ${status.type === 'error' ? 'status-error' : 'status-success'}`}>
              <span>{status.message}</span>
              {status.type === 'error' && (
                <button className="btn-secondary btn-sm" onClick={load}>Retry</button>
              )}
            </div>
          )}

          {/* Overview Tab */}
          {tab === 'overview' && (
            <>
              {/* System Status Overview Panel */}
              <div className="admin-profile-card" style={{ padding: 'var(--space-md) var(--space-xl)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-lg)', marginBottom: 'var(--space-xl)' }}>
                {/* MQTT Column */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                  <div style={{ fontSize: '1.75rem' }}>🔌</div>
                  <div>
                    <div className="profile-meta" style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>MQTT Status</div>
                    <div style={{ marginTop: '2px' }}>
                      <span className={`badge ${mqttConnected ? 'badge-success' : 'badge-danger'}`} style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                        {mqttConnected ? '● Connected' : '○ Disconnected'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Water Fetch Column */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                  <div style={{ fontSize: '1.75rem' }}>💧</div>
                  <div>
                    <div className="profile-meta" style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Water Dispensing</div>
                    <div style={{ marginTop: '2px' }}>
                      <span className={`badge ${waterFetchEnabled ? 'badge-success' : 'badge-warning'}`} style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                        {waterFetchEnabled ? '✓ Active' : '⏸️ Suspended'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Devices Column */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                  <div style={{ fontSize: '1.75rem' }}>📟</div>
                  <div>
                    <div className="profile-meta" style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Devices Connected</div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', marginTop: '2px', color: 'var(--text-primary)' }}>
                      {devices.filter(d => d.status === 'online').length} / {devices.length} Online
                    </div>
                  </div>
                </div>

                {/* Alerts Column */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                  <div style={{ fontSize: '1.75rem' }}>🚨</div>
                  <div>
                    <div className="profile-meta" style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>System Alerts</div>
                    <div style={{ marginTop: '2px' }}>
                      <span className={`badge ${alerts.filter(a => !a.resolved).length > 0 ? 'badge-danger' : 'badge-success'}`} style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                        {alerts.filter(a => !a.resolved).length} Active Leaks
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* KPI Grid */}
              <div className="admin-kpi-row">
                <KpiCard 
                  label="Total Revenue" 
                  value={stats?.totalRevenue?.toLocaleString() || '0'} 
                  suffix="RWF" 
                  variant="success" 
                />
                <KpiCard 
                  label="Water Consumed" 
                  value={stats?.totalWaterLiters?.toLocaleString() || '0'} 
                  suffix="L" 
                />
                <KpiCard 
                  label="Active Customers" 
                  value={stats?.activeUsers || 0} 
                />
                <KpiCard 
                  label="Open Leak Alerts" 
                  value={stats?.activeLeaks || 0} 
                  variant={stats?.activeLeaks > 0 ? 'danger' : ''} 
                />
              </div>

              {/* Main Grid */}
              <div className="admin-grid">
                <div className="panel-card panel-wide">
                  <div className="panel-heading">Water Usage Overview</div>
                  <UsageBarChart data={graph} />
                </div>
                <div className="panel-card panel-small">
                  <div className="panel-heading">Leak Risk Summary</div>
                  <div className="metric-block">
                    <div className="metric-value">{waterLoss?.estimatedLossLiters?.toLocaleString() || 0} L</div>
                    <div className="metric-label">Estimated Water Loss</div>
                  </div>
                  <div className="metric-block">
                    <div className="metric-value">{waterLoss?.estimatedRevenueLoss?.toLocaleString() || 0} RWF</div>
                    <div className="metric-label">Estimated Revenue Loss</div>
                  </div>
                  <div className="metric-block">
                    <div className="metric-value">{alerts.filter((a) => !a.resolved).length}</div>
                    <div className="metric-label">Active Leak Alerts</div>
                  </div>
                </div>
              </div>

              {/* Three Column Grid */}
              <div className="admin-grid-3">
                <div className="panel-card">
                  <div className="panel-heading">Top Water Consumers</div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th>Monthly Usage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topConsumers.slice(0, 5).map((c) => (
                          <tr key={c.user_id}>
                            <td>{c.full_name || 'Anonymous'}</td>
                            <td>{(c.total_ml / 1000).toLocaleString()} L</td>
                          </tr>
                        ))}
                        {topConsumers.length === 0 && (
                          <tr>
                            <td colSpan="2" className="text-center">No data available</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="panel-card">
                  <div className="panel-heading">30-Day Usage Trend</div>
                  <UsageLineChart data={graph} />
                </div>
                <div className="panel-card">
                  <div className="panel-heading">Recent Alerts</div>
                  <LeakAlerts alerts={alerts.slice(0, 3)} onResolve={resolveAlert} />
                </div>
              </div>
            </>
          )}

          {/* System Control Tab */}
          {tab === 'system' && (
            <AdminSystemControlPanel onStatus={setStatus} />
          )}

          {/* Hardware Devices Tab */}
          {tab === 'devices' && (
            <AdminDevicesPanel onStatus={setStatus} />
          )}

          {/* Cards Tab */}
          {tab === 'cards' && (
            <AdminCardsPanel onStatus={setStatus} />
          )}

          {/* Users Tab */}
          {tab === 'users' && (
            <div className="panel-card">
              <div className="panel-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
                <div>
                  <h3>System Users</h3>
                  <p className="section-text">Manage all user accounts and their access levels.</p>
                </div>
                <button className="btn-primary btn-sm" onClick={() => openUserModal()}>
                  + Add New User
                </button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Joined</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <strong>{u.full_name || u.username || u.email || '-'}</strong>
                          <div className="profile-meta" style={{ fontSize: '0.75rem' }}>
                            @{u.username || u.email?.split('@')[0]}
                          </div>
                        </td>
                        <td>{u.email || '-'}</td>
                        <td>
                          <span className={`badge badge-${u.role === 'admin' ? 'success' : u.role === 'wasac_manager' ? 'warning' : 'info'}`}>
                            {u.role === 'wasac_manager' ? 'Manager' : u.role}
                          </span>
                        </td>
                        <td>
                          <span className={`badge badge-${u.account_status === 'approved' ? 'success' : u.account_status === 'pending' ? 'warning' : 'danger'}`}>
                            {u.account_status || 'approved'}
                          </span>
                        </td>
                        <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
                        <td className="table-actions">
                          {u.role !== 'admin' && (
                            <>
                              {!userHasCard(u.user_id) && (
                                <button 
                                  className="btn-secondary btn-sm" 
                                  onClick={() => openAssignCardModal(u)}
                                  title="Assign RFID card"
                                >
                                  Assign Card
                                </button>
                              )}
                              <button 
                                className="btn-secondary btn-sm" 
                                onClick={() => openUserModal(u)}
                                title="Edit user"
                              >
                                Edit
                              </button>
                              <button 
                                className="btn-danger btn-sm" 
                                onClick={() => deleteUser(u.user_id)}
                                title="Delete user"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan="6" className="text-center">No users found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Reports Tab */}
          {tab === 'reports' && (
            <div className="panel-card">
              <div className="panel-heading">Financial & Usage Reports</div>
              <p className="section-text">
                Generate and download comprehensive reports about water usage, revenue collection, 
                and system performance. Reports are available in PDF format.
              </p>
              <div style={{ marginTop: 'var(--space-xl)' }}>
                <button className="btn-primary" onClick={downloadRevenue}>
                  Download Monthly Revenue Report
                </button>
              </div>
            </div>
          )}

          {/* Alerts Tab */}
          {tab === 'alerts' && (
            <div className="panel-card">
              <div className="panel-heading">Leak Detection System</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Message</th>
                      <th>Severity</th>
                      <th>Reason</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((a) => (
                      <tr key={a.id}>
                        <td>{a.message}</td>
                        <td>
                          <span className={`badge badge-${a.severity === 'critical' ? 'danger' : 'warning'}`}>
                            {a.severity || 'moderate'}
                          </span>
                        </td>
                        <td>{a.reason || 'Suspected leak detected'}</td>
                        <td>{new Date(a.created_at).toLocaleDateString()}</td>
                        <td>
                          <span className={`badge badge-${a.resolved ? 'success' : 'danger'}`}>
                            {a.resolved ? 'Resolved' : 'Active'}
                          </span>
                        </td>
                        <td>
                          {!a.resolved && (
                            <button 
                              className="btn-primary btn-sm" 
                              onClick={() => resolveAlert(a.id)}
                            >
                              Mark Resolved
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {alerts.length === 0 && (
                      <tr>
                        <td colSpan="6" className="text-center">No alerts found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        {/* User Modal */}
        <Modal isOpen={showUserModal} onClose={closeUserModal} title={editingUser ? 'Edit User' : 'Create New User'}>
          <form className="form-grid" onSubmit={createUser}>
            <label>
              Full Name
              <input
                value={newUser.full_name}
                onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                required
                disabled={!!editingUser}
                placeholder="Enter full name"
              />
            </label>
            <label>
              Email Address
              <input
                type="email"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                required
                disabled={!!editingUser}
                placeholder="user@example.com"
              />
            </label>
            {!editingUser && (
              <label>
                Password
                <input 
                  type="text" 
                  value={newUser.password} 
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} 
                  required
                  placeholder="Enter password"
                />
              </label>
            )}
            <label>
              User Role
              <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            {!editingUser && (
              <div className="success-banner" style={{ fontSize: '0.75rem', padding: 'var(--space-sm)' }}>
                💡 Default password is set to <strong>12345678</strong>. User can change it after first login.
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={closeUserModal}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving...' : editingUser ? 'Save Changes' : 'Create User'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Assign Card Modal */}
        <Modal isOpen={showAssignModal} onClose={closeAssignCardModal} title="Assign RFID Card">
          <form className="form-grid" onSubmit={assignCardToUser}>
            <label>
              User
              <input value={assignTargetUser?.full_name || assignTargetUser?.email || ''} disabled />
            </label>
            <label>
              Select RFID Card
              <select value={assignCardId} onChange={(e) => setAssignCardId(e.target.value)} required>
                <option value="">Choose a card...</option>
                {adminCards.filter((card) => !card.user_id).map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.card_uid} | {card.registration_status === 'pending_scan' ? 'Pending Scan' : 'Ready'}
                  </option>
                ))}
              </select>
            </label>
            <div className="success-banner" style={{ fontSize: '0.75rem', padding: 'var(--space-sm)' }}>
              ℹ️ This will assign the selected RFID card to the user for water meter access.
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={closeAssignCardModal}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Assigning...' : 'Assign Card'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </Layout>
  );
}