import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import KpiCard from '../components/KpiCard';
import QrDisplay from '../components/QrDisplay';
import LeakAlerts from '../components/LeakAlerts';
import { UsageLineChart } from '../components/UsageChart';
import { api, downloadBlob } from '../services/api';
import { useAuth } from '../context/AuthContext';

const nav = [
  { to: '/', label: 'Home' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/dashboard/recharge', label: 'Recharge' },
  { to: '/dashboard/history', label: 'History' },
];

const getSectionFromPath = (pathname) => {
  const path = pathname.split('/').filter(Boolean).pop();
  return path === 'dashboard' || !path ? 'overview' : path;
};

export default function CustomerDashboard() {
  const location = useLocation();
  const { user, profile } = useAuth();
  const [cards, setCards] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [usage, setUsage] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [rechargeRwfAmount, setRechargeRwfAmount] = useState('');
  const [selectedCard, setSelectedCard] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState(null);
  const tab = getSectionFromPath(location.pathname);

  const load = async () => {
    setError(null);
    try {
      const [cardsRes, predRes, usageRes, alertRes, sessRes] = await Promise.all([
        api.myCards(),
        api.predict(user?.id),
        api.myUsage(),
        api.leakAlerts(false),
        api.sessions(),
      ]);
      setCards(cardsRes.cards || []);
      setPrediction(predRes.prediction);
      setUsage(usageRes.data || []);
      setAlerts(alertRes.alerts || []);
      setSessions(sessRes.sessions || []);
      if (cardsRes.cards?.[0]) setSelectedCard(cardsRes.cards[0].card_uid);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Failed to load dashboard data. Please check if the backend is running.');
    }
  };

  useEffect(() => { load(); }, [user]);

  const handleRecharge = async (e) => {
    e.preventDefault();
    setMsg('');
    try {
      const liters = parseFloat(rechargeAmount);
      if (!liters || liters <= 0) throw new Error('Enter valid litres');
      const requestedMl = Math.round(liters * 1000);
      await api.authorize({ card_uid: selectedCard, requested_ml: requestedMl });
      setMsg('✅ Request created — please tap your card at the device to start dispensing.');
      setRechargeAmount('');
      load();
    } catch (err) {
      setMsg(`❌ ${err.message}`);
    }
  };

  const handleTopUp = async (e) => {
    e.preventDefault();
    setMsg('');
    try {
      const amount = parseFloat(rechargeRwfAmount);
      if (!amount || amount <= 0) throw new Error('Enter valid amount in RWF');
      
      const card = cards.find(c => c.card_uid === selectedCard);
      if (!card) throw new Error('Selected card not found');
      
      await api.recharge({ card_id: card.id, amount_rwf: amount });
      setMsg(`✅ Top up successful! Added ${amount.toLocaleString()} RWF to your card.`);
      setRechargeRwfAmount('');
      load();
    } catch (err) {
      setMsg(`❌ ${err.message}`);
    }
  };

  const downloadBill = async () => {
    try {
      const now = new Date();
      const blob = await api.downloadBill(user.id, now.getFullYear(), now.getMonth() + 1);
      downloadBlob(blob, `bill-${now.getFullYear()}-${now.getMonth() + 1}.pdf`);
      setMsg('✅ Bill downloaded successfully.');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg(`❌ Failed to download bill: ${err.message}`);
    }
  };

  const primaryCard = cards[0];
  const balance = primaryCard?.balance_rwf ?? 0;
  const accountStatus = profile?.account_status || 'approved';
  const isApproved = accountStatus === 'approved';

  return (
    <Layout navItems={nav}>
      <div className="dashboard-page">
        {/* Hero Section */}
        <div className="page-hero">
          <div>
            <p className="page-badge">💧 Customer Dashboard</p>
            <h1 className="page-title">Welcome back, {profile?.full_name?.split(' ')[0] || 'Customer'}</h1>
            <p className="page-subtitle">
              Monitor your water consumption, recharge your card, and track your usage history in real-time.
            </p>
          </div>
        </div>

        {/* Account Status Alert */}
        {!isApproved && (
          <div className="alert-banner">
            <strong>⚠️ Account Pending Approval</strong>
            <p style={{ marginTop: 'var(--space-xs)' }}>
              Your account is currently <strong>{accountStatus}</strong>. You'll be able to recharge and access water once approved by a manager.
            </p>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="alert-banner">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
              <span>❌ {error}</span>
              <button className="btn-secondary btn-sm" onClick={load}>Retry</button>
            </div>
          </div>
        )}

        {/* Success Message */}
        {msg && (
          <div className="success-banner">
            {msg}
          </div>
        )}

        {/* Leak Alerts Component */}
        <LeakAlerts alerts={alerts} />

        {/* Overview Tab */}
        {tab === 'overview' && (
          <section className="dashboard-section">
            {/* KPI Cards */}
            <div className="kpi-grid">
              <KpiCard 
                label="Card Balance" 
                value={balance.toLocaleString()} 
                suffix="RWF" 
                variant={balance < 1000 ? 'warning' : 'success'} 
              />
              <KpiCard 
                label="Avg Daily Usage" 
                value={Math.round(prediction?.averageDailyMl ?? 0).toLocaleString()} 
                suffix="ml" 
              />
              <KpiCard 
                label="Est. Monthly Bill" 
                value={(prediction?.expectedMonthlyBill ?? 0).toLocaleString()} 
                suffix="RWF" 
              />
              <KpiCard 
                label="Water Rate" 
                value="20" 
                suffix="RWF/L" 
              />
            </div>

            {/* Abnormal Usage Alert */}
            {prediction?.isAbnormal && (
              <div className="alert-banner">
                <strong>⚠️ Abnormal Usage Detected</strong>
                <p style={{ marginTop: 'var(--space-xs)' }}>{prediction.abnormalReason}</p>
              </div>
            )}

            {/* Card Not Scanned Warning */}
            {(!primaryCard || !primaryCard.rfid_uid) && (
              <div className="alert-banner">
                <strong>⏳ Card Not Yet Scanned</strong>
                <p style={{ marginTop: 'var(--space-xs)' }}>
                  Your physical smart card has not been scanned/linked to your account yet. Please present your card at a WASAC registration terminal to scan and link it.
                </p>
              </div>
            )}

            {/* Main Grid */}
            <div className="grid-2">
              {/* Usage Chart Card */}
              <div className="card">
                <h3>📊 Water Usage Trend</h3>
                <p className="section-text" style={{ marginBottom: 'var(--space-lg)' }}>
                  Last 30 days of water consumption
                </p>
                <UsageLineChart
                  data={prediction?.chartData || usage.map((u) => ({ date: u.date, total_ml: u.total_ml }))}
                  dataKey={prediction?.chartData ? 'ml' : 'total_ml'}
                />
              </div>

              {/* QR Code Card */}
              <div className="card">
                <h3>📱 My Water Card</h3>
                <p className="section-text" style={{ marginBottom: 'var(--space-lg)' }}>
                  Scan this QR code at any WASAC water dispenser
                </p>
                <QrDisplay card={primaryCard} />
                <button 
                  className="btn-secondary" 
                  style={{ width: '100%', marginTop: 'var(--space-lg)' }} 
                  onClick={downloadBill}
                >
                  📄 Download Monthly Bill (PDF)
                </button>
              </div>
            </div>

            {/* AI Prediction Card */}
            <div className="card">
              <h3>🤖 AI Consumption Insights</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
                <div>
                  <div className="profile-meta">Usage Trend</div>
                  <div className="value" style={{ fontSize: '1.25rem' }}>
                    {prediction?.trend === 'increasing' ? '📈 Increasing' : 
                     prediction?.trend === 'decreasing' ? '📉 Decreasing' : 
                     '➡️ Stable'}
                  </div>
                </div>
                <div>
                  <div className="profile-meta">Prediction Confidence</div>
                  <div className="value" style={{ fontSize: '1.25rem' }}>
                    <span className={`badge ${prediction?.confidence === 'high' ? 'badge-success' : 
                                      prediction?.confidence === 'medium' ? 'badge-warning' : 'badge-danger'}`}>
                      {prediction?.confidence || 'low'} confidence
                    </span>
                  </div>
                </div>
                <div>
                  <div className="profile-meta">Data Points Analyzed</div>
                  <div className="value" style={{ fontSize: '1.25rem' }}>
                    {prediction?.dataPoints ?? 0}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Recharge Tab */}
        {tab === 'recharge' && (
          <section className="dashboard-section">
            {(!primaryCard || !primaryCard.rfid_uid) ? (
              <div className="card" style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', padding: 'var(--space-xl) var(--space-md)' }}>
                <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>⏳</div>
                <h3>Your card is not yet scanned</h3>
                <p className="section-text" style={{ marginTop: 'var(--space-sm)' }}>
                  Your physical smart card has not been scanned/linked to your account yet.
                  <br />
                  Please present your card at a WASAC device or terminal to scan and link it.
                </p>
              </div>
            ) : (
              <div className="grid-2">
                {/* Top Up Balance Card */}
                <div className="card">
                  <h3>💳 Top Up Card Balance (RWF)</h3>
                  <p className="section-text" style={{ marginBottom: 'var(--space-md)' }}>
                    Directly top up your prepaid water card balance to use for future water fetches.
                  </p>
                  
                  <form onSubmit={handleTopUp}>
                    <div className="form-group">
                      <label>Select Card</label>
                      <select value={selectedCard} onChange={(e) => setSelectedCard(e.target.value)}>
                        {cards.map((c) => (
                          <option key={c.id} value={c.card_uid}>
                            {c.card_uid.substring(0, 12)}... (RFID: {c.rfid_uid}) — {c.balance_rwf.toLocaleString()} RWF
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Amount (RWF)</label>
                      <input 
                        type="number" 
                        min="100" 
                        step="1" 
                        value={rechargeRwfAmount} 
                        onChange={(e) => setRechargeRwfAmount(e.target.value)} 
                        required 
                        placeholder="e.g., 500 RWF"
                      />
                    </div>

                    <div className="success-banner" style={{ marginBottom: 'var(--space-md)', fontSize: '0.875rem' }}>
                      <strong>💡 Info</strong>
                      <p style={{ marginTop: 'var(--space-xs)' }}>
                        Top up balance will be credited instantly to your RFID water card.
                      </p>
                    </div>

                    <button 
                      type="submit" 
                      className="btn-primary" 
                      disabled={!isApproved}
                      style={{ width: '100%' }}
                    >
                      {!isApproved ? 'Account Pending Approval' : '💰 Top Up Balance'}
                    </button>
                  </form>
                </div>

                {/* Request Dispensing Card */}
                <div className="card">
                  <h3>💧 Request Water Dispensing (Litres)</h3>
                  <p className="section-text" style={{ marginBottom: 'var(--space-md)' }}>
                    Authorize a volume of water to be dispensed immediately upon card tap.
                  </p>
                  
                  <form onSubmit={handleRecharge}>
                    <div className="form-group">
                      <label>Select Card</label>
                      <select value={selectedCard} onChange={(e) => setSelectedCard(e.target.value)}>
                        {cards.map((c) => (
                          <option key={c.id} value={c.card_uid}>
                            {c.card_uid.substring(0, 12)}... — {c.balance_rwf.toLocaleString()} RWF
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Amount (Litres)</label>
                      <input 
                        type="number" 
                        min="0.1" 
                        step="0.1" 
                        value={rechargeAmount} 
                        onChange={(e) => setRechargeAmount(e.target.value)} 
                        required 
                        placeholder="e.g., 10 litres"
                      />
                    </div>

                    <div className="success-banner" style={{ marginBottom: 'var(--space-md)', fontSize: '0.875rem' }}>
                      <strong>💰 Pricing Information</strong>
                      <p style={{ marginTop: 'var(--space-xs)' }}>
                        1 Litre = 20 RWF • Minimum request: 0.1 Litres (2 RWF)
                      </p>
                    </div>

                    <button 
                      type="submit" 
                      className="btn-primary" 
                      disabled={!isApproved}
                      style={{ width: '100%' }}
                    >
                      {!isApproved ? 'Account Pending Approval' : '💧 Start Dispensing'}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </section>
        )}

        {/* History Tab */}
        {tab === 'history' && (
          <section className="dashboard-section">
            <div className="card">
              <h3>📜 Water Fetch History</h3>
              <p className="section-text" style={{ marginBottom: 'var(--space-md)' }}>
                Complete record of all your water dispensing sessions
              </p>
              
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date & Time</th>
                      <th>Volume (Litres)</th>
                      <th>Cost (RWF)</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id}>
                        <td>{new Date(s.created_at).toLocaleString()}</td>
                        <td>{(s.volume_ml / 1000).toLocaleString()} L</td>
                        <td>{s.cost_rwf.toLocaleString()} RWF</td>
                        <td>
                          <span className={`badge badge-${
                            s.status === 'completed' ? 'success' : 
                            s.status === 'blocked' ? 'danger' : 
                            'warning'
                          }`}>
                            {s.status === 'completed' ? '✓ Completed' : 
                             s.status === 'blocked' ? '✗ Blocked' : 
                             '⏳ Pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {sessions.length === 0 && (
                      <tr>
                        <td colSpan="4" className="empty-state">
                          <div>💧 No water fetch history yet</div>
                          <p className="section-text" style={{ marginTop: 'var(--space-sm)' }}>
                            Your first water dispense will appear here once you recharge and tap your card.
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Summary Stats */}
              {sessions.length > 0 && (
                <div style={{ 
                  marginTop: 'var(--space-lg)', 
                  padding: 'var(--space-md)', 
                  background: 'var(--surface2)', 
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 'var(--space-md)'
                }}>
                  <div>
                    <div className="profile-meta">Total Sessions</div>
                    <div className="value" style={{ fontSize: '1.25rem' }}>{sessions.length}</div>
                  </div>
                  <div>
                    <div className="profile-meta">Total Water Consumed</div>
                    <div className="value" style={{ fontSize: '1.25rem' }}>
                      {(sessions.reduce((sum, s) => sum + (s.volume_ml || 0), 0) / 1000).toLocaleString()} L
                    </div>
                  </div>
                  <div>
                    <div className="profile-meta">Total Spent</div>
                    <div className="value" style={{ fontSize: '1.25rem' }}>
                      {sessions.reduce((sum, s) => sum + (s.cost_rwf || 0), 0).toLocaleString()} RWF
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}