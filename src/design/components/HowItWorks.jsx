import { useRevealAll } from '../hooks/useInView';

const steps = [
  { num: '01', icon: '📝', title: 'Register',      desc: 'Create your WASAC account online in 2 minutes.' },
  { num: '02', icon: '💳', title: 'Get Your Card', desc: 'Receive a prepaid WASAC card from your local agent.' },
  { num: '03', icon: '💧', title: 'Fetch Water',    desc: 'Tap the card at any kiosk and collect clean water.' },
];

export default function HowItWorks() {
  const sectionRef = useRevealAll(0.12);

  return (
    <section id="how-it-works" style={{ background: '#eaecf2' }} ref={sectionRef}>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">

        <div className="text-center reveal" style={{ marginBottom: '1.25rem' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#dde8ff', color: '#4361ee',
            borderRadius: 999, padding: '3px 12px',
            fontSize: '0.67rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
            marginBottom: '0.5rem',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4361ee' }} />
            How It Works
          </span>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0d1b2a', margin: 0 }}>
            Water in 3 Easy Steps
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 30, left: '16.5%', width: '67%', borderTop: '2px dashed #c7d2fe', zIndex: 0 }} />

          {steps.map((s, i) => (
            <div key={s.num} className={`reveal stagger-${i + 1}`} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              textAlign: 'center', position: 'relative', zIndex: 1,
            }}>
              <div style={{
                width: 60, height: 60, borderRadius: 16,
                background: '#fff', border: '1.5px solid #dde3ee',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.5rem', position: 'relative',
                boxShadow: '0 3px 10px rgba(67,97,238,0.1)',
              }}>
                {s.icon}
                <span style={{
                  position: 'absolute', top: -7, right: -7,
                  width: 20, height: 20, borderRadius: '50%',
                  background: '#4361ee', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.58rem', fontWeight: 900,
                }}>
                  {s.num}
                </span>
              </div>
              <h3 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0d1b2a', margin: '0.6rem 0 0.25rem' }}>{s.title}</h3>
              <p style={{ fontSize: '0.76rem', color: '#6b7280', margin: 0, lineHeight: 1.5 }}>{s.desc}</p>
            </div>
          ))}
        </div>

        <div className="reveal stagger-4 text-center" style={{ marginTop: '1.25rem' }}>
          <a href="/register" style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: '#4361ee', color: '#fff',
            padding: '10px 26px', borderRadius: 50,
            fontWeight: 700, fontSize: '0.85rem',
            textDecoration: 'none',
            boxShadow: '0 4px 12px rgba(67,97,238,0.28)',
          }}>
            Register Now →
          </a>
        </div>
      </div>
    </section>
  );
}
