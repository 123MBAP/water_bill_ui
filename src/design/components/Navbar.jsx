import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV_LINKS = [
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#features', label: 'Features' },
  { href: '#stats', label: 'Impact' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { isAuthenticated, profile, logout } = useAuth();

  const dashboardLink = profile?.role === 'admin'
    ? '/admin'
    : profile?.role === 'wasac_manager'
    ? '/manager'
    : '/dashboard';

  useEffect(() => {
    document.body.classList.toggle('landing-menu-open', open);
    return () => document.body.classList.remove('landing-menu-open');
  }, [open]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const close = () => setOpen(false);

  const handleLogout = () => {
    logout();
    close();
  };

  return (
    <>
      <header className="landing-nav">
        <div className="landing-nav-inner">
          {/* Logo */}
          <Link to="/" className="landing-logo" onClick={close}>
            <span className="landing-logo-icon" aria-hidden="true">
              💧
            </span>
            <span className="landing-logo-text">
              <strong>Smart Water Bill</strong>
              <span>Prepaid Billing System</span>
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="landing-nav-links" aria-label="Main Navigation">
            {NAV_LINKS.map((item) => (
              <a key={item.href} href={item.href} onClick={close}>
                {item.label}
              </a>
            ))}
          </nav>

          {/* Desktop Actions */}
          <div className="landing-nav-actions">
            {isAuthenticated ? (
              <>
                <Link to={dashboardLink} className="landing-nav-register">
                  📊 Dashboard
                </Link>
                <button 
                  onClick={handleLogout} 
                  className="landing-nav-signin"
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  🚪 Sign Out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="landing-nav-signin">
                  🔓 Sign In
                </Link>
                <Link to="/register" className="landing-nav-register">
                  📝 Register
                </Link>
              </>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            className={`landing-hamburger-btn ${open ? 'is-open' : ''}`}
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>

      {/* Backdrop */}
      <div
        className={`landing-drawer-backdrop ${open ? 'is-open' : ''}`}
        onClick={close}
        aria-hidden={!open}
      />

      {/* Mobile Drawer */}
      <aside className={`landing-drawer ${open ? 'is-open' : ''}`} aria-hidden={!open}>
        <div className="landing-drawer-head">
          <span className="landing-drawer-title">
            <span style={{ marginRight: 'var(--space-sm)' }}>💧</span>
            Menu
          </span>
          <button type="button" className="landing-drawer-close" onClick={close} aria-label="Close">
            ×
          </button>
        </div>
        
        <nav>
          {NAV_LINKS.map((item) => (
            <a key={item.href} href={item.href} onClick={close}>
              {item.label === 'How It Works' && '📖'}
              {item.label === 'Features' && '⚡'}
              {item.label === 'Impact' && '🌍'}
              {' '}
              {item.label}
            </a>
          ))}
        </nav>
        
        <div className="landing-drawer-footer">
          {isAuthenticated ? (
            <>
              <Link to={dashboardLink} className="landing-nav-register" onClick={close}>
                📊 Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="landing-nav-signin"
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer', 
                  display: 'block', 
                  width: '100%', 
                  textAlign: 'center',
                  marginTop: 'var(--space-sm)'
                }}
              >
                🚪 Sign Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="landing-nav-signin" onClick={close}>
                🔓 Sign In
              </Link>
              <Link to="/register" className="landing-nav-register" onClick={close}>
                📝 Register
              </Link>
            </>
          )}
        </div>

        {/* User Info when authenticated */}
        {isAuthenticated && profile && (
          <div style={{ 
            marginTop: 'var(--space-lg)', 
            paddingTop: 'var(--space-md)', 
            borderTop: '1px solid var(--landing-border)',
            fontSize: '0.75rem',
            textAlign: 'center'
          }}>
            <div className="profile-meta" style={{ fontSize: '0.7rem' }}>
              Signed in as
            </div>
            <div style={{ fontWeight: 600, marginTop: 'var(--space-xs)' }}>
              {profile?.full_name || profile?.email?.split('@')[0]}
            </div>
            <div className="badge badge-info" style={{ marginTop: 'var(--space-xs)', fontSize: '0.65rem' }}>
              {profile?.role === 'admin' ? 'Administrator' : 
               profile?.role === 'wasac_manager' ? 'Manager' : 
               'Customer'}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}