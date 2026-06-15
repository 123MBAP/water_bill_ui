import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import KpiCard from '../components/KpiCard';
import LeakAlerts from '../components/LeakAlerts';
import Modal from '../components/Modal';
import { UsageLineChart, UsageDualLineChart } from '../components/UsageChart';
import { api, downloadBlob } from '../services/api';
import { cached, cacheInvalidate } from '../services/cache';
import { useAuth } from '../context/useAuth';

/* ── Sidebar sections ────────────────────────────────────── */
const navSections = [
  {
    title: 'Overview',
    items: [
      { to: '/dashboard',         label: 'Dashboard',    icon: '📊', end: true },
      { to: '/dashboard/profile', label: 'My Profile',   icon: '👤' },
    ],
  },
  {
    title: 'Water Services',
    items: [
      { to: '/dashboard/fetch',    label: 'Fetch Water',   icon: '💧' },
      { to: '/dashboard/recharge', label: 'Recharge Card', icon: '💳' },
    ],
  },
  {
    title: 'Records',
    items: [
      { to: '/dashboard/history', label: 'History', icon: '📜' },
    ],
  },
];

const getSectionFromPath = (p) => {
  const seg = p.split('/').filter(Boolean).pop();
  return !seg || seg === 'dashboard' ? 'overview' : seg;
};

