import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import WhatsAppButton from '../components/WhatsAppButton';
import { Mail, Lock, Eye, EyeOff, LogIn, Droplet, ShieldAlert, ArrowLeft, Lightbulb, CheckCircle } from 'lucide-react';

const friendlyErrors = {
  ACCOUNT_PENDING_APPROVAL:
    'Your account is waiting for manager approval. Please check back later or contact support.',
  ACCOUNT_REJECTED:
    'Your registration was not approved. Contact Smart Water Bill support for assistance.',
  INVALID_CREDENTIALS: 'Incorrect email or password. Please try again.',
  AUTH_SERVICE_UNAVAILABLE:
    'Server cannot reach the database. Ask your administrator to check Supabase settings and restart the API.',
  PROFILE_NOT_FOUND:
    'Your login worked but the profile is missing. Run: npm run create-admin (in backend folder).',
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const notice = location.state?.message;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await login(email, password);
      const role = data.profile?.role;
      if (role === 'admin') navigate('/admin');
      else if (role === 'wasac_manager') navigate('/manager');
      else navigate('/dashboard');
    } catch (err) {
      setError(friendlyErrors[err.code] || friendlyErrors[err.message] || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (roleEmail, rolePassword) => {
    setEmail(roleEmail);
    setPassword(rolePassword);
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        {/* Info Column (Desktop only, styled in index.css) */}
        <div className="auth-info-section">
          <div className="auth-info-header">
            <div className="auth-info-logo">
              <Droplet size={24} color="#ffffff" fill="#ffffff" />
            </div>
            <span className="auth-info-logo-text">Smart Water Bill</span>
          </div>

          <div className="auth-info-body">
            <h2>Manage Your Water Consumption Smartly</h2>
            <p>
              An intelligent prepaid metering and leak detection system designed to give you complete transparency and control over your water resources.
            </p>

            <div className="auth-features-list">
              <div className="auth-feature-item">
                <CheckCircle className="auth-feature-icon" size={18} />
                <div className="auth-feature-text">
                  <strong>Real-time Tracking</strong>
                  <span>Monitor hourly usage and avoid unexpected water bill surprises.</span>
                </div>
              </div>

              <div className="auth-feature-item">
                <CheckCircle className="auth-feature-icon" size={18} />
                <div className="auth-feature-text">
                  <strong>Prepaid Card System</strong>
                  <span>Recharge your water meter card instantly online and pay only for what you consume.</span>
                </div>
              </div>

              <div className="auth-feature-item">
                <CheckCircle className="auth-feature-icon" size={18} />
                <div className="auth-feature-text">
                  <strong>AI Leak Detection</strong>
                  <span>Get real-time notification alerts if abnormal flow rates are detected at your meter.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="auth-info-footer">
            &copy; 2026 WASAC Utility Management Portal. All rights reserved.
          </div>
        </div>

        {/* Form Column */}
        <div className="auth-form-section">
          <div className="auth-form-header">
            <h1>Welcome Back</h1>
            <p>Sign in to access your prepaid water dashboard</p>
          </div>

          {/* Success Notice */}
          {notice && (
            <div className="success-banner" style={{ margin: '0 0 var(--space-lg) 0' }}>
              <CheckCircle size={18} />
              <span>{notice}</span>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="alert-banner" style={{ margin: '0 0 var(--space-lg) 0' }}>
              <ShieldAlert size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Email Address</label>
              <div className="auth-input-wrapper">
                <Mail className="auth-input-icon" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@wasac.rw"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Password</label>
              <div className="auth-input-wrapper">
                <Lock className="auth-input-icon" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner" style={{ marginRight: '8px' }}>⏳</span>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Link to Registration */}
          <div style={{ marginTop: 'var(--space-xl)', textAlign: 'center' }}>
            <p className="section-text" style={{ fontSize: '0.9rem' }}>
              New to Smart Water Bill?{' '}
              <Link to="/register" style={{ fontWeight: 600, color: 'var(--primary-light)' }}>
                Create an account
              </Link>
            </p>
          </div>

          {/* Back to Home */}
          <div style={{ marginTop: 'var(--space-md)', textAlign: 'center' }}>
            <Link to="/" className="auth-back-link">
              <ArrowLeft size={16} />
              <span>Back to Home</span>
            </Link>
          </div>
        </div>
      </div>

      <WhatsAppButton />
    </div>
  );
}