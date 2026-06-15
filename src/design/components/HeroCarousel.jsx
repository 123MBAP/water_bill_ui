import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const slides = [
  {
    photo:     '/slides/slide1.png',
    badge:     'WASAC — Rwanda',
    title:     'Water for Every Home',
    highlight: 'in Rwanda',
    sub:       'Smart prepaid metering for villages and cities.',
    cta:       'Get Started',
  },
  {
    photo:     '/slides/slide2.png',
    badge:     'Smart Water Kiosk',
    title:     'Tap Your Card,',
    highlight: 'Get Clean Water',
    sub:       'Available at every local water point across Rwanda.',
    cta:       'Register Now',
  },
  {
    photo:     '/slides/slide3.png',
    badge:     'WASAC Field Team',
    title:     'Managed by',
    highlight: 'Professionals',
    sub:       'Our certified agents support you at every step.',
    cta:       'Learn More',
  },
];

export default function HeroCarousel() {
  const [active,  setActive]  = useState(0);
  const [visible, setVisible] = useState(true);

  const goTo = (i) => {
    if (i === active) return;
    setVisible(false);
    setTimeout(() => { setActive(i); setVisible(true); }, 320);
  };

  const goPrev = () => goTo((active - 1 + slides.length) % slides.length);
  const goNext = () => goTo((active + 1) % slides.length);

  useEffect(() => {
    const id = setInterval(goNext, 5500);
    return () => clearInterval(id);
  }, [active]); // eslint-disable-line

  const s = slides[active];

  return (
    <section style={{ position: 'relative', overflow: 'hidden', height: '82vh', minHeight: 480, maxHeight: 700 }}>

      {/* ── Full-bleed photo ── */}
      <img
        key={active}
        src={s.photo}
        alt={s.badge}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: 'center',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.5s ease',
        }}
      />

      {/* Dark gradient overlay — bottom-heavy so text pops */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(5,12,40,0.28) 0%, rgba(5,12,40,0.62) 55%, rgba(5,12,40,0.88) 100%)',
      }} />

      {/* ── Centred text ── */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-end',
        paddingBottom: '5.5rem', paddingLeft: '1rem', paddingRight: '1rem',
        textAlign: 'center',
        opacity:  visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transition: 'opacity 0.4s ease, transform 0.4s ease',
      }}>
        {/* Badge */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.3)',
          color: '#fff', borderRadius: 999,
          padding: '4px 14px',
          fontSize: '0.7rem', fontWeight: 800,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          marginBottom: '0.85rem',
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#60a5fa' }} />
          {s.badge}
        </span>

        {/* Headline */}
        <h1 style={{
          fontSize: 'clamp(2rem, 5.5vw, 3.8rem)',
          fontWeight: 900, lineHeight: 1.1,
          color: '#ffffff', margin: '0 0 0.5rem',
          letterSpacing: '-0.025em',
          textShadow: '0 2px 16px rgba(0,0,0,0.4)',
          maxWidth: 700,
        }}>
          {s.title}{' '}
          <span style={{ color: '#93c5fd' }}>{s.highlight}</span>
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: 'clamp(0.9rem, 1.8vw, 1.05rem)',
          color: 'rgba(255,255,255,0.82)',
          margin: '0 0 1.75rem',
          maxWidth: 440,
          lineHeight: 1.6,
          textShadow: '0 1px 6px rgba(0,0,0,0.3)',
        }}>
          {s.sub}
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/register" style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: '#4361ee', color: '#fff',
            padding: '11px 26px', borderRadius: 50,
            fontWeight: 700, fontSize: '0.88rem',
            textDecoration: 'none',
            boxShadow: '0 4px 18px rgba(67,97,238,0.5)',
            transition: 'transform 0.2s',
          }}>
            {s.cta}
            <svg viewBox="0 0 24 24" style={{ width: 15, height: 15 }} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
          <Link to="/login" style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(6px)',
            color: '#fff',
            border: '1.5px solid rgba(255,255,255,0.4)',
            padding: '11px 26px', borderRadius: 50,
            fontWeight: 600, fontSize: '0.88rem',
            textDecoration: 'none',
          }}>
            Sign In
          </Link>
        </div>
      </div>

      {/* ── Dot indicators ── */}
      <div style={{
        position: 'absolute', bottom: '2.2rem', left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 8, zIndex: 4,
      }}>
        {slides.map((_, i) => (
          <button key={i} type="button" onClick={() => goTo(i)} aria-label={`Slide ${i + 1}`}
            style={{
              width: i === active ? 26 : 8, height: 8, borderRadius: 4,
              background: i === active ? '#fff' : 'rgba(255,255,255,0.4)',
              border: 'none', cursor: 'pointer', padding: 0,
              transition: 'all 0.3s',
            }}
          />
        ))}
      </div>

      {/* ── Arrow buttons ── */}
      {[
        { style: { left: 16 },  label: 'Prev', fn: goPrev, d: 'M15 18 9 12l6-6' },
        { style: { right: 16 }, label: 'Next', fn: goNext, d: 'm9 18 6-6-6-6' },
      ].map(({ style: s2, label, fn, d }) => (
        <button key={label} type="button" onClick={fn} aria-label={label}
          style={{
            position: 'absolute', top: '50%', transform: 'translateY(-50%)',
            ...s2, width: 42, height: 42, borderRadius: '50%',
            background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(6px)',
            border: '1px solid rgba(255,255,255,0.3)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 4, transition: 'background 0.2s',
          }}>
          <svg viewBox="0 0 24 24" style={{ width: 18, height: 18 }} fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d={d} />
          </svg>
        </button>
      ))}

      {/* Wave at bottom */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, pointerEvents: 'none', zIndex: 3 }}>
        <svg viewBox="0 0 1440 48" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', display: 'block', height: 48 }} preserveAspectRatio="none">
          <path d="M0 32C360 0 720 48 1080 24C1260 12 1380 36 1440 32L1440 48L0 48Z" fill="#f2f4f8" />
        </svg>
      </div>
    </section>
  );
}
