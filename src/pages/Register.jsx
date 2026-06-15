import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import WhatsAppButton from '../components/WhatsAppButton';
import { Eye, EyeOff, UserPlus, ArrowLeft } from 'lucide-react';

const SLIDES = [
  { url: '/slides/slide3.png', caption: 'WASAC — Serving Rwanda communities' },
  { url: '/slides/slide1.png', caption: 'Community water points across Rwanda' },
  { url: '/slides/slide2.png', caption: 'Modern kiosks — tap your card to fetch water' },
];

export default function Register() {
  const [form,         setForm]         = useState({ email: '', password: '', fullName: '', phone: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState('');
  const [loading,      setLoading]      = useState(false);
  const [slideIdx,     setSlideIdx]     = useState(0);
  const [slideVisible, setSlideVisible] = useState(true);
  const { register } = useAuth();

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
    setLoading(true); setError(''); setSuccess('');
    try {
      const data = await register({ email: form.email, password: form.password, fullName: form.fullName, phone: form.phone, role: 'customer' });
      setSuccess(data.message || 'Registration submitted! A manager will review your account soon.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">

        {/* ── Left: photo ── */}
        <div className="auth-info-section">
          <img
            key={slideIdx}
            src={SLIDES[slideIdx].url}
            alt="Rwanda water"
            className="auth-photo-bg"
            style={{ opacity: slideVisible ? 1 : 0 }}
          />
          <div className="auth-photo-overlay" />

          <div className="auth-info-header">
            <div className="auth-info-logo">💧</div>
            <span className="auth-info-logo-text">Smart Water Bill</span>
          </div>

          <div className="auth-info-content">
            <div className="auth-slide-dots">
              {SLIDES.map((_, i) => (
                <button key={i} type="button" className={`auth-slide-dot ${i === slideIdx ? 'active' : ''}`} onClick={() => goSlide(i)} aria-label={`Slide ${i + 1}`} />
              ))}
            </div>

            <div className="auth-info-body">
              <h2>Join the WASAC<br />Water Network</h2>
              <p style={{ opacity: slideVisible ? 1 : 0, transition: 'opacity 0.5s' }}>
                {SLIDES[slideIdx].caption}
              </p>
              <div className="auth-badge-row">
                <span>💳 Prepaid</span>
                <span>📱 Online</span>
                <span>🛡️ Transparent</span>
              </div>
            </div>

            <div className="auth-info-footer">
              &copy; 2026 WASAC Smart Water Billing Portal — Rwanda
            </div>
          </div>
        </div>

        {/* ── Right: form ── */}
        <div className="auth-form-section">
          {success ? (
            <div className="register-success-view">
              <div className="success-pulse-icon" style={{ fontSize: '2rem' }}>✅</div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0d1b2a', marginBottom: 8 }}>
                Registration Submitted!
              </h1>
              <p style={{ color: '#6b7280', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                {success}
              </p>
              <div className="step-checklist">
                <div className="step-checklist-title">📋 Next Steps</div>
                {[
                  'Manager reviews your details & approves account',
                  'You receive a notification upon approval',
                  'Login, get your card, and start fetching water',
                ].map((s, i) => (
                  <div key={i} className="step-checklist-item">
                    <span className="step-checklist-num">{i + 1}</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
              <Link to="/login" className="auth-submit-btn" style={{ textDecoration: 'none' }}>
                Go to Sign In →
              </Link>
            </div>
          ) : (
            <>
              <div className="auth-form-header" style={{ marginBottom: '1rem' }}>
                <h1 style={{ fontSize: '1.4rem' }}>Create Account 🌊</h1>
                <p>Register for your WASAC water account</p>
              </div>

              {error && (
                <div className="alert-banner" style={{ marginBottom: '1.25rem' }}>
                  ⚠️ {error}
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {[
                  { key: 'fullName', label: 'Full Name',     icon: '👤', type: 'text',  placeholder: 'e.g. Jean Keza',   required: true },
                  { key: 'email',    label: 'Email',          icon: '✉️', type: 'email', placeholder: 'name@example.com', required: true },
                  { key: 'phone',    label: 'Phone',          icon: '📱', type: 'tel',   placeholder: '+250 788 000 000', required: false },
                ].map(f => (
                  <div key={f.key} className="form-group auth-compact-group">
                    <label>{f.label}</label>
                    <div className="auth-input-wrapper">
                      <span className="auth-input-icon" style={{ fontSize: '1rem' }}>{f.icon}</span>
                      <input
                        type={f.type}
                        value={form[f.key]}
                        onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                        required={f.required}
                        placeholder={f.placeholder}
                      />
                    </div>
                  </div>
                ))}

                <div className="form-group auth-compact-group">
                  <label>Password</label>
                  <div className="auth-input-wrapper">
                    <span className="auth-input-icon" style={{ fontSize: '1rem' }}>🔒</span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                      required
                      minLength={6}
                      placeholder="Min. 6 characters"
                    />
                    <button type="button" className="auth-password-toggle" onClick={() => setShowPassword(v => !v)}>
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                <button type="submit" className="auth-submit-btn" disabled={loading} style={{ marginTop: '0.35rem' }}>
                  {loading ? (
                    <><span>⏳</span><span>Submitting…</span></>
                  ) : (
                    <><UserPlus size={17} /><span>Create Account</span></>
                  )}
                </button>
              </form>

              <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.88rem', color: '#6b7280' }}>
                Already have an account?{' '}
                <Link to="/login" style={{ fontWeight: 700, color: '#4361ee', textDecoration: 'none' }}>Sign In</Link>
              </div>
            </>
          )}

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
