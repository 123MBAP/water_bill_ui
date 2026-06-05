import { useState, useEffect } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import WhatsAppButton from './WhatsAppButton';

const roleLabels = {
  admin: 'Administrator',
  customer: 'Customer',
  wasac_manager: 'Operations Manager',
};

export default function Layout({ children, navItems, variant = 'dark' }) {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check if device is mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close mobile menu when screen size changes to desktop
  useEffect(() => {
    if (!isMobile && mobileOpen) {
      setMobileOpen(false);
    }
  }, [isMobile, mobileOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
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
              <span style={{ fontSize: '0.7rem', display: 'block', color: 'var(--text-secondary)' }}>
                Billing System
              </span>
            </span>
          </Link>
          {/* Close button - only visible on mobile when sidebar is open */}
          {isMobile && mobileOpen && (
            <button
              type="button"
              className="sidebar-close-mobile"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              ×
            </button>
          )}
        </div>

        {/* Navigation Section */}
        <div className="sidebar-section">
          <div className="sidebar-title">Main Menu</div>
          <nav>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end ?? (item.to === '/' || item.to === '/admin' || item.to === '/dashboard' || item.to === '/manager')}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                onClick={() => isMobile && setMobileOpen(false)}
              >
                <span className="sidebar-link-dot" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* User Profile & Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">
              {getInitials(profile?.full_name)}
            </div>
            <div>
              <div className="sidebar-user-name">
                {profile?.full_name || profile?.email?.split('@')[0] || 'User'}
              </div>
              <div className="sidebar-user-role">
                {roleLabels[profile?.role] || profile?.role || 'Customer'}
              </div>
            </div>
          </div>
          
          {/* Account Status Badge */}
          {profile?.account_status === 'pending' && (
            <div className="badge badge-warning" style={{ marginBottom: 'var(--space-sm)', textAlign: 'center' }}>
              Pending Approval
            </div>
          )}
          
          <button type="button" className="btn-secondary sidebar-logout" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile Backdrop - only visible when sidebar is open on mobile */}
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
          {/* Menu button - only visible on mobile */}
          {isMobile && (
            <button
              type="button"
              className="topbar-menu-btn"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              ☰
            </button>
          )}
          <div className="topbar-spacer" />
          
          {/* Quick Actions */}
          <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
            <Link to="/" className="topbar-home-link">
              Public Site
            </Link>
            
            {/* Mobile User Info */}
            <div className="profile-meta" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                {roleLabels[profile?.role] || 'Customer'}
              </span>
            </div>
          </div>
        </header>
        
        <main className="main">{children}</main>
      </div>

      <WhatsAppButton />
    </div>
  );
}