/* Demo data — only used when account has NO sessions at all */
function generateDemoData(days = 14) {
  const result = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const label = `${String(d.getMonth() + 1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
    const base = 35000;
    const todayVal     = Math.round(base + Math.sin(i * 0.9) * 12000 + Math.random() * 5000);
    const yesterdayVal = Math.round(base + Math.sin((i + 1) * 0.9) * 12000 + Math.random() * 5000);
    result.push({ date: label, today_ml: todayVal, yesterday_ml: yesterdayVal, isDemo: true });
  }
  return result;
}

/* Group completed sessions by date → daily totals */
function buildChartFromSessions(sessions) {
  const byDate = {};
  for (const s of sessions) {
    if (s.status !== 'completed') continue;
    const date = s.created_at?.split('T')[0];
    if (!date) continue;
    if (!byDate[date]) byDate[date] = { date, total_ml: 0, total_rwf: 0 };
    byDate[date].total_ml += s.volume_ml || 0;
    byDate[date].total_rwf += s.cost_rwf || 0;
  }
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

/* Convert a sorted daily array into today-vs-yesterday pairs */
function toDualFormat(sorted) {
  return sorted.slice(-14).map((item, i, arr) => ({
    date:         item.date?.slice(5) || item.date,     // "2026-06-11" → "06-11"
    today_ml:     item.total_ml     || 0,
    yesterday_ml: arr[i - 1]?.total_ml || 0,
  }));
}

/*
 * Build chart data — priority order:
 *  1. prediction.chartData  (AI service, 60-day history, most accurate)
 *  2. daily_usage API data  (myUsage — last 30 days aggregated)
 *  3. sessions grouped by date (always fresh, direct from DB)
 *  4. demo sample data       (only when account truly has no activity)
 */
function buildChartData(prediction, usage, sessions) {
  // 1 — prediction chart data (requires ≥3 data points)
  if (prediction?.chartData?.length >= 2) {
    const mapped = prediction.chartData.map(d => ({ date: d.date, total_ml: d.ml || 0 }));
    if (mapped.some(d => d.total_ml > 0)) return { data: toDualFormat(mapped), isDemo: false };
  }

  // 2 — daily_usage table data
  if (usage?.length > 0 && usage.some(u => u.total_ml > 0)) {
    const sorted = [...usage].sort((a, b) => a.date.localeCompare(b.date));
    return { data: toDualFormat(sorted), isDemo: false };
  }

  // 3 — build from sessions (e.g. daily_usage not yet synced)
  const fromSessions = buildChartFromSessions(sessions || []);
  if (fromSessions.length > 0 && fromSessions.some(d => d.total_ml > 0)) {
    return { data: toDualFormat(fromSessions), isDemo: false };
  }

  // 4 — demo fallback
  return { data: generateDemoData(14), isDemo: true };
}

export default function CustomerDashboard() {
  const location = useLocation();
  const { user, profile, refreshProfile } = useAuth();
  const tab = getSectionFromPath(location.pathname);

  const [cards,            setCards]           = useState([]);
  const [prediction,       setPrediction]      = useState(null);
  const [usage,            setUsage]           = useState([]);
  const [alerts,           setAlerts]          = useState([]);
  const [sessions,         setSessions]        = useState([]);
  const [rechargeAmount,   setRechargeAmount]  = useState('');
  const [rechargeRwf,      setRechargeRwf]     = useState('');
  const [selectedCard,     setSelectedCard]    = useState('');
  const [msg,              setMsg]             = useState('');
  const [error,            setError]           = useState(null);

  const [profileEdit,   setProfileEdit]   = useState({ full_name: '' });
  const [pwForm,        setPwForm]        = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [profileMsg,    setProfileMsg]    = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [pwSaving,      setPwSaving]      = useState(false);
  const [showEditModal,   setShowEditModal]  = useState(false);
  const [showPwModal,     setShowPwModal]    = useState(false);
  const [pwVisible,       setPwVisible]      = useState({ current_password: false, new_password: false, confirm_password: false });

  const [tabLoading, setTabLoading] = useState(false);
  const loadedTabs = useRef(new Set());

  /* ── Live session tracking (Fetch Water step flow) ─────── */
  const [activeSessionId,  setActiveSessionId]  = useState(null);
  const [liveSession,      setLiveSession]      = useState(null);
  const [cmdSending,       setCmdSending]       = useState(false);
  const [elapsedSec,       setElapsedSec]       = useState(0);
  const [pumpRunning,      setPumpRunning]      = useState(false); // local pump state
  const pollRef    = useRef(null);
  const timerRef   = useRef(null);

  const startSessionPoll = (sessionId) => {
    stopSessionPoll();

    // Adaptive polling: fast while waiting for card tap, then moderate once active
    // sessionPhaseRef tracks which phase we're in so we can restart with a new interval
    const FAST_MS   = 150;  // waiting_tap  — need to catch card scan immediately
    const NORMAL_MS = 400;  // card_scanned / pumping

    let currentInterval = FAST_MS;

    const tick = async () => {
      try {
        const res = await api.getSession(sessionId);
        const s = res.session;
        setLiveSession(s);
        if (s.pump_started_at) setPumpRunning(true);

        if (s.status === 'completed' || s.status === 'blocked') {
          stopSessionPoll();
          setPumpRunning(false);
          cacheInvalidate('cust-');
          loadedTabs.current.delete('overview');
          loadedTabs.current.delete('history');
          loadCards(true);
          loadOverview(true);
          return;
        }

        // Switch to slower polling once card is tapped (no need for 150ms anymore)
        const wantInterval = s.card_tapped_at ? NORMAL_MS : FAST_MS;
        if (wantInterval !== currentInterval) {
          currentInterval = wantInterval;
          clearInterval(pollRef.current);
          pollRef.current = setInterval(tick, currentInterval);
        }
      } catch (_) {}
    };

    // Fire once immediately so UI updates without waiting for first interval
    tick();
    pollRef.current = setInterval(tick, currentInterval);
  };

  const stopSessionPoll = () => {
    if (pollRef.current)  { clearInterval(pollRef.current);  pollRef.current  = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const resetFetchFlow = () => {
    stopSessionPoll();
    setActiveSessionId(null);
    setLiveSession(null);
    setElapsedSec(0);
    setCmdSending(false);
    setPumpRunning(false);
    setFetchingRequest(false);
    setRechargeAmount('');
    setMsg('');
  };

  /* Start elapsed-time counter when pump is running (local state OR pump_started_at from DB) */
  useEffect(() => {
    const isPumping = pumpRunning || !!liveSession?.pump_started_at;
    if (!isPumping || liveSession?.status === 'completed') return;
    if (timerRef.current) return;
    const startedAt = liveSession?.pump_started_at
      ? new Date(liveSession.pump_started_at).getTime()
      : Date.now();
    timerRef.current = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [pumpRunning, liveSession?.pump_started_at, liveSession?.status]); // eslint-disable-line

  /* If DB now has pump_started_at, sync local state */
  useEffect(() => {
    if (liveSession?.pump_started_at && !pumpRunning) setPumpRunning(true);
  }, [liveSession?.pump_started_at]); // eslint-disable-line

  const sendCmd = async (action) => {
    if (!activeSessionId || activeSessionId === 'pending') return;
    setCmdSending(true);

    // Optimistic update — reflect instantly in UI
    if (action === 'start_pump') setPumpRunning(true);
    if (action === 'stop_pump')  setPumpRunning(false);

    try {
      await api.sessionCommand(activeSessionId, action);
    } catch (e) {
      // Revert optimistic update on error
      if (action === 'start_pump') setPumpRunning(false);
      if (action === 'stop_pump')  setPumpRunning(true);
      setMsg(e.message || 'Command failed');
    } finally {
      setCmdSending(false);
    }
  };

  useEffect(() => () => stopSessionPoll(), []); // cleanup on unmount

  /* Load cards once — needed for every tab */
  const loadCards = async (force = false) => {
    if (!force && loadedTabs.current.has('cards')) return;
    try {
      const res = await cached('cust-cards', () => api.myCards(), 30_000);
      setCards(res.cards || []);
      if (res.cards?.[0] && !selectedCard) setSelectedCard(res.cards[0].card_uid);
      loadedTabs.current.add('cards');
    } catch (e) {
      setError(e.message || 'Failed to load cards.');
    }
  };

  /* Overview data: prediction + usage + alerts + sessions */
  const loadOverview = async (force = false) => {
    if (!force && loadedTabs.current.has('overview')) return;
    setTabLoading(true);
    try {
      const [predRes, usageRes, alertRes, sessRes] = await Promise.allSettled([
        cached(`cust-predict-${user?.id}`, () => api.predict(user?.id), 120_000),
        cached('cust-usage',               () => api.myUsage(),          60_000),
        cached('cust-alerts',              () => api.leakAlerts(false),  30_000),
        cached('cust-sessions',            () => api.sessions(),         30_000),
      ]);
      if (predRes.status  === 'fulfilled') setPrediction(predRes.value.prediction);
      if (usageRes.status === 'fulfilled') setUsage(usageRes.value.data || []);
      if (alertRes.status === 'fulfilled') setAlerts(alertRes.value.alerts || []);
      if (sessRes.status  === 'fulfilled') setSessions(sessRes.value.sessions || []);
      loadedTabs.current.add('overview');
    } catch (e) {
      setError(e.message || 'Failed to load overview.');
    } finally { setTabLoading(false); }
  };

  /* History: needs sessions */
  const loadHistory = async (force = false) => {
    if (!force && loadedTabs.current.has('history')) return;
    setTabLoading(true);
    try {
      const res = await cached('cust-sessions', () => api.sessions(), 30_000);
      setSessions(res.sessions || []);
      loadedTabs.current.add('history');
    } catch (e) {
      setError(e.message || 'Failed to load history.');
    } finally { setTabLoading(false); }
  };

  /* Refresh current tab (bypasses cache) */
  const load = () => {
    cacheInvalidate('cust-');
    loadedTabs.current.clear();
    loadCards(true);
    const t = tab;
    if (t === 'overview')          loadOverview(true);
    else if (t === 'history')      loadHistory(true);
  };

  /* On mount: load cards immediately, then load overview data */
  useEffect(() => {
    if (!user) return;
    loadedTabs.current.clear();
    loadCards(true).then(() => loadOverview(true));
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  /* When switching to history tab, load sessions if not yet loaded */
  useEffect(() => {
    if (tab === 'history') loadHistory();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (profile) setProfileEdit({ full_name: profile.full_name || '' });
  }, [profile]);

  const [fetchingRequest, setFetchingRequest] = useState(false);

  const handleFetch = async (e) => {
    e.preventDefault();
    setMsg('');
    const liters = parseFloat(rechargeAmount);
    if (!liters || liters <= 0) { setMsg('❌ Enter a valid volume greater than 0'); return; }
    if (!selectedCard)           { setMsg('❌ No card selected.'); return; }

    // Immediately show active session UI — don't wait for network
    setFetchingRequest(true);
    setActiveSessionId('pending');
    setLiveSession(null);

    try {
      const res = await api.authorize({ card_uid: selectedCard, requested_ml: Math.round(liters * 1000) });
      if (res.session?.id) {
        setActiveSessionId(res.session.id);
        setLiveSession(res.session);
        startSessionPoll(res.session.id);
      } else {
        setMsg('✅ Request created — tap your card at the dispenser.');
        setActiveSessionId(null);
        load();
      }
    } catch (err) {
      // Reset on error
      setActiveSessionId(null);
      setLiveSession(null);
      const codeMessages = {
        INSUFFICIENT_BALANCE:        err.message || '❌ Insufficient balance. Please recharge your card.',
        MINIMUM_BALANCE_REQUIRED:    err.message || '❌ Balance too low to start. Please recharge your card.',
        CARD_NOT_REGISTERED:         '❌ Your card has no RFID chip linked. Ask a WASAC agent to scan your card.',
        ACCOUNT_NOT_APPROVED:        '❌ Your account is pending approval by a WASAC manager.',
        ACCOUNT_PENDING_APPROVAL:    '❌ Your account is pending approval by a WASAC manager.',
        SYSTEM_WATER_FETCH_DISABLED: '❌ Water dispensing is temporarily stopped by the admin. Try again later.',
        CARD_NOT_FOUND:              '❌ Card not found. Make sure your card is properly registered.',
        CARD_INACTIVE:               '❌ Your card is inactive. Contact WASAC support.',
        INVALID_VOLUME_REQUEST:      '❌ Please enter a valid volume.',
      };
      setMsg(codeMessages[err.code] || `❌ ${err.message}`);
    } finally {
      setFetchingRequest(false);
    }
  };

  const handleTopUp = async (e) => {
    e.preventDefault();
    setMsg('');
    try {
      const amount = parseFloat(rechargeRwf);
      if (!amount || amount <= 0) throw new Error('Enter a valid amount');
      const card = cards.find(c => c.card_uid === selectedCard);
      if (!card) throw new Error('Card not found');
      await api.recharge({ card_id: card.id, amount_rwf: amount });
      setMsg(`✅ Topped up ${amount.toLocaleString()} RWF!`);
      setRechargeRwf('');
      load();
    } catch (err) { setMsg(`❌ ${err.message}`); }
  };

  const downloadBill = async () => {
    try {
      const now  = new Date();
      const blob = await api.downloadBill(user.id, now.getFullYear(), now.getMonth() + 1);
      downloadBlob(blob, `bill-${now.getFullYear()}-${now.getMonth() + 1}.pdf`);
      setMsg('✅ Bill downloaded.'); setTimeout(() => setMsg(''), 3000);
    } catch (err) { setMsg(`❌ ${err.message}`); }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileSaving(true); setProfileMsg('');
    try {
      await api.updateProfile({ full_name: profileEdit.full_name });
      if (refreshProfile) await refreshProfile();
      setProfileMsg('✅ Profile updated successfully.');
      setShowEditModal(false);
    } catch (err) { setProfileMsg(`❌ ${err.message}`); }
    finally { setProfileSaving(false); }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm_password) { setProfileMsg('❌ Passwords do not match.'); return; }
    if (pwForm.new_password.length < 8) { setProfileMsg('❌ Minimum 8 characters required.'); return; }
    setPwSaving(true); setProfileMsg('');
    try {
      await api.changePassword({ current_password: pwForm.current_password, new_password: pwForm.new_password });
      setProfileMsg('✅ Password changed successfully.');
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
      setShowPwModal(false);
    } catch (err) { setProfileMsg(`❌ ${err.message}`); }
    finally { setPwSaving(false); }
  };

  const primaryCard = cards[0];
  const balance     = primaryCard?.balance_rwf ?? 0;
  const isApproved  = (profile?.account_status || 'approved') === 'approved';
  const cardReady   = primaryCard?.rfid_uid;
  const { data: dualData, isDemo: isChartDemo } = buildChartData(prediction, usage, sessions);
  const completedSessions = sessions.filter(s => s.status === 'completed').length;
  const pendingSessions   = sessions.filter(s => s.status === 'pending').length;

  return (
    <Layout navSections={navSections}>
      <div className="dashboard-page">

        {/* Alerts */}
        {!isApproved && (
          <div className="alert-banner">
            <strong>⚠️ Account Pending Approval</strong>
            <p style={{ marginTop: 4, fontSize: '0.8rem' }}>Your access is <strong>{profile?.account_status}</strong>. A manager will approve it shortly.</p>
          </div>
        )}
        {error && (
          <div className="alert-banner">
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <span>❌ {error}</span>
              <button className="btn-secondary btn-sm" onClick={load}>Retry</button>
            </div>
          </div>
        )}
        {msg && <div className={msg.startsWith('✅') ? 'success-banner' : 'alert-banner'}>{msg}</div>}
        <LeakAlerts alerts={alerts} />

        {/* Tab loading indicator */}
        {tabLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', marginBottom: 'var(--space-sm)', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            Loading…
          </div>
        )}

        {/* ══════════════════ OVERVIEW ══════════════════ */}
        {tab === 'overview' && (
          <>
            {/* 3 KPI cards */}
            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 'var(--space-md)' }}>
              <KpiCard
                label="Water Dispensed"
                value={`${(sessions.reduce((s,x)=> s + (x.volume_ml||0), 0)/1000).toFixed(0)}`}
                suffix="L"
                colorVariant="kpi-cyan"
                icon="💧"
                trend={sessions.length > 0 ? 'up' : null}
                trendLabel={`${sessions.length} sessions`}
              />
              <KpiCard
                label="Pending"
                value={String(pendingSessions).padStart(2, '0')}
                colorVariant="kpi-coral"
                icon="⏳"
                trend={pendingSessions > 0 ? 'down' : null}
                trendLabel={pendingSessions > 0 ? 'awaiting tap' : ''}
              />
              <KpiCard
                label="Completed"
                value={String(completedSessions).padStart(2, '0')}
                colorVariant="kpi-purple"
                icon="✓"
                trend={completedSessions > 0 ? 'up' : null}
                trendLabel={`${balance.toLocaleString()} RWF balance`}
              />
            </div>

            {/* Main 2-col layout: left (Inbox + Activity) | right (Today's trends) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.05fr', gap: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>

              {/* ── Left column ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

                {/* Inbox — recent sessions */}
                <div className="panel-card" style={{ padding: 'var(--space-lg)' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Inbox</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Water Sessions</div>
                    </div>
                    <a href="/dashboard/history" className="panel-heading-link">View details</a>
                  </div>

                  <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 'var(--space-sm)', marginTop: 'var(--space-sm)' }} />

                  {sessions.length === 0 ? null : (
                    sessions.slice(0, 4).map((s) => (
                      <div key={s.id} className="inbox-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                            background: s.status === 'completed' ? 'rgba(67,97,238,0.1)' : s.status === 'blocked' ? 'rgba(240,68,56,0.1)' : 'rgba(247,144,9,0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.85rem',
                          }}>
                            {s.status === 'completed' ? '💧' : s.status === 'blocked' ? '🚫' : '⏳'}
                          </div>
                          <div>
                            <div className="inbox-row-title">{(s.volume_ml / 1000).toFixed(1)} L — {s.cost_rwf.toLocaleString()} RWF</div>
                            <div className="inbox-row-sub">{s.status === 'completed' ? 'Completed' : s.status === 'blocked' ? 'Blocked' : 'Pending'}</div>
                          </div>
                        </div>
                        <div className="inbox-row-time">
                          {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Recent Activity */}
                <div className="panel-card" style={{ padding: 'var(--space-lg)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Recent Activity</div>
                    <a href="/dashboard/history" className="panel-heading-link">View all</a>
                  </div>

                  {[
                    {
                      icon: balance >= 1000 ? '✓' : '!',
                      type: balance >= 1000 ? 'done' : 'pending',
                      label: 'Card balance',
                      sub: `${balance.toLocaleString()} RWF`,
                      badge: balance >= 1000 ? { text: 'GOOD', cls: 'done' } : { text: 'LOW', cls: 'urgent' },
                    },
                    {
                      icon: isApproved ? '✓' : '○',
                      type: isApproved ? 'done' : 'pending',
                      label: 'Account status',
                      sub: profile?.email?.split('@')[0] || '—',
                      badge: isApproved ? { text: 'APPROVED', cls: 'done' } : { text: 'PENDING', cls: 'urgent' },
                    },
                    {
                      icon: cardReady ? '✓' : '○',
                      type: cardReady ? 'done' : 'new',
                      label: 'RFID card',
                      sub: cardReady ? `ID: ${primaryCard?.rfid_uid}` : 'Not linked yet',
                      badge: cardReady ? { text: 'LINKED', cls: 'done' } : { text: 'PENDING', cls: 'new-tag' },
                    },
                    sessions[0] && {
                      icon: '💧',
                      type: 'done',
                      label: 'Last fetch',
                      sub: new Date(sessions[0].created_at).toLocaleDateString(),
                      badge: { text: 'DONE', cls: 'done' },
                    },
                  ].filter(Boolean).map((item, idx) => (
                    <div key={idx} className="activity-row">
                      <div className={`activity-dot ${item.type}`}>{item.icon}</div>
                      <div className="activity-label">
                        {item.label}
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400, marginTop: 1 }}>{item.sub}</div>
                      </div>
                      <span className={`activity-badge ${item.badge.cls}`}>{item.badge.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Right column: Today's trends chart ── */}
              <div className="panel-card">
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Today's trends</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  {/* Legend */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#4361ee" strokeWidth="2.5" strokeLinecap="round"/></svg>
                      Today
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#f77f7f" strokeWidth="2" strokeDasharray="5,3" strokeLinecap="round"/></svg>
                      Yesterday
                    </span>
                  </div>
                </div>

                {/* Chart — always shows (demo data if no real data) */}
                <UsageDualLineChart data={dualData} todayKey="today_ml" yesterdayKey="yesterday_ml" />

                {/* Quick stats below chart */}
                <div style={{ display: 'flex', gap: 'var(--space-lg)', marginTop: 'var(--space-md)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg Daily</div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', marginTop: 2 }}>
                      {isChartDemo ? '35 L' : `${Math.round((prediction?.averageDailyMl ?? 0) / 1000 * 10) / 10} L`}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Monthly Est.</div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', marginTop: 2 }}>
                      {isChartDemo ? '21,000 RWF' : `${(prediction?.expectedMonthlyBill ?? 0).toLocaleString()} RWF`}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trend</div>
                    <div style={{ fontWeight: 800, fontSize: '0.88rem', marginTop: 2, color: prediction?.trend === 'increasing' ? '#f77f7f' : prediction?.trend === 'decreasing' ? 'var(--success)' : 'var(--text-primary)' }}>
                      {prediction?.trend === 'increasing' ? '↑ Rising' : prediction?.trend === 'decreasing' ? '↓ Falling' : '→ Stable'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Customer Support box (like image bottom-left of sidebar) rendered here as info */}
            <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn-secondary btn-sm" onClick={downloadBill}>📄 Download Monthly Bill</button>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Need help? Contact support via WhatsApp →
              </span>
            </div>
          </>
        )}

        {/* ══════════════════ PROFILE ══════════════════ */}
        {tab === 'profile' && (
          <section className="dashboard-section">

            {profileMsg && (
              <div className={profileMsg.startsWith('✅') ? 'success-banner' : 'alert-banner'} style={{ marginBottom: 'var(--space-md)' }}>
                {profileMsg}
              </div>
            )}

            {/* ── Compact info card ── */}
            <div style={{ maxWidth: 420 }}>
              <div className="panel-card">
                {/* Avatar + name row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 52, height: 52, background: 'var(--primary-gradient)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                    {(profile?.full_name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{profile?.full_name || '—'}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{profile?.email || '—'}</div>
                    <span className="badge badge-info" style={{ marginTop: 4, display: 'inline-block' }}>
                      {profile?.role === 'wasac_manager' ? 'Manager' : profile?.role || 'customer'}
                    </span>
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button
                    onClick={() => { setProfileEdit({ full_name: profile?.full_name || '' }); setShowEditModal(true); }}
                    style={{ padding: '6px 14px', fontSize: '0.78rem', fontWeight: 600, background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
                  >
                    ✏️ Edit Info
                  </button>
                  <button
                    onClick={() => { setPwForm({ current_password: '', new_password: '', confirm_password: '' }); setShowPwModal(true); }}
                    style={{ padding: '6px 14px', fontSize: '0.78rem', fontWeight: 600, background: 'var(--surface2)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
                  >
                    🔑 Change Password
                  </button>
                </div>
              </div>
            </div>

            {/* ── Edit Info Modal ── */}
            <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Profile">
              <form onSubmit={e => { handleProfileSave(e); }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Full Name</label>
                  <input
                    type="text"
                    value={profileEdit.full_name}
                    onChange={e => setProfileEdit({ full_name: e.target.value })}
                    required
                    autoFocus
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', background: 'var(--surface)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Email</label>
                  <input
                    type="email"
                    value={profile?.email || ''}
                    disabled
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', background: 'var(--surface2)', color: 'var(--text-muted)', cursor: 'not-allowed', boxSizing: 'border-box' }}
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Email cannot be changed here.</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                  <button type="button" onClick={() => setShowEditModal(false)} style={{ padding: '6px 14px', fontSize: '0.78rem', fontWeight: 600, background: 'var(--surface2)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={profileSaving} style={{ padding: '6px 14px', fontSize: '0.78rem', fontWeight: 600, background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: profileSaving ? 'not-allowed' : 'pointer', opacity: profileSaving ? 0.7 : 1 }}>
                    {profileSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </Modal>

            {/* ── Change Password Modal ── */}
            <Modal isOpen={showPwModal} onClose={() => { setShowPwModal(false); setPwVisible({ current_password: false, new_password: false, confirm_password: false }); }} title="Change Password">
              <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { key: 'current_password', label: 'Current Password' },
                  { key: 'new_password',     label: 'New Password (min. 8 chars)', min: 8 },
                  { key: 'confirm_password', label: 'Confirm New Password' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>{f.label}</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={pwVisible[f.key] ? 'text' : 'password'}
                        value={pwForm[f.key]}
                        onChange={e => setPwForm(p => ({ ...p, [f.key]: e.target.value }))}
                        required
                        minLength={f.min}
                        style={{ width: '100%', padding: '9px 38px 9px 11px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '0.88rem', background: 'var(--surface)', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none' }}
                      />
                      <button
                        type="button"
                        onClick={() => setPwVisible(v => ({ ...v, [f.key]: !v[f.key] }))}
                        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--text-muted)', padding: 2, lineHeight: 1 }}
                        title={pwVisible[f.key] ? 'Hide' : 'Show'}
                      >
                        {pwVisible[f.key] ? '🙈' : '👁️'}
                      </button>
                    </div>
                    {f.key === 'confirm_password' && pwForm.confirm_password.length > 0 && (
                      <span style={{ fontSize: '0.72rem', color: pwForm.new_password === pwForm.confirm_password ? 'var(--success)' : 'var(--danger)', marginTop: 4, display: 'block' }}>
                        {pwForm.new_password === pwForm.confirm_password ? '✓ Passwords match' : '✗ Passwords do not match'}
                      </span>
                    )}
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                  <button type="button" onClick={() => setShowPwModal(false)} style={{ padding: '6px 14px', fontSize: '0.78rem', fontWeight: 600, background: 'var(--surface2)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={pwSaving} style={{ padding: '6px 14px', fontSize: '0.78rem', fontWeight: 600, background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: pwSaving ? 'not-allowed' : 'pointer', opacity: pwSaving ? 0.7 : 1 }}>
                    {pwSaving ? 'Updating…' : 'Update Password'}
                  </button>
                </div>
              </form>
            </Modal>

          </section>
        )}

        {/* ══════════════════ FETCH WATER ══════════════════ */}
        {tab === 'fetch' && (() => {
          /* ── determine fetch step ── */
          const step = !activeSessionId && !fetchingRequest   ? 'form'
            : liveSession?.status === 'completed'             ? 'done'
            : liveSession?.status === 'blocked'               ? 'blocked'
            : (pumpRunning || !!liveSession?.pump_started_at) ? 'pumping'
            : !!liveSession?.card_tapped_at                   ? 'card_scanned'
            :                                                   'waiting_tap';

          const stepColor   = { form: '#4361ee', waiting_tap: '#f4a100', card_scanned: '#0acf97', pumping: '#4361ee', done: '#12b76a', blocked: '#e63946' };
          const currentCard = cards.find(c => c.card_uid === selectedCard) || primaryCard;

          return (
            <section className="dashboard-section" style={{ display: 'flex', justifyContent: 'center', paddingTop: 'var(--space-xl)' }}>
              <div style={{ width: '100%', maxWidth: 480 }}>

                {/* ── Card info bar ── */}
                <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', padding: '14px 20px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 44, height: 44, background: 'rgba(67,97,238,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>💳</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Your Card</div>
                    <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                      RFID: {currentCard?.rfid_uid || <span style={{ color: '#e63946' }}>Not linked</span>}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 1 }}>
                      Status: {cardReady ? <span style={{ color: '#12b76a', fontWeight: 700 }}>✓ Active</span> : <span style={{ color: '#e63946', fontWeight: 700 }}>✗ RFID not linked</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.15rem', fontWeight: 900, color: balance < 100 ? '#e63946' : '#12b76a' }}>{balance.toLocaleString()} RWF</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>≈ {(balance / 20).toFixed(1)} L available</div>
                  </div>
                </div>

                {/* ── Main card ── */}
                <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-2xl)', boxShadow: '0 8px 32px rgba(67,97,238,0.13)', border: '1px solid var(--border)', overflow: 'hidden' }}>

                  {/* Header */}
                  <div style={{ background: `linear-gradient(135deg, ${stepColor[step]}, ${stepColor[step]}cc)`, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                      {step === 'form' ? '💧' : step === 'waiting_tap' ? '📡' : step === 'card_scanned' ? '✅' : step === 'pumping' ? '💧' : step === 'done' ? '🎉' : '❌'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1rem', color: '#fff' }}>
                        {step === 'form'         ? 'Fetch Water'
                        : step === 'waiting_tap' ? (fetchingRequest ? 'Requesting…' : 'Tap Your Card at the Kiosk')
                        : step === 'card_scanned'? 'Card Scanned — Press START'
                        : step === 'pumping'     ? 'Water Is Flowing…'
                        : step === 'done'        ? 'Done!'
                        :                         'Request Blocked'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.8)' }}>
                        {step === 'form'          ? `Balance: ${balance.toLocaleString()} RWF`
                        : step === 'waiting_tap'  ? `${liveSession?.requested_ml ? (liveSession.requested_ml/1000).toFixed(1) + ' L — hold card to the RFID reader' : 'Checking balance…'}`
                        : step === 'card_scanned' ? `✓ Card verified — ${liveSession?.requested_ml ? (liveSession.requested_ml/1000).toFixed(1) : '?'} L ready`
                        : step === 'pumping'      ? `Dispensing ${liveSession?.requested_ml ? (liveSession.requested_ml/1000).toFixed(1) : '?'} L`
                        : step === 'done'         ? `${(liveSession?.volume_ml/1000||0).toFixed(2)} L · ${liveSession?.cost_rwf?.toLocaleString()||0} RWF`
                        :                          liveSession?.message || 'See error below'}
                      </div>
                    </div>
                    {step !== 'form' && (
                      <button onClick={resetFetchFlow} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 99, color: '#fff', fontWeight: 700, fontSize: '0.75rem', padding: '4px 12px', cursor: 'pointer' }}>
                        {step === 'done' || step === 'blocked' ? '+ New' : step === 'pumping' ? '⏹ Stop' : 'Cancel'}
                      </button>
                    )}
                  </div>

                  {/* Body */}
                  <div style={{ padding: '22px' }}>

                    {/* ── FORM step ── */}
                    {step === 'form' && (
                      <>
                        {!isApproved ? (
                          <div style={{ textAlign: 'center', padding: '20px 0' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>⏳</div>
                            <div style={{ fontWeight: 700 }}>Account Pending Approval</div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 6 }}>A WASAC manager must approve your account first.</div>
                          </div>
                        ) : !cardReady ? (
                          <div style={{ textAlign: 'center', padding: '20px 0' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>💳</div>
                            <div style={{ fontWeight: 700 }}>RFID Not Linked</div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 6 }}>Ask a WASAC agent to scan your card at a terminal to link the RFID chip.</div>
                          </div>
                        ) : (
                          <form onSubmit={handleFetch} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {msg && !msg.startsWith('✅') && (
                              <div style={{ background: 'rgba(230,57,70,0.08)', border: '1px solid rgba(230,57,70,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: '0.82rem', color: '#c0392b', fontWeight: 600 }}>{msg}</div>
                            )}
                            {balance < 100 && (
                              <div style={{ background: 'rgba(255,165,0,0.08)', border: '1px solid rgba(255,165,0,0.4)', borderRadius: 8, padding: '10px 14px', fontSize: '0.82rem', color: '#b8860b', fontWeight: 600 }}>
                                ⚠️ Balance {balance.toLocaleString()} RWF — minimum 100 RWF required. Please recharge first.
                              </div>
                            )}
                            {cards.length > 1 && (
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label>Card</label>
                                <select value={selectedCard} onChange={e => setSelectedCard(e.target.value)}>
                                  {cards.map(c => <option key={c.id} value={c.card_uid}>{c.rfid_uid || c.card_uid} — {c.balance_rwf.toLocaleString()} RWF</option>)}
                                </select>
                              </div>
                            )}
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Volume (Litres)</label>
                              <input type="number" min="0.1" step="0.1" value={rechargeAmount} onChange={e => setRechargeAmount(e.target.value)} placeholder="e.g., 10" required />
                            </div>
                            {rechargeAmount > 0 && (
                              <div style={{ background: 'rgba(67,97,238,0.07)', border: '1px solid rgba(67,97,238,0.15)', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Estimated cost</span>
                                <strong style={{ color: 'var(--primary)', fontSize: '1rem' }}>{(parseFloat(rechargeAmount) * 20).toLocaleString()} RWF</strong>
                              </div>
                            )}
                            <button type="submit" className="btn-primary" disabled={balance < 100} style={{ width: '100%', padding: '12px', fontSize: '0.95rem', fontWeight: 700, borderRadius: 10 }}>
                              {balance < 100 ? '⚠️ Insufficient Balance — Recharge First' : '💧 Request Water'}
                            </button>
                          </form>
                        )}
                      </>
                    )}

                    {/* ── WAITING TAP step — tap card first ── */}
                    {step === 'waiting_tap' && (
                      <div style={{ padding: '8px 0' }}>
                        {fetchingRequest ? (
                          <div style={{ textAlign: 'center', padding: '24px 0' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: 12, animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</div>
                            <div style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>Checking balance & creating session…</div>
                          </div>
                        ) : (
                          <>
                            {/* Stats */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
                              {[
                                { label: 'Balance',   value: `${balance.toLocaleString()} RWF`,                                  color: '#12b76a' },
                                { label: 'Requested', value: `${liveSession?.requested_ml ? (liveSession.requested_ml/1000).toFixed(1) : '?'} L`, color: '#4361ee' },
                                { label: 'Cost est.', value: `${liveSession?.requested_ml ? Math.round(liveSession.requested_ml * 0.02) : '?'} RWF`, color: '#e63946' },
                              ].map(s => (
                                <div key={s.label} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
                                  <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>{s.label}</div>
                                  <div style={{ fontWeight: 800, fontSize: '0.88rem', color: s.color, marginTop: 3 }}>{s.value}</div>
                                </div>
                              ))}
                            </div>

                            {/* Tap card instruction — big and clear */}
                            <div style={{ background: 'rgba(243,164,0,0.08)', border: '2px solid rgba(243,164,0,0.5)', borderRadius: 12, padding: '20px 16px', textAlign: 'center', marginBottom: 14 }}>
                              <div style={{ fontSize: '3rem', marginBottom: 8, animation: 'spin 3s linear infinite', display: 'inline-block' }}>📡</div>
                              <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 6 }}>Tap your RFID card on the reader</div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Hold the card close to the device until you see the LED flash</div>
                            </div>

                            {/* Pulse dots */}
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                              {[1,2,3].map(i => (
                                <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#f4a100', opacity: 0.3 + i * 0.25, animation: `pulse-red ${i * 0.4 + 0.6}s ease-in-out infinite alternate` }} />
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* ── CARD SCANNED step — card verified, show START ── */}
                    {step === 'card_scanned' && (
                      <div style={{ padding: '8px 0' }}>
                        {/* Success banner */}
                        <div style={{ background: 'rgba(10,207,151,0.08)', border: '2px solid rgba(10,207,151,0.4)', borderRadius: 12, padding: '14px 16px', textAlign: 'center', marginBottom: 16 }}>
                          <div style={{ fontSize: '2rem', marginBottom: 6 }}>✅</div>
                          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0acf97' }}>Card Verified!</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            Balance checked — ready to dispense <strong>{liveSession?.requested_ml ? (liveSession.requested_ml/1000).toFixed(1) : '?'} L</strong>
                          </div>
                        </div>

                        {/* START button */}
                        <button
                          className="btn-primary"
                          style={{ width: '100%', padding: '15px', fontSize: '1.05rem', fontWeight: 900, borderRadius: 12, marginBottom: 12, background: 'linear-gradient(135deg,#12b76a,#0093e9)', border: 'none' }}
                          disabled={cmdSending}
                          onClick={() => sendCmd('start_pump')}
                        >
                          {cmdSending ? '⏳ Starting…' : '▶  Start Water Now'}
                        </button>

                        <div style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          Or press the green hardware button on the device
                        </div>
                      </div>
                    )}

                    {/* ── PUMPING step ── */}
                    {step === 'pumping' && (() => {
                      const targetL   = (liveSession?.requested_ml || 0) / 1000;
                      const FLOW_LPM  = 2.0; // estimated flow rate L/min (adjust to your sensor)
                      const estL      = Math.min(targetL, (elapsedSec / 60) * FLOW_LPM);
                      const pct       = targetL > 0 ? Math.min(100, (estL / targetL) * 100) : 0;
                      const mins      = Math.floor(elapsedSec / 60);
                      const secs      = elapsedSec % 60;
                      return (
                        <div style={{ padding: '16px 0' }}>
                          {/* Title */}
                          <div style={{ textAlign: 'center', marginBottom: 16 }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: 6 }}>💧</div>
                            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#4361ee' }}>Water Is Flowing!</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                              {mins > 0 ? `${mins}m ` : ''}{secs}s elapsed
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div style={{ background: 'var(--surface2)', borderRadius: 8, height: 10, overflow: 'hidden', marginBottom: 12 }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,#4361ee,#0093e9)', borderRadius: 8, transition: 'width 1s linear' }} />
                          </div>

                          {/* Stats row */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
                            {[
                              { label: 'Est. Volume',  value: `${estL.toFixed(2)} L` },
                              { label: 'Target',       value: `${targetL.toFixed(1)} L` },
                              { label: 'Est. Cost',    value: `${(estL * 20).toFixed(0)} RWF` },
                            ].map(s => (
                              <div key={s.label} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '8px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>{s.label}</div>
                                <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-primary)', marginTop: 2 }}>{s.value}</div>
                              </div>
                            ))}
                          </div>

                          {/* STOP button */}
                          <button
                            className="btn-danger"
                            style={{ width: '100%', padding: '12px', fontSize: '1rem', fontWeight: 800 }}
                            disabled={cmdSending}
                            onClick={() => sendCmd('stop_pump')}
                          >
                            {cmdSending ? '⏳ Stopping…' : '⏹ Stop Water'}
                          </button>
                          <div style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 8 }}>
                            Or tap your RFID card on the device to stop
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── DONE step ── */}
                    {step === 'done' && (() => {
                      const volL      = ((liveSession?.volume_ml || 0) / 1000);
                      const cost      = liveSession?.cost_rwf || 0;
                      const newBal    = cards.find(c => c.card_uid === selectedCard)?.balance_rwf ?? (balance - cost);
                      return (
                        <div style={{ textAlign: 'center', padding: '16px 0' }}>
                          <div style={{ fontSize: '3rem', marginBottom: 8 }}>🎉</div>
                          <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#12b76a', marginBottom: 4 }}>Water Fetched Successfully!</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 16 }}>Session complete</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                            {[
                              { label: 'Volume Dispensed', value: `${volL.toFixed(2)} L`, color: '#4361ee' },
                              { label: 'Total Cost',       value: `${cost.toLocaleString()} RWF`, color: '#e63946' },
                              { label: 'Remaining Balance', value: `${Number(newBal).toLocaleString()} RWF`, color: '#12b76a' },
                              { label: 'Status',           value: '✓ Completed', color: '#12b76a' },
                            ].map(s => (
                              <div key={s.label} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px', textAlign: 'left' }}>
                                <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{s.label}</div>
                                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: s.color }}>{s.value}</div>
                              </div>
                            ))}
                          </div>
                          <button onClick={resetFetchFlow} className="btn-primary" style={{ width: '100%', padding: '12px', fontWeight: 800 }}>💧 Fetch More Water</button>
                        </div>
                      );
                    })()}

                    {/* ── BLOCKED step ── */}
                    {step === 'blocked' && (
                      <div style={{ textAlign: 'center', padding: '16px 0' }}>
                        <div style={{ fontSize: '3rem', marginBottom: 10 }}>❌</div>
                        <div style={{ fontWeight: 700, color: '#e63946', marginBottom: 8 }}>Request Blocked</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16 }}>Insufficient balance or card issue detected.</div>
                        <button onClick={resetFetchFlow} className="btn-secondary" style={{ width: '100%' }}>Try Again</button>
                      </div>
                    )}

                  </div>
                </div>
              </div>
            </section>
          );
        })()}

        {/* ══════════════════ RECHARGE ══════════════════ */}
        {tab === 'recharge' && (
          <section className="dashboard-section" style={{ display: 'flex', justifyContent: 'center', paddingTop: 'var(--space-xl)' }}>
            <div style={{ width: '100%', maxWidth: 460 }}>
              <div style={{
                background: 'var(--surface)',
                borderRadius: 'var(--radius-2xl)',
                boxShadow: '0 8px 32px rgba(18,183,106,0.12)',
                border: '1px solid var(--border)',
                overflow: 'hidden',
              }}>
                {/* Header */}
                <div style={{ background: 'linear-gradient(135deg,#0acf97,#0093e9)', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>💳</div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#fff' }}>Recharge Card</div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.75)' }}>Current balance: {balance.toLocaleString()} RWF</div>
                  </div>
                  <span style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.2)', borderRadius: 999, padding: '3px 10px', fontSize: '0.7rem', color: '#fff', fontWeight: 700 }}>⚡ Instant</span>
                </div>
                {/* Balance strip */}
                <div style={{ background: 'var(--surface2)', padding: '10px 24px', display: 'flex', gap: 'var(--space-xl)', borderBottom: '1px solid var(--border)' }}>
                  {[
                    { label: 'Balance', value: `${balance.toLocaleString()} RWF` },
                    { label: 'Water', value: `${(balance/20).toFixed(1)} L` },
                    { label: 'Rate', value: '20 RWF/L' },
                  ].map(s => (
                    <div key={s.label}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>{s.label}</div>
                      <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)', marginTop: 2 }}>{s.value}</div>
                    </div>
                  ))}
                </div>
                {/* Form */}
                <div style={{ padding: '24px' }}>
                  {!cardReady ? (
                    <div style={{ textAlign: 'center', padding: 'var(--space-2xl) 0' }}>
                      <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>⏳</div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Card Not Linked</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 6 }}>Link your RFID card first.</div>
                    </div>
                  ) : (
                    <form onSubmit={handleTopUp} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Card</label>
                        <select value={selectedCard} onChange={e => setSelectedCard(e.target.value)}>
                          {cards.map(c => (
                            <option key={c.id} value={c.card_uid}>RFID: {c.rfid_uid} — {c.balance_rwf.toLocaleString()} RWF</option>
                          ))}
                        </select>
                      </div>
                      {/* Quick amount chips */}
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Quick amounts</label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {[500, 1000, 2000, 5000].map(amt => (
                            <button key={amt} type="button"
                              onClick={() => setRechargeRwf(String(amt))}
                              style={{
                                padding: '5px 14px', borderRadius: 999, fontSize: '0.8rem', fontWeight: 700,
                                background: rechargeRwf == amt ? 'var(--primary)' : 'var(--surface2)',
                                color: rechargeRwf == amt ? '#fff' : 'var(--text-primary)',
                                border: `1px solid ${rechargeRwf == amt ? 'var(--primary)' : 'var(--border)'}`,
                                cursor: 'pointer', transition: 'all 0.15s',
                              }}>
                              {amt.toLocaleString()}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Amount (RWF)</label>
                        <input type="number" min="100" step="1" value={rechargeRwf} onChange={e => setRechargeRwf(e.target.value)} placeholder="e.g., 1000 RWF" required />
                      </div>
                      {rechargeRwf > 0 && (
                        <div style={{ background: 'rgba(18,183,106,0.07)', border: '1px solid rgba(18,183,106,0.18)', borderRadius: 'var(--radius-md)', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Water added</span>
                          <strong style={{ color: 'var(--success)', fontSize: '1rem' }}>+{(parseFloat(rechargeRwf) / 20).toFixed(1)} L</strong>
                        </div>
                      )}
                      <button type="submit" className="btn-primary" disabled={!isApproved} style={{ width: '100%', marginTop: 4, padding: '12px', fontSize: '0.95rem', fontWeight: 700, borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg,#0acf97,#0093e9)' }}>
                        {!isApproved ? '⏳ Pending Approval' : '💰 Top Up Card'}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ══════════════════ HISTORY ══════════════════ */}
        {tab === 'history' && (
          <section className="dashboard-section">
            <div className="page-hero" style={{ marginBottom: 'var(--space-lg)' }}>
              <p className="page-badge">📜 Records</p>
              <h1 className="page-title">Water Fetch History</h1>
              <p className="page-subtitle">Complete record of all dispensing sessions.</p>
            </div>

            <div className="panel-card">
              <div className="panel-heading">
                All Sessions
                <button className="btn-secondary btn-sm" onClick={downloadBill}>📄 Download Bill PDF</button>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>#</th><th>Date & Time</th><th>Volume (L)</th><th>Cost (RWF)</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {sessions.map((s, i) => (
                      <tr key={s.id}>
                        <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td>{new Date(s.created_at).toLocaleString()}</td>
                        <td><strong>{(s.volume_ml / 1000).toFixed(2)} L</strong></td>
                        <td>{Number(s.cost_rwf || 0).toLocaleString()} RWF</td>
                        <td>
                          <span className={`badge badge-${s.status === 'completed' ? 'success' : s.status === 'blocked' ? 'danger' : 'warning'}`}>
                            {s.status === 'completed' ? '✓ Done' : s.status === 'blocked' ? '✗ Blocked' : '⏳ Pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {sessions.length === 0 && (
                      <tr><td colSpan="5" className="empty-state">No history yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {sessions.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-md)', marginTop: 'var(--space-lg)', padding: 'var(--space-md)', background: 'var(--surface2)', borderRadius: 'var(--radius-lg)' }}>
                  <div>
                    <div className="metric-label">Sessions</div>
                    <div style={{ fontWeight: 800, fontSize: '1.3rem' }}>{sessions.length}</div>
                  </div>
                  <div>
                    <div className="metric-label">Total Water</div>
                    <div style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--primary)' }}>{(sessions.reduce((s,x)=> s+(x.volume_ml||0),0)/1000).toFixed(2)} L</div>
                  </div>
                  <div>
                    <div className="metric-label">Total Spent</div>
                    <div style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--success)' }}>{sessions.reduce((s,x)=> s+(x.cost_rwf||0),0).toLocaleString()} RWF</div>
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
