const items = [
  {
    icon: '💳',
    title: 'Prepaid Cards',
    desc: 'Tap your WASAC card at any kiosk — no cash needed. Recharge anytime from the app.',
    color: '#4361ee',
    bg: 'rgba(67,97,238,0.06)',
    border: 'rgba(67,97,238,0.18)',
  },
  {
    icon: '🔔',
    title: 'Leak Alerts',
    desc: 'Get instant notifications when abnormal water flow is detected at your point.',
    color: '#e63946',
    bg: 'rgba(230,57,70,0.06)',
    border: 'rgba(230,57,70,0.18)',
  },
  {
    icon: '📊',
    title: 'Usage Reports',
    desc: 'Track every litre in real time. Full history available for customers and managers.',
    color: '#0acf97',
    bg: 'rgba(10,207,151,0.06)',
    border: 'rgba(10,207,151,0.18)',
  },
  {
    icon: '💧',
    title: 'Smart Dispensing',
    desc: 'Request the exact volume you need — the kiosk dispenses only what you paid for.',
    color: '#7c3aed',
    bg: 'rgba(124,58,237,0.06)',
    border: 'rgba(124,58,237,0.18)',
  },
];

const cardStyle = (color, bg, border) => ({
  background: bg,
  border: `1.5px solid ${border}`,
  borderRadius: 16,
  padding: '1.4rem 1.2rem',
  cursor: 'default',
  transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
  boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
});

export default function ServicesSection() {
  return (
    <section id="features" style={{ background: '#f2f4f8', padding: '3rem 0' }}>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">

        <div className="text-center" style={{ marginBottom: '1.8rem' }}>
          <h2 style={{ fontSize: '1.55rem', fontWeight: 900, color: '#0d1b2a', margin: 0 }}>
            Everything You Need
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: '0.35rem' }}>
            Simple, affordable, and built for communities across Rwanda.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
        }}>
          {items.map(it => (
            <div
              key={it.title}
              className="feature-card"
              style={cardStyle(it.color, it.bg, it.border)}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)';
                e.currentTarget.style.boxShadow = `0 12px 32px ${it.color}22`;
                e.currentTarget.style.borderColor = it.color;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.04)';
                e.currentTarget.style.borderColor = it.border;
              }}
              onMouseDown={e => {
                e.currentTarget.style.transform = 'translateY(-2px) scale(0.98)';
              }}
              onMouseUp={e => {
                e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)';
              }}
            >
              <div style={{
                width: 44, height: 44,
                background: `${it.color}18`,
                borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.4rem',
              }}>
                {it.icon}
              </div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0d1b2a', margin: 0 }}>
                {it.title}
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: 0, lineHeight: 1.55 }}>
                {it.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
