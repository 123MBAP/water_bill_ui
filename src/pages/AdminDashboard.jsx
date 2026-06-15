import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import Layout from '../components/Layout';
import KpiCard from '../components/KpiCard';
import LeakAlerts from '../components/LeakAlerts';
import Modal from '../components/Modal';
import { UsageBarChart, UsageLineChart, UsageRevenueComboChart } from '../components/UsageChart';
import { api, downloadBlob } from '../services/api';
import { cached, cacheInvalidate } from '../services/cache';
import AdminSystemControlPanel from './AdminSystemControlPanel';
import AdminCardsPanel from './AdminCardsPanel';
import AdminDevicesPanel from './AdminDevicesPanel';

/* ── Sidebar nav sections ─────────────────────────────────── */
const navSections = [
  {
    title: 'Dashboard',
    items: [
      { to: '/admin',               label: 'Overview',        icon: '📊', end: true },
      { to: '/admin/system',        label: 'System Control',  icon: '⚙️' },
      { to: '/admin/devices',       label: 'Devices',         icon: '📟' },
      { to: '/admin/cards',         label: 'Cards',           icon: '💳' },
    ],
  },
  {
    title: 'Management',
    items: [
      { to: '/admin/users',         label: 'Users',           icon: '👥' },
      { to: '/admin/transactions',  label: 'Transactions',    icon: '🔄' },
      { to: '/admin/alerts',        label: 'Leak Alerts',     icon: '🚨' },
      { to: '/admin/reports',       label: 'Reports',         icon: '📄' },
    ],
  },
];

const getSectionFromPath = (pathname) => {
  const seg = pathname.split('/').filter(Boolean).pop();
  return seg === 'admin' || !seg ? 'overview' : seg;
};

const roleOptions = [
  { value: 'customer',      label: 'Customer' },
  { value: 'wasac_manager', label: 'Manager' },
];

