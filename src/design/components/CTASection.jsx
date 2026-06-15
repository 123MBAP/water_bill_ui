import { Link } from 'react-router-dom';
import { useRevealAll } from '../hooks/useInView';

export default function CTASection() {
  const sectionRef = useRevealAll(0.15);

  return (
    <section className="landing-cta-section relative overflow-hidden" ref={sectionRef}
      style={{ background: 'linear-gradient(135deg, #4361ee 0%, #2563eb 50%, #0891b2 100%)' }}>

      <div className="pointer-events-none absolute -top-16 -left-16 h-64 w-64 rounded-full bg-white opacity-5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-cyan-300 opacity-10 blur-3xl" />

      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">

        <div className="reveal" style={{ marginBottom: '0.5rem' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.3)',
            color: '#fff', borderRadius: 999, padding: '4px 14px',
            fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            💧 WASAC Rwanda
          </span>
        </div>

        <h2 className="reveal stagger-1" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.4rem)', fontWeight: 900, color: '#fff', margin: '0.6rem 0' }}>
          Start Using Smart Water Today
        </h2>

        <p className="reveal stagger-2" style={{ color: 'rgba(255,255,255,0.82)', fontSize: '0.95rem', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
          Register once. Get your card. Fetch water anywhere in Rwanda.
        </p>

        <div className="reveal stagger-3" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/register" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#fff', color: '#4361ee',
            padding: '11px 28px', borderRadius: 50,
            fontWeight: 800, fontSize: '0.9rem',
            textDecoration: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          }}>
            Register as Customer
          </Link>
          <Link to="/login" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(6px)',
            border: '1.5px solid rgba(255,255,255,0.4)',
            color: '#fff',
            padding: '11px 24px', borderRadius: 50,
            fontWeight: 600, fontSize: '0.9rem',
            textDecoration: 'none',
          }}>
            Sign In
          </Link>
        </div>
      </div>
    </section>
  );
}
