export default function ServicesSection() {
  const items = [
    { icon: '💳', title: 'Prepaid Cards',  desc: 'Tap your WASAC card at any kiosk. No cash needed.' },
    { icon: '🔔', title: 'Leak Alerts',    desc: 'Automatic notifications when abnormal flow is detected.' },
    { icon: '📊', title: 'Usage Reports',  desc: 'Real-time dashboard for managers and customers.' },
  ];

  return (
    <section id="features" style={{ background: '#f2f4f8' }}>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="text-center reveal" style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0d1b2a', margin: 0 }}>
            Why WASAC Smart Water Bill
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.82rem', marginTop: '0.3rem' }}>
            Simple. Affordable. Built for Rwanda.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.9rem' }}>
          {items.map(it => (
            <div key={it.title} className="reveal" style={{
              background: '#fff',
              border: '1px solid #dde3ee',
              borderRadius: 14,
              padding: '1.1rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}>
              <div style={{ fontSize: '1.6rem', marginBottom: '0.4rem' }}>{it.icon}</div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0d1b2a', margin: '0 0 0.3rem' }}>{it.title}</h3>
              <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: 0, lineHeight: 1.5 }}>{it.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
