import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import WhatsAppButton from '../components/WhatsAppButton';
import { User, Mail, Phone, Lock, Eye, EyeOff, UserPlus, Droplet, CheckCircle, AlertCircle, ArrowLeft, ShieldCheck, ClipboardCheck } from 'lucide-react';

export default function Register() {
  const [form, setForm] = useState({ email: '', password: '', fullName: '', phone: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const data = await register({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        phone: form.phone,
        role: 'customer',
      });
      setSuccess(
        data.message ||
          'Registration submitted successfully! A manager will review your account. You will be notified once approved.'
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        {/* Info Column (Desktop only) */}
        <div className="auth-info-section">
          <div className="auth-info-header">
            <div className="auth-info-logo">
              <Droplet size={24} color="#ffffff" fill="#ffffff" />
            </div>
            <span className="auth-info-logo-text">Smart Water Bill</span>
          </div>

          <div className="auth-info-body">
            <h2>Join the Smart Water Network</h2>
            <p>
              Get access to clean, reliable water with our digital metering solutions. Manage your account from any device, 24/7.
            </p>

            <div className="auth-features-list">
              <div className="auth-feature-item">
                <CheckCircle className="auth-feature-icon" size={18} />
                <div className="auth-feature-text">
                  <strong>Pay For What You Consume</strong>
                  <span>Our smart meters measure usage down to the milliliter. No flat rates or hidden fees.</span>
                </div>
              </div>

              <div className="auth-feature-item">
                <CheckCircle className="auth-feature-icon" size={18} />
                <div className="auth-feature-text">
                  <strong>Instant Card Recharge</strong>
                  <span>Recharge your balance online via Mobile Money or at any local WASAC agent.</span>
                </div>
              </div>

              <div className="auth-feature-item">
                <CheckCircle className="auth-feature-icon" size={18} />
                <div className="auth-feature-text">
                  <strong>Automated Leak Prevention</strong>
                  <span>We notify you automatically if continuous flow is detected, saving you money.</span>
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
          {success ? (
            /* Success Display */
            <div className="register-success-view">
              <div className="success-pulse-icon">
                <ShieldCheck size={36} />
              </div>
              <h1 style={{ color: '#ffffff', fontSize: '1.75rem', fontWeight: 700, marginBottom: 'var(--space-md)' }}>
                Registration Submitted!
              </h1>
              <p className="section-text" style={{ fontSize: '0.95rem', lineHeight: '1.6', marginBottom: 'var(--space-xl)' }}>
                {success}
              </p>

              <div className="step-checklist">
                <div className="step-checklist-title">
                  <ClipboardCheck size={16} />
                  <span>Next Steps in the Process</span>
                </div>
                <div className="step-checklist-item">
                  <span className="step-checklist-num">1</span>
                  <span>Manager reviews your details & approves account</span>
                </div>
                <div className="step-checklist-item">
                  <span className="step-checklist-num">2</span>
                  <span>You receive an email notification upon approval</span>
                </div>
                <div className="step-checklist-item">
                  <span className="step-checklist-num">3</span>
                  <span>Login, assign card, and start fetching water</span>
                </div>
              </div>

              <Link to="/login" className="auth-submit-btn" style={{ display: 'inline-flex', textDecoration: 'none' }}>
                <LogIn size={18} />
                <span>Go to Sign In</span>
              </Link>
            </div>
          ) : (
            /* Registration Form */
            <>
              <div className="auth-form-header">
                <h1>Create Account</h1>
                <p>Register for your prepaid water utility account</p>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="alert-banner" style={{ margin: '0 0 var(--space-lg) 0' }}>
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Full Name *</label>
                  <div className="auth-input-wrapper">
                    <User className="auth-input-icon" size={18} />
                    <input
                      value={form.fullName}
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                      required
                      placeholder="e.g. Jean Keza"
                      autoComplete="name"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Email Address *</label>
                  <div className="auth-input-wrapper">
                    <Mail className="auth-input-icon" size={18} />
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      required
                      placeholder="name@example.com"
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Phone Number</label>
                  <div className="auth-input-wrapper">
                    <Phone className="auth-input-icon" size={18} />
                    <input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="+250 788 000 000"
                      autoComplete="tel"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Password *</label>
                  <div className="auth-input-wrapper">
                    <Lock className="auth-input-icon" size={18} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required
                      minLength={6}
                      placeholder="Minimum 6 characters"
                      autoComplete="new-password"
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

                <div className="step-checklist" style={{ margin: 'var(--space-xs) 0 var(--space-xs) 0' }}>
                  <div className="step-checklist-title" style={{ fontSize: '0.75rem' }}>
                    <ClipboardCheck size={14} />
                    <span>Registration & Approval Steps:</span>
                  </div>
                  <div className="step-checklist-item" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>
                    <span className="step-checklist-num" style={{ width: '15px', height: '15px', fontSize: '0.65rem' }}>1</span>
                    <span>Submit your application form</span>
                  </div>
                  <div className="step-checklist-item" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>
                    <span className="step-checklist-num" style={{ width: '15px', height: '15px', fontSize: '0.65rem' }}>2</span>
                    <span>WASAC manager reviews details</span>
                  </div>
                  <div className="step-checklist-item" style={{ fontSize: '0.75rem' }}>
                    <span className="step-checklist-num" style={{ width: '15px', height: '15px', fontSize: '0.65rem' }}>3</span>
                    <span>Approved account receives water card</span>
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
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={18} />
                      <span>Submit for Approval</span>
                    </>
                  )}
                </button>
              </form>

              {/* Login Link */}
              <div style={{ marginTop: 'var(--space-xl)', textAlign: 'center' }}>
                <p className="section-text" style={{ fontSize: '0.9rem' }}>
                  Already have an account?{' '}
                  <Link to="/login" style={{ fontWeight: 600, color: 'var(--primary-light)' }}>
                    Sign In
                  </Link>
                </p>
              </div>
            </>
          )}

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