export default function AdminDashboard() {
  const location = useLocation();
  const tab      = getSectionFromPath(location.pathname);
  const { profile } = useAuth();

  const [stats,         setStats]         = useState(null);
  const [graph,         setGraph]         = useState([]);
  const [topConsumers,  setTopConsumers]  = useState([]);
  const [waterLoss,     setWaterLoss]     = useState(null);
  const [alerts,        setAlerts]        = useState([]);
  const [users,         setUsers]         = useState([]);
  const [adminCards,    setAdminCards]    = useState([]);
  const [devices,       setDevices]       = useState([]);
  const [transactions,  setTransactions]  = useState([]);
  const [mqttConnected, setMqttConnected] = useState(false);
  const [waterFetchEnabled, setWaterFetchEnabled] = useState(true);
  const [emergencyLoading, setEmergencyLoading]   = useState(false);

  const [status,        setStatus]        = useState(null);
  const [saving,        setSaving]        = useState(false);

  const [showUserModal,   setShowUserModal]   = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingUser,     setEditingUser]     = useState(null);
  const [assignTargetUser,setAssignTargetUser]= useState(null);
  const [assignCardId,    setAssignCardId]    = useState('');
  const [msgTarget,       setMsgTarget]       = useState(null);   // user to message
  const [msgForm,         setMsgForm]         = useState({ title: '', body: '' });
  const [msgSending,      setMsgSending]      = useState(false);
  const [msgSent,         setMsgSent]         = useState('');
  const [newUser,         setNewUser]         = useState({ username: '', password: '12345678', full_name: '', role: 'customer' });

  const [userCurrentPage,        setUserCurrentPage]        = useState(1);
  const [transactionCurrentPage, setTransactionCurrentPage] = useState(1);
  const USERS_PER_PAGE        = 8;
  const TRANSACTIONS_PER_PAGE = 10;

  /* ── Reports state ──────────────────────────────────────── */
  const today     = new Date().toISOString().split('T')[0];
  const firstDay  = new Date(new Date().setDate(1)).toISOString().split('T')[0];
  const [reportFrom,       setReportFrom]       = useState(firstDay);
  const [reportTo,         setReportTo]         = useState(today);
  const [reportRows,       setReportRows]       = useState(null);
  const [reportLoading,    setReportLoading]    = useState(false);

  /* ── Loading state per section ─────────────────────────── */
  const [tabLoading, setTabLoading] = useState(false);
  const loadedTabs = useRef(new Set());

  /* ── Per-tab lazy loaders ───────────────────────────────── */
  const loadOverview = async (force = false) => {
    if (!force && loadedTabs.current.has('overview')) return;
    setTabLoading(true);
    try {
      const [ov, gr, alrt, ctrl, mqtt] = await Promise.allSettled([
        cached('admin-overview',   () => api.overview(),                  30_000),
        cached('admin-graph',      () => api.usageGraph('monthly'),       60_000),
        cached('admin-alerts',     () => api.leakAlerts(false),           30_000),
        cached('admin-ctrl',       () => api.adminGetWaterFetchControl(), 30_000),
        cached('admin-mqtt',       () => api.adminGetMqttStatus(),        15_000),
      ]);
      if (ov.status   === 'fulfilled') setStats(ov.value.stats);
      if (gr.status   === 'fulfilled') setGraph(gr.value.data || []);
      if (alrt.status === 'fulfilled') setAlerts(alrt.value.alerts || []);
      if (ctrl.status === 'fulfilled') setWaterFetchEnabled(!!ctrl.value.water_fetch_enabled);
      if (mqtt.status === 'fulfilled') setMqttConnected(!!mqtt.value.connected);
      loadedTabs.current.add('overview');
    } catch (e) {
      setStatus({ type: 'error', message: e.message || 'Failed to load overview.' });
    } finally { setTabLoading(false); }
  };

  const loadUsers = async (force = false) => {
    if (!force && loadedTabs.current.has('users')) return;
    setTabLoading(true);
    try {
      const res = await cached('admin-users', () => api.users(), 30_000);
      setUsers(res.users || []);
      setUserCurrentPage(1);
      loadedTabs.current.add('users');
    } catch (e) {
      setStatus({ type: 'error', message: e.message || 'Failed to load users.' });
    } finally { setTabLoading(false); }
  };

  const loadCards = async (force = false) => {
    if (!force && loadedTabs.current.has('cards')) return;
    setTabLoading(true);
    try {
      const res = await cached('admin-cards', () => api.adminListCards(), 30_000);
      setAdminCards(res.cards || []);
      loadedTabs.current.add('cards');
    } catch (e) {
      setStatus({ type: 'error', message: e.message || 'Failed to load cards.' });
    } finally { setTabLoading(false); }
  };

  const loadDevices = async (force = false) => {
    if (!force && loadedTabs.current.has('devices')) return;
    setTabLoading(true);
    try {
      const res = await cached('admin-devices', () => api.adminListDevices(), 30_000);
      setDevices(res.devices || []);
      loadedTabs.current.add('devices');
    } catch (e) {
      setStatus({ type: 'error', message: e.message || 'Failed to load devices.' });
    } finally { setTabLoading(false); }
  };

  const loadTransactions = async (force = false) => {
    if (!force && loadedTabs.current.has('transactions')) return;
    setTabLoading(true);
    try {
      const res = await cached('admin-transactions', () => api.allTransactions(100, 0), 30_000);
      setTransactions(res.transactions || []);
      setTransactionCurrentPage(1);
      loadedTabs.current.add('transactions');
    } catch (e) {
      setStatus({ type: 'error', message: e.message || 'Failed to load transactions.' });
    } finally { setTabLoading(false); }
  };

  const loadAlerts = async (force = false) => {
    if (!force && loadedTabs.current.has('alerts')) return;
    setTabLoading(true);
    try {
      const res = await cached('admin-alerts', () => api.leakAlerts(false), 30_000);
      setAlerts(res.alerts || []);
      loadedTabs.current.add('alerts');
    } catch (e) {
      setStatus({ type: 'error', message: e.message || 'Failed to load alerts.' });
    } finally { setTabLoading(false); }
  };

  /* Refresh current tab (bypasses cache) */
  const refreshTab = () => {
    cacheInvalidate('admin-');
    loadedTabs.current.clear();
    dispatchTabLoad(tab, true);
  };

  const dispatchTabLoad = (t, force = false) => {
    if (t === 'overview' || t === 'system') loadOverview(force);
    else if (t === 'users')        loadUsers(force);
    else if (t === 'cards')        loadCards(force);
    else if (t === 'devices')      loadDevices(force);
    else if (t === 'transactions') loadTransactions(force);
    else if (t === 'alerts')       loadAlerts(force);
  };

  /* Load on mount (overview) and whenever tab changes */
  useEffect(() => { dispatchTabLoad(tab); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Legacy load() alias used by some handlers (refresh after action) */
  const load = refreshTab;

  /* ── Emergency stop ─────────────────────────────────────── */
  const emergencyStop = async () => {
    if (!window.confirm('⚠️ EMERGENCY STOP: This will immediately halt ALL water dispensing across the network. Continue?')) return;
    setEmergencyLoading(true);
    try {
      await api.adminSetWaterFetchControl({ water_fetch_enabled: false });
      setWaterFetchEnabled(false);
      setStatus({ type: 'success', message: '🛑 Emergency stop activated — all water dispensing halted.' });
    } catch (e) {
      setStatus({ type: 'error', message: e.message });
    } finally {
      setEmergencyLoading(false);
    }
  };

  const resumeWater = async () => {
    setEmergencyLoading(true);
    try {
      await api.adminSetWaterFetchControl({ water_fetch_enabled: true });
      setWaterFetchEnabled(true);
      setStatus({ type: 'success', message: '✅ Water dispensing resumed.' });
    } catch (e) {
      setStatus({ type: 'error', message: e.message });
    } finally {
      setEmergencyLoading(false);
    }
  };

  /* ── Reports: preview table (loads transactions lazily if needed) ── */
  const generateReport = async () => {
    if (!reportFrom || !reportTo) return;
    setReportLoading(true);
    try {
      // Ensure transactions are loaded before filtering
      if (!loadedTabs.current.has('transactions')) {
        const res = await cached('admin-transactions', () => api.allTransactions(100, 0), 30_000);
        setTransactions(res.transactions || []);
        loadedTabs.current.add('transactions');
      }
      const from = new Date(reportFrom);
      const to   = new Date(reportTo);
      to.setHours(23, 59, 59, 999);
      setTransactions(prev => {
        const filtered = prev.filter((t) => {
          const d = new Date(t.created_at);
          return d >= from && d <= to;
        });
        setReportRows(filtered);
        return prev;
      });
    } catch (e) {
      setStatus({ type: 'error', message: e.message });
    } finally {
      setReportLoading(false);
    }
  };

  const downloadRevenue = async (from, to) => {
    try {
      const blob = await api.downloadRevenue(from || reportFrom, to || reportTo);
      downloadBlob(blob, `revenue-${from || reportFrom}-to-${to || reportTo}.pdf`);
      setStatus({ type: 'success', message: 'Report downloaded.' });
    } catch (e) {
      setStatus({ type: 'error', message: e.message });
    }
  };

  /* ── Alert resolve ──────────────────────────────────────── */
  const resolveAlert = async (id) => {
    try {
      await api.resolveAlert(id);
      setStatus({ type: 'success', message: 'Alert resolved.' });
      load();
    } catch (e) {
      setStatus({ type: 'error', message: e.message });
    }
  };

  /* ── User CRUD ──────────────────────────────────────────── */
  const openUserModal = (user = null) => {
    setEditingUser(user);
    setNewUser({ username: user?.email || '', password: '12345678', full_name: user?.full_name || '', role: user?.role || 'customer' });
    setShowUserModal(true);
  };
  const closeUserModal = () => { setShowUserModal(false); setEditingUser(null); setNewUser({ username: '', password: '12345678', full_name: '', role: 'customer' }); };

  const createUser = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingUser) {
        await api.adminUpdateUser(editingUser.user_id, {
          full_name: newUser.full_name,
          email:     newUser.username,
          role:      newUser.role,
        });
        setStatus({ type: 'success', message: 'User updated successfully.' });
      } else {
        if (!newUser.username?.trim()) throw new Error('Email is required.');
        await api.adminCreateUser({ ...newUser, email: newUser.username, username: newUser.username });
        setStatus({ type: 'success', message: 'User created.' });
      }
      closeUserModal();
      load();
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally { setSaving(false); }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm('Delete this user? This cannot be undone.')) return;
    try {
      await api.deleteUser(userId);
      setStatus({ type: 'success', message: 'User deleted.' });
      setUsers(prev => prev.filter(u => u.user_id !== userId));
    } catch (e) {
      setStatus({ type: 'error', message: e.message });
    }
  };

  const openAssignCardModal = (user) => { setAssignTargetUser(user); setAssignCardId(''); setShowAssignModal(true); };
  const closeAssignCardModal = () => { setShowAssignModal(false); setAssignTargetUser(null); setAssignCardId(''); };

  const assignCardToUser = async (e) => {
    e.preventDefault();
    if (!assignTargetUser || !assignCardId) return;
    setSaving(true);
    try {
      await api.adminAssignCard({ cardId: assignCardId, userId: assignTargetUser.user_id });
      setStatus({ type: 'success', message: 'Card assigned.' });
      closeAssignCardModal();
      load();
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Assignment failed.' });
    } finally { setSaving(false); }
  };

  const userHasCard = (userId) => adminCards.some(c => c.user_id === userId);

  /* topbarExtra intentionally empty */

  /* ── Pagination helper ──────────────────────────────────── */
  const Pagination = ({ total, perPage, page, setPage }) => {
    const pages = Math.ceil(total / perPage);
    if (pages <= 1) return null;
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-lg)', paddingTop: 'var(--space-lg)', borderTop: '1px solid var(--border)' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {Math.min((page - 1) * perPage + 1, total)}–{Math.min(page * perPage, total)} of {total}
        </span>
        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
          <button className="btn-secondary btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</button>
          {Array.from({ length: Math.min(pages, 7) }, (_, i) => i + 1).map(p => (
            <button key={p} className={`btn-sm ${page === p ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPage(p)} style={{ minWidth: '2.2rem' }}>{p}</button>
          ))}
          <button className="btn-secondary btn-sm" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}>Next →</button>
        </div>
      </div>
    );
  };

  return (
    <Layout navSections={navSections}>
      <div className="dashboard-page">

        {/* ── Header row ──────────────────────────────────── */}
        <div className="admin-header-row">
          <div>
            <p className="admin-breadcrumb">Admin / {tab.charAt(0).toUpperCase() + tab.slice(1)}</p>
            <h1 className="admin-heading">
              {tab === 'overview'     ? `Welcome, ${profile?.full_name || 'Admin'} 👋` :
               tab === 'system'      ? 'System Control' :
               tab === 'devices'     ? 'Devices' :
               tab === 'users'       ? 'User Management' :
               tab === 'transactions'? 'Transactions' :
               tab === 'alerts'      ? 'Leak Alerts' :
               tab === 'reports'     ? 'Reports' :
               tab === 'cards'       ? 'RFID Cards' : tab}
            </h1>
          </div>
          <div className="admin-cta-row">
            {tab === 'users' && <button className="btn-secondary btn-sm" onClick={() => openUserModal()}>+ Add User</button>}
            {tab === 'reports' && <button className="btn-primary btn-sm" onClick={() => downloadRevenue()}>⬇ Export PDF</button>}
          </div>
        </div>

        {/* ── Status message ──────────────────────────────── */}
        {status && (
          <div className={`status-banner ${status.type === 'error' ? 'status-error' : 'status-success'}`} style={{ marginBottom: 'var(--space-xl)' }}>
            <span>{status.message}</span>
            <button className="btn-secondary btn-sm" onClick={() => setStatus(null)}>✕</button>
          </div>
        )}

        {/* ── Tab loading indicator ───────────────────────── */}
        {tabLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', marginBottom: 'var(--space-md)', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            Loading…
          </div>
        )}

        {/* ════════════════════════════ OVERVIEW ════════════════════════════ */}
        {tab === 'overview' && (
          <>
            {/* Emergency Stop Banner */}
            <div className="emergency-banner">
              <div>
                <div className="emergency-title">
                  {waterFetchEnabled ? '🟢 Water Network: ACTIVE' : '🔴 Water Network: STOPPED'}
                </div>
                <div className="emergency-subtitle">
                  {waterFetchEnabled
                    ? 'All dispensing points are operational. Use the emergency stop to halt the entire network immediately.'
                    : 'All water dispensing is currently halted. Resume when the issue is resolved.'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', alignItems: 'center' }}>
                {waterFetchEnabled ? (
                  <button className="btn-emergency" onClick={emergencyStop} disabled={emergencyLoading}>
                    {emergencyLoading ? 'Stopping...' : '🛑 EMERGENCY STOP'}
                  </button>
                ) : (
                  <button className="btn-primary" style={{ padding: 'var(--space-md) var(--space-2xl)', fontSize: '0.95rem', fontWeight: 700 }} onClick={resumeWater} disabled={emergencyLoading}>
                    {emergencyLoading ? 'Resuming...' : '▶️ Resume Water'}
                  </button>
                )}
              </div>
            </div>

            {/* KPI Row — 3 cards */}
            <div className="admin-kpi-row">
              <KpiCard label="Water Dispensed"  value={(stats?.totalWaterLiters ?? 0).toLocaleString()} suffix="L"   colorVariant="kpi-cyan"   icon="💧"
                trend="up" trendLabel={`${stats?.totalSessions ?? 0} sessions`} />
              <KpiCard label="Active Customers" value={stats?.activeUsers ?? 0}  colorVariant="kpi-purple" icon="👥"
                trend={stats?.activeUsers > 0 ? 'up' : null} trendLabel="approved accounts" />
              <KpiCard label="Open Leak Alerts" value={stats?.activeLeaks ?? 0}  colorVariant={stats?.activeLeaks > 0 ? 'kpi-coral' : 'kpi-teal'} icon="🚨"
                trend={stats?.activeLeaks > 0 ? 'down' : null} trendLabel={stats?.activeLeaks > 0 ? 'needs attention' : 'All clear'} />
            </div>

            {/* Charts row — combo (usage + revenue) + trend line */}
            <div className="admin-grid" style={{ marginBottom: 'var(--space-xl)' }}>
              <div className="panel-card">
                <div className="panel-heading">
                  📊 Water & Revenue
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Monthly overview</span>
                </div>
                <UsageRevenueComboChart data={graph} />
              </div>
              <div className="panel-card">
                <div className="panel-heading">
                  📈 Usage Trend
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>30-day (Litres)</span>
                </div>
                <UsageLineChart data={graph} dataKey="total_ml" label="Usage" />
              </div>
            </div>

            {/* Three column: top consumers / trend / recent alerts */}
            <div className="admin-grid-3">
              <div className="panel-card">
                <div className="panel-heading">🏆 Top Consumers</div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>#</th><th>Customer</th><th>Monthly (L)</th></tr></thead>
                    <tbody>
                      {topConsumers.slice(0, 5).map((c, i) => (
                        <tr key={c.user_id}>
                          <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                          <td>{c.full_name || 'Anonymous'}</td>
                          <td><strong>{(c.total_ml / 1000).toLocaleString()}</strong></td>
                        </tr>
                      ))}
                      {topConsumers.length === 0 && (
                        <tr><td colSpan="3" className="text-center" style={{ padding: '20px 0', color: 'var(--text-muted)' }}>No data</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="panel-card">
                <div className="panel-heading">
                  📈 Usage Trend
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>30-day line</span>
                </div>
                <UsageLineChart data={graph} dataKey="total_ml" label="Usage (ml)" />
              </div>

              <div className="panel-card">
                <div className="panel-heading">🚨 Recent Alerts</div>
                <LeakAlerts alerts={alerts.slice(0, 3)} onResolve={resolveAlert} />
                {alerts.length === 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>
                    ✅ No active leak alerts
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════ SYSTEM ════════════════════════════ */}
        {tab === 'system' && (
          <AdminSystemControlPanel onStatus={setStatus} />
        )}

        {/* ════════════════════════════ DEVICES ═══════════════════════════ */}
        {tab === 'devices' && <AdminDevicesPanel onStatus={setStatus} />}

        {/* ════════════════════════════ CARDS ══════════════════════════════ */}
        {tab === 'cards' && <AdminCardsPanel onStatus={setStatus} />}

        {/* ════════════════════════════ USERS ══════════════════════════════ */}
        {tab === 'users' && (
          <div className="panel-card">
            <div className="panel-heading">
              <h3>System Users</h3>
              <button className="btn-primary btn-sm" onClick={() => openUserModal()}>+ Add User</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>User</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {users.slice((userCurrentPage - 1) * USERS_PER_PAGE, userCurrentPage * USERS_PER_PAGE).map((u, idx) => (
                    <tr key={u.id} style={{ background: idx % 2 === 0 ? 'transparent' : 'var(--surface2)' }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                            {(u.full_name || u.email || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{u.full_name || u.username || '—'}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{u.email || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className={`badge badge-${u.role === 'admin' ? 'success' : u.role === 'wasac_manager' ? 'warning' : 'info'}`}>{u.role === 'wasac_manager' ? 'Manager' : u.role}</span></td>
                      <td><span className={`badge badge-${u.account_status === 'approved' ? 'success' : u.account_status === 'pending' ? 'warning' : 'danger'}`}>{u.account_status || 'approved'}</span></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                      <td className="table-actions">
                        {u.role !== 'admin' && (
                          <>
                            {!userHasCard(u.user_id) && (
                              <button className="btn-secondary btn-sm" onClick={() => openAssignCardModal(u)}>💳</button>
                            )}
                            <button className="btn-secondary btn-sm" title="Send message" onClick={() => { setMsgTarget(u); setMsgForm({ title: '', body: '' }); setMsgSent(''); }}>✉️</button>
                            <button className="btn-secondary btn-sm" title="Edit user" onClick={() => openUserModal(u)}>✏️</button>
                            <button className="btn-danger btn-sm" title="Delete user" onClick={() => deleteUser(u.user_id)}>🗑</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan="6" className="empty-state">No users found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination total={users.length} perPage={USERS_PER_PAGE} page={userCurrentPage} setPage={setUserCurrentPage} />
          </div>
        )}

        {/* ── Send Message Modal ── */}
        <Modal isOpen={!!msgTarget} onClose={() => setMsgTarget(null)} title={`Message to ${msgTarget?.full_name || msgTarget?.email || 'user'}`}>
          {msgSent ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Message sent!</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>{msgSent}</div>
              <button onClick={() => setMsgTarget(null)} style={{ marginTop: 16, padding: '6px 18px', fontSize: '0.78rem', fontWeight: 600, background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>Close</button>
            </div>
          ) : (
            <form onSubmit={async e => {
              e.preventDefault();
              if (!msgTarget?.user_id || !msgForm.title) return;
              setMsgSending(true);
              try {
                await api.sendNotification({ user_id: msgTarget.user_id, title: msgForm.title, body: msgForm.body });
                setMsgSent(`"${msgForm.title}" was delivered to ${msgTarget.full_name || msgTarget.email}.`);
              } catch (err) {
                alert(`Failed: ${err.message}`);
              } finally { setMsgSending(false); }
            }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Subject / Title</label>
                <input type="text" required value={msgForm.title} onChange={e => setMsgForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Account update" style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', background: 'var(--surface)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Message</label>
                <textarea rows={4} value={msgForm.body} onChange={e => setMsgForm(p => ({ ...p, body: e.target.value }))} placeholder="Type your message here…" style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', background: 'var(--surface)', color: 'var(--text-primary)', boxSizing: 'border-box', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" onClick={() => setMsgTarget(null)} style={{ padding: '6px 14px', fontSize: '0.78rem', fontWeight: 600, background: 'var(--surface2)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={msgSending} style={{ padding: '6px 14px', fontSize: '0.78rem', fontWeight: 600, background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: msgSending ? 'not-allowed' : 'pointer', opacity: msgSending ? 0.7 : 1 }}>
                  {msgSending ? 'Sending…' : '✉️ Send Message'}
                </button>
              </div>
            </form>
          )}
        </Modal>

        {/* ════════════════════════════ TRANSACTIONS ═══════════════════════ */}
        {tab === 'transactions' && (
          <div className="panel-card">
            <div className="panel-heading">
              <div>
                <h3>All Transactions</h3>
                <p className="section-text">Water dispensing records from all customers.</p>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Customer</th><th>Email</th><th>Date</th><th>Volume (L)</th><th>Cost (RWF)</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {transactions.slice((transactionCurrentPage - 1) * TRANSACTIONS_PER_PAGE, transactionCurrentPage * TRANSACTIONS_PER_PAGE).map(t => (
                    <tr key={t.id}>
                      <td><strong>{t.customer_name || 'Unknown'}</strong></td>
                      <td>{t.customer_email || '—'}</td>
                      <td>{new Date(t.created_at).toLocaleString()}</td>
                      <td>{(t.volume_ml / 1000).toLocaleString()}</td>
                      <td>{t.cost_rwf.toLocaleString()}</td>
                      <td>
                        <span className={`badge badge-${t.status === 'completed' ? 'success' : t.status === 'blocked' ? 'danger' : 'warning'}`}>
                          {t.status === 'completed' ? '✓ Done' : t.status === 'blocked' ? '✗ Blocked' : '⏳ Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr><td colSpan="6" className="empty-state">No transactions found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination total={transactions.length} perPage={TRANSACTIONS_PER_PAGE} page={transactionCurrentPage} setPage={setTransactionCurrentPage} />
          </div>
        )}

        {/* ════════════════════════════ ALERTS ═════════════════════════════ */}
        {tab === 'alerts' && (
          <div className="panel-card">
            <div className="panel-heading">Leak Detection System</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Message</th><th>Severity</th><th>Date</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {alerts.map(a => (
                    <tr key={a.id}>
                      <td>{a.message}</td>
                      <td><span className={`badge badge-${a.severity === 'critical' ? 'danger' : 'warning'}`}>{a.severity || 'moderate'}</span></td>
                      <td>{new Date(a.created_at).toLocaleDateString()}</td>
                      <td><span className={`badge badge-${a.resolved ? 'success' : 'danger'}`}>{a.resolved ? 'Resolved' : 'Active'}</span></td>
                      <td>{!a.resolved && <button className="btn-primary btn-sm" onClick={() => resolveAlert(a.id)}>Resolve</button>}</td>
                    </tr>
                  ))}
                  {alerts.length === 0 && <tr><td colSpan="5" className="empty-state">No alerts. ✅</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ════════════════════════════ REPORTS ════════════════════════════ */}
        {tab === 'reports' && (
          <div>
            {/* Date range selector */}
            <div className="panel-card" style={{ marginBottom: 'var(--space-xl)' }}>
              <div className="panel-heading">📅 Date Range</div>

              <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 'var(--space-lg)' }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>From</label>
                  <input type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)} max={reportTo} />
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>To</label>
                  <input type="date" value={reportTo} onChange={e => setReportTo(e.target.value)} min={reportFrom} max={today} />
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-sm)', flexShrink: 0 }}>
                  <button className="btn-secondary btn-sm" onClick={generateReport} disabled={reportLoading}>
                    {reportLoading ? '⏳' : '👁 Preview'}
                  </button>
                  <button className="btn-primary btn-sm" onClick={() => downloadRevenue(reportFrom, reportTo)}>
                    ⬇ PDF
                  </button>
                </div>
              </div>

              {/* Quick ranges */}
              <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                {[
                  { label: 'Today',        from: today,     to: today },
                  { label: 'This Month',   from: firstDay,  to: today },
                  { label: 'Last 7 Days',  from: new Date(Date.now() - 6*86400000).toISOString().split('T')[0], to: today },
                  { label: 'Last 30 Days', from: new Date(Date.now() - 29*86400000).toISOString().split('T')[0], to: today },
                  { label: 'Last 90 Days', from: new Date(Date.now() - 89*86400000).toISOString().split('T')[0], to: today },
                ].map(range => (
                  <button key={range.label} className={`btn-sm ${reportFrom === range.from && reportTo === range.to ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => { setReportFrom(range.from); setReportTo(range.to); }}>
                    {range.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview Table */}
            {reportRows !== null && (
              <div className="panel-card">
                <div className="panel-heading">
                  Report Preview: {reportFrom} → {reportTo}
                  <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{reportRows.length} transactions</span>
                    <button className="btn-primary btn-sm" onClick={() => downloadRevenue(reportFrom, reportTo)}>⬇ Download PDF</button>
                  </div>
                </div>

                {/* Summary stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)', padding: 'var(--space-lg)', background: 'rgba(0,201,228,0.06)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(0,201,228,0.12)' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total Transactions</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>{reportRows.length}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total Volume</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)' }}>
                      {(reportRows.reduce((s, t) => s + (t.volume_ml || 0), 0) / 1000).toLocaleString()} L
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total Revenue</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--success)' }}>
                      {reportRows.reduce((s, t) => s + (t.cost_rwf || 0), 0).toLocaleString()} RWF
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Completed</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--success)' }}>
                      {reportRows.filter(t => t.status === 'completed').length}
                    </div>
                  </div>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Customer</th>
                        <th>Email</th>
                        <th>Date & Time</th>
                        <th>Volume (L)</th>
                        <th>Cost (RWF)</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportRows.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="empty-state">No transactions found for this date range.</td>
                        </tr>
                      ) : (
                        reportRows.map((t, i) => (
                          <tr key={t.id}>
                            <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                            <td><strong>{t.customer_name || 'Unknown'}</strong></td>
                            <td>{t.customer_email || '—'}</td>
                            <td>{new Date(t.created_at).toLocaleString()}</td>
                            <td>{(t.volume_ml / 1000).toLocaleString()}</td>
                            <td><strong>{t.cost_rwf.toLocaleString()}</strong></td>
                            <td>
                              <span className={`badge badge-${t.status === 'completed' ? 'success' : t.status === 'blocked' ? 'danger' : 'warning'}`}>
                                {t.status === 'completed' ? '✓ Done' : t.status === 'blocked' ? '✗ Blocked' : '⏳ Pending'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {reportRows === null && (
              <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>📊</div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Select a date range above</div>
                <p style={{ fontSize: '0.85rem' }}>Then click "Preview Table" to see transactions, or "Download PDF" directly.</p>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════ MODALS ════════════════════════════ */}
        <Modal isOpen={showUserModal} onClose={closeUserModal} title={editingUser ? `Edit — ${editingUser.full_name || editingUser.email}` : 'Create New User'}>
          <form className="form-grid" onSubmit={createUser}>
            <label>Full Name
              <input
                value={newUser.full_name}
                onChange={e => setNewUser({ ...newUser, full_name: e.target.value })}
                required
                placeholder="Full name"
              />
            </label>
            <label>Email
              <input
                type="email"
                value={newUser.username}
                onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                required
                placeholder="user@example.com"
              />
            </label>
            {!editingUser && (
              <label>Password
                <input type="text" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} required placeholder="Password" />
              </label>
            )}
            <label>Role
              <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                {roleOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            {!editingUser && (
              <div className="success-banner" style={{ fontSize: '0.75rem', padding: 'var(--space-sm)', gridColumn: '1 / -1' }}>
                💡 Default password: <strong>12345678</strong>
              </div>
            )}
            <div className="modal-actions" style={{ gridColumn: '1 / -1' }}>
              <button type="button" className="btn-secondary" onClick={closeUserModal}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : editingUser ? 'Save Changes' : 'Create User'}
              </button>
            </div>
          </form>
        </Modal>

        <Modal isOpen={showAssignModal} onClose={closeAssignCardModal} title="Assign RFID Card">
          <form className="form-grid" onSubmit={assignCardToUser}>
            <label>User<input value={assignTargetUser?.full_name || assignTargetUser?.email || ''} disabled /></label>
            <label>Select Card
              <select value={assignCardId} onChange={e => setAssignCardId(e.target.value)} required>
                <option value="">Choose a card...</option>
                {adminCards.filter(c => !c.user_id).map(c => (
                  <option key={c.id} value={c.id}>{c.card_uid} | {c.registration_status === 'pending_scan' ? 'Pending Scan' : 'Ready'}</option>
                ))}
              </select>
            </label>
            <div className="modal-actions" style={{ gridColumn: '1 / -1' }}>
              <button type="button" className="btn-secondary" onClick={closeAssignCardModal}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Assigning...' : 'Assign Card'}</button>
            </div>
          </form>
        </Modal>
      </div>
    </Layout>
  );
}
