import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import WhatsAppButton from '../components/WhatsAppButton';
import { Eye, EyeOff, LogIn, ArrowLeft } from 'lucide-react';

/* Rwanda / village water scenes from Unsplash */
const SLIDES = [
  { url: '/slides/slide1.png', caption: 'Clean water for every village in Rwanda' },
  { url: '/slides/slide2.png', caption: 'Smart kiosks — pay only for what you use' },
  { url: '/slides/slide3.png', caption: 'WASAC serves communities across Rwanda' },
];

const friendlyErrors = {
  ACCOUNT_PENDING_APPROVAL:
    'Your account is waiting for manager approval. Please check back later.',
  ACCOUNT_REJECTED:
    'Your registration was not approved. Contact WASAC support.',
  INVALID_CREDENTIALS: 'Incorrect email or password. Please try again.',
  AUTH_SERVICE_UNAVAILABLE:
    'Server cannot reach the database. Contact your administrator.',
  PROFILE_NOT_FOUND:
    'Login worked but profile is missing. Ask admin to run: npm run create-admin.',
};

export default function Login() {
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [slideIdx,     setSlideIdx]     = useState(0);
  const [slideVisible, setSlideVisible] = useState(true);

  const { login }  = useAuth();
  const navigate   = useNavigate();
  const location   = useLocation();
  const notice     = location.state?.message;

  /* Auto-advance photo slideshow */
  useEffect(() => {
    const id = setInterval(() => {
      setSlideVisible(false);
      setTimeout(() => {
        setSlideIdx(i => (i + 1) % SLIDES.length);
        setSlideVisible(true);
      }, 500);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const goSlide = (i) => {
    setSlideVisible(false);
    setTimeout(() => { setSlideIdx(i); setSlideVisible(true); }, 300);
  };

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

  return (
    <div className="auth-page">
      <div className="auth-container">

        {/* ── Left: photo + overlay ── */}
        <div className="auth-info-section">
          {/* Sliding background photo */}
          <img
            key={slideIdx}
            src={SLIDES[slideIdx].url}
            alt="Rwanda water scene"
            className="auth-photo-bg"
            style={{ opacity: slideVisible ? 1 : 0 }}
          />
          <div className="auth-photo-overlay" />

          {/* Brand top-left */}
          <div className="auth-info-header">
            <div className="auth-info-logo">💧</div>
            <span className="auth-info-logo-text">Smart Water Bill</span>
          </div>

          {/* Bottom content */}
          <div className="auth-info-content">
            {/* Slide dots */}
            <div className="auth-slide-dots">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`auth-slide-dot ${i === slideIdx ? 'active' : ''}`}
                  onClick={() => goSlide(i)}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>

            <div className="auth-info-body">
              <h2>Smart Water<br />for Rwanda</h2>
              <p style={{ opacity: slideVisible ? 1 : 0, transition: 'opacity 0.5s' }}>
                {SLIDES[slideIdx].caption}
              </p>
              <div className="auth-badge-row">
                <span>💧 Prepaid</span>
                <span>📊 Real-time</span>
                <span>🔔 Alerts</span>
              </div>
            </div>

            <div className="auth-info-footer">
              &copy; 2026 WASAC Smart Water Billing Portal — Rwanda
            </div>
          </div>
        </div>

        {/* ── Right: form ── */}
        <div className="auth-form-section">
          <div className="auth-form-header">
            <h1>Welcome back 👋</h1>
            <p>Sign in to your WASAC water account</p>
          </div>

          {notice && (
            <div className="success-banner" style={{ marginBottom: '1.25rem' }}>
              ✅ {notice}
            </div>
          )}

          {error && (
            <div className="alert-banner" style={{ marginBottom: '1.25rem' }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Email Address</label>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon" style={{ fontSize: '1rem' }}>✉️</span>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="name@wasac.rw"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Password</label>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon" style={{ fontSize: '1rem' }}>🔒</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword(v => !v)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? (
                <><span>⏳</span><span>Signing in…</span></>
              ) : (
                <><LogIn size={17} /><span>Sign In</span></>
              )}
            </button>
          </form>

          <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.88rem', color: '#6b7280' }}>
            New to Smart Water Bill?{' '}
            <Link to="/register" style={{ fontWeight: 700, color: '#4361ee', textDecoration: 'none' }}>
              Create an account
            </Link>
          </div>

          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <Link to="/" className="auth-back-link">
              <ArrowLeft size={15} />
              <span>Back to Home</span>
            </Link>
          </div>
        </div>
      </div>

      <WhatsAppButton />
    </div>
  );
}
