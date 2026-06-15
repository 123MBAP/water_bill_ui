export default function KpiCard({ label, value, variant = '', suffix = '', icon = '', colorVariant = '', trend = null, trendLabel = '' }) {
  const classNames = ['kpi-card', variant, colorVariant].filter(Boolean).join(' ');
  const isColored  = colorVariant && colorVariant !== '';

  const trendColor = trend === 'up'
    ? (isColored ? 'rgba(255,255,255,0.82)' : '#10b981')
    : trend === 'down'
      ? (isColored ? 'rgba(255,255,255,0.82)' : '#f04438')
      : (isColored ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)');

  return (
    <div className={classNames}>
      <div className="label">{label}</div>
      <div className="value">
        {value}
        {suffix && (
          <span style={{ fontSize: '0.75rem', fontWeight: 500, opacity: 0.75, marginLeft: 4 }}>
            {suffix}
          </span>
        )}
      </div>
      {trend && (
        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: trendColor, marginTop: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendLabel}
        </div>
      )}
      {icon && <div className="kpi-icon">{icon}</div>}
    </div>
  );
}
