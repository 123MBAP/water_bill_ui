export default function StatsSection() {
  const stats = [
    { icon: '👥', label: 'Customers Served',    value: '12,432+' },
    { icon: '💧', label: 'Water Dispensed (m³)', value: '85,230' },
    { icon: '📍', label: 'Water Points',         value: '340+' },
  ];

  return (
    <section id="stats" style={{ background: '#eaecf2' }}>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem' }}>
          {stats.map(s => (
            <div key={s.label} className="reveal" style={{
              background: '#fff',
              border: '1px solid #dde3ee',
              borderRadius: 14,
              padding: '1.1rem 1rem',
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.3rem' }}>{s.icon}</div>
              <div style={{ fontSize: '1.55rem', fontWeight: 900, color: '#0d1b2a', lineHeight: 1.1 }}>{s.value}</div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', marginTop: '0.2rem' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
