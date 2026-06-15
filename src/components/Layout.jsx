import { useState, useEffect, useRef } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { api } from '../services/api';
import WhatsAppButton from './WhatsAppButton';

const roleLabels = {
  admin: 'Administrator',
  customer: 'Customer',
  wasac_manager: 'Operations Manager',
};

/* navSections format (optional):
   [{ title: 'MAIN MENU', items: [{ to, label, icon }] }]
   navItems format (legacy/fallback):
   [{ to, label }]
*/
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Layout({ children, navItems, navSections, variant = 'dark', topbarExtra }) {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [isMobile,   setIsMobile]     = useState(false);

  /* ── Theme toggle ── */
  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem('wbTheme') === 'dark'; } catch { return false; }
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    try { localStorage.setItem('wbTheme', isDark ? 'dark' : 'light'); } catch {}
  }, [isDark]);

  /* ── Notification / message state ── */
  const [messages,       setMessages]       = useState([]);
  const [notifications,  setNotifications]  = useState([]);
  const [msgOpen,        setMsgOpen]        = useState(false);
  const [notifOpen,      setNotifOpen]      = useState(false);
  const msgRef   = useRef(null);
  const notifRef = useRef(null);

  /* ── Search state ── */
  const [searchQ,        setSearchQ]        = useState('');
  const [searchResults,  setSearchResults]  = useState([]);
  const [searchOpen,     setSearchOpen]     = useState(false);
  const [searchLoading,  setSearchLoading]  = useState(false);
  const searchRef  = useRef(null);
  const searchTimer = useRef(null);

  const typeIcon = { message: '💬', low_balance: '💳', leak: '🚨', system: 'ℹ️' };

  /* Fetch real notifications once profile is loaded */
  const loadNotifications = () => {
    if (!profile) return;
    api.myNotifications()
      .then(res => {
        const all = res.notifications || [];
        setMessages(all.filter(n => n.type === 'message'));
        setNotifications(all.filter(n => n.type !== 'message'));
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadNotifications();
    // Poll every 15 s for fast notification updates
    const interval = setInterval(loadNotifications, 15_000);
    return () => clearInterval(interval);
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Debounced search */
  const handleSearch = (val) => {
    setSearchQ(val);
    clearTimeout(searchTimer.current);
    if (!val.trim() || val.length < 2) { setSearchResults([]); setSearchOpen(false); return; }
    setSearchLoading(true);
    searchTimer.current = setTimeout(() => {
      api.search(val)
        .then(res => { setSearchResults(res.results || []); setSearchOpen(true); })
        .catch(() => {})
        .finally(() => setSearchLoading(false));
    }, 350);
  };

  /* Close dropdowns on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (msgRef.current    && !msgRef.current.contains(e.target))    setMsgOpen(false);
      if (notifRef.current  && !notifRef.current.contains(e.target))  setNotifOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!isMobile && mobileOpen) setMobileOpen(false);
  }, [isMobile, mobileOpen]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  const isExactOrEnd = (to) =>
    ['/admin', '/dashboard', '/manager', '/'].includes(to);

  const renderNavSections = () => {
    if (navSections) {
      return navSections.map((section) => (
        <div key={section.title} className="sidebar-section">
          <div className="sidebar-section-title">{section.title}</div>
          <nav>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end ?? isExactOrEnd(item.to)}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                onClick={() => isMobile && setMobileOpen(false)}
              >
                {item.icon && (
                  <span className="sidebar-link-icon">{item.icon}</span>
                )}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      ));
    }

    return (
      <div className="sidebar-section">
        <div className="sidebar-title">Main Menu</div>
        <nav>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end ?? isExactOrEnd(item.to)}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={() => isMobile && setMobileOpen(false)}
            >
              <span className="sidebar-link-dot" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    );
  };

  return (
    <div className={`layout layout-${variant}`}>
      {/* Sidebar */}
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <Link to="/" className="sidebar-brand">
            <span className="sidebar-brand-mark">SW</span>
            <span className="sidebar-brand-text">
              Smart Water
              <span style={{ fontSize: '0.65rem', display: 'block', color: 'var(--text-muted)', fontWeight: 400 }}>
                Billing System
              </span>
            </span>
          </Link>
          {isMobile && mobileOpen && (
            <button type="button" className="sidebar-close-mobile" onClick={() => setMobileOpen(false)} aria-label="Close">
              ×
            </button>
          )}
        </div>

        {renderNavSections()}

        {/* User Profile Footer */}
        <div className="sidebar-footer">
          {profile?.account_status === 'pending' && (
            <div className="badge badge-warning" style={{ marginBottom: 'var(--space-sm)', textAlign: 'center', width: '100%', justifyContent: 'center', padding: '4px 8px' }}>
              ⏳ Pending Approval
            </div>
          )}
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{getInitials(profile?.full_name)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sidebar-user-name">
                {profile?.full_name || profile?.email?.split('@')[0] || 'User'}
              </div>
              <div className="sidebar-user-role">
                {roleLabels[profile?.role] || profile?.role || 'Customer'}
              </div>
            </div>
          </div>
          <button type="button" className="btn-secondary sidebar-logout btn-sm" onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {isMobile && mobileOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="layout-main-wrap">
        <header className="topbar">
          {isMobile && (
            <button type="button" className="topbar-menu-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              ☰
            </button>
          )}

          {/* Topbar title / extra content */}
          {topbarExtra ? (
            <div className="topbar-title">{topbarExtra}</div>
          ) : (
            <div className="topbar-title" />
          )}

          <div className="topbar-spacer" />

          {/* Search */}
          <div ref={searchRef} className="topbar-search" style={{ position: 'relative' }}>
            <span className="topbar-search-icon">{searchLoading ? '⏳' : '🔍'}</span>
            <input
              type="search"
              placeholder="Search sessions, cards, users…"
              aria-label="Search"
              value={searchQ}
              onChange={e => handleSearch(e.target.value)}
              onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
            />
            {searchOpen && searchResults.length > 0 && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                width: 320, background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                zIndex: 999, overflow: 'hidden',
              }}>
                {searchResults.map((r, i) => (
                  <div key={i} style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: '1rem' }}>{r.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{r.title}</div>
                      {r.sub && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 1 }}>{r.sub}</div>}
                    </div>
                    {r.time && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', flexShrink: 0 }}>{timeAgo(r.time)}</div>}
                  </div>
                ))}
              </div>
            )}
            {searchOpen && searchResults.length === 0 && !searchLoading && searchQ.length >= 2 && (
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: 260, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', zIndex: 999, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                No results for "{searchQ}"
              </div>
            )}
          </div>

          {/* Action icons */}
          <div className="topbar-actions">

            {/* ── Messages ── */}
            <div ref={msgRef} style={{ position: 'relative' }}>
              <button
                type="button"
                className="topbar-icon-btn"
                title="Messages"
                aria-label="Messages"
                onClick={() => { setMsgOpen(o => { if (!o) loadNotifications(); return !o; }); setNotifOpen(false); }}
              >
                💬
                {messages.some(m => !m.is_read) && (
                  <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, background: '#4361ee', borderRadius: '50%', border: '2px solid var(--surface)' }} />
                )}
              </button>
              {msgOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  width: 310, background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  zIndex: 999, overflow: 'hidden',
                }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)' }}>Messages</span>
                    {messages.some(m => !m.is_read) && (
                      <button onClick={() => { api.markAllRead().then(loadNotifications).catch(() => {}); }} style={{ fontSize: '0.68rem', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>Mark all read</button>
                    )}
                  </div>
                  {messages.length === 0 ? (
                    <div style={{ padding: '20px 14px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>No messages yet.</div>
                  ) : (
                    messages.map(m => (
                      <div key={m.id}
                        onClick={() => { if (!m.is_read) api.markNotifRead(m.id).then(loadNotifications).catch(() => {}); }}
                        style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'flex-start', background: m.is_read ? 'transparent' : 'rgba(67,97,238,0.04)', cursor: m.is_read ? 'default' : 'pointer' }}
                      >
                        <div style={{ width: 32, height: 32, background: 'rgba(67,97,238,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', flexShrink: 0 }}>💬</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: m.is_read ? 500 : 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{m.title}</div>
                          {m.body && <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.4 }}>{m.body}</div>}
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 3 }}>{timeAgo(m.created_at)}</div>
                        </div>
                        {!m.is_read && <div style={{ width: 7, height: 7, background: '#4361ee', borderRadius: '50%', flexShrink: 0, marginTop: 4 }} />}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* ── Notifications ── */}
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button
                type="button"
                className="topbar-icon-btn"
                title="Notifications"
                aria-label="Notifications"
                onClick={() => { setNotifOpen(o => { if (!o) loadNotifications(); return !o; }); setMsgOpen(false); }}
              >
                🔔
                {notifications.filter(n => !n.is_read).length > 0 && (
                  <span style={{
                    position: 'absolute', top: 4, right: 4,
                    minWidth: 16, height: 16, padding: '0 4px',
                    background: '#e63946', color: '#fff',
                    borderRadius: 99, fontSize: '0.6rem', fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid var(--surface)',
                  }}>
                    {notifications.filter(n => !n.is_read).length > 9 ? '9+' : notifications.filter(n => !n.is_read).length}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  width: 310, background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  zIndex: 999, overflow: 'hidden',
                }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                      Notifications {notifications.filter(n => !n.is_read).length > 0 && (
                        <span style={{ background: '#e63946', color: '#fff', borderRadius: 99, padding: '1px 6px', fontSize: '0.65rem', marginLeft: 5 }}>
                          {notifications.filter(n => !n.is_read).length}
                        </span>
                      )}
                    </span>
                    {notifications.some(n => !n.is_read) && (
                      <button onClick={() => { api.markAllRead().then(loadNotifications).catch(() => {}); }} style={{ fontSize: '0.68rem', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>Mark all read</button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '20px 14px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>No new notifications.</div>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id}
                        onClick={() => { if (!n.is_read) api.markNotifRead(n.id).then(loadNotifications).catch(() => {}); }}
                        style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'flex-start', background: n.is_read ? 'transparent' : 'rgba(230,57,70,0.04)', cursor: n.is_read ? 'default' : 'pointer' }}
                      >
                        <div style={{ width: 32, height: 32, background: 'rgba(230,57,70,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', flexShrink: 0 }}>
                          {typeIcon[n.type] || '🔔'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: n.is_read ? 500 : 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{n.title}</div>
                          {n.body && <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.4 }}>{n.body}</div>}
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 3 }}>{timeAgo(n.created_at)}</div>
                        </div>
                        {!n.is_read && <div style={{ width: 7, height: 7, background: '#e63946', borderRadius: '50%', flexShrink: 0, marginTop: 4 }} />}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* ── Theme toggle ── */}
            <button
              type="button"
              className="theme-toggle-btn"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              onClick={() => setIsDark(d => !d)}
            >
              {isDark ? '☀️' : '🌙'}
            </button>

            <div className="topbar-avatar" title={profile?.full_name || 'User'}>
              {getInitials(profile?.full_name)}
            </div>
          </div>
        </header>

        <main className="main">{children}</main>
      </div>

      <WhatsAppButton />
    </div>
  );
}
