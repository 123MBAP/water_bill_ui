import {
  AreaChart, Area, BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts';

/* ── Detect active theme ─────────────────────────────── */
const isDark = () =>
  document.documentElement.getAttribute('data-theme') === 'dark';

/* ── Colour palettes ─────────────────────────────────── */
const C = {
  blue:    '#4361ee',
  blueLight: '#7491f8',
  red:     '#f77f7f',
  teal:    '#0acf97',
  amber:   '#f59e0b',
  purple:  '#c471f5',
  cyan:    '#4facfe',
  grid:    () => isDark() ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
  axis:    () => isDark() ? '#656d76'                 : '#9baec8',
  bg:      () => isDark() ? '#21262d'                 : '#ffffff',
  text:    () => isDark() ? '#e6edf3'                 : '#1a2035',
  muted:   () => isDark() ? '#8b949e'                 : '#9baec8',
  border:  () => isDark() ? 'rgba(255,255,255,0.1)'   : '#e8ecf6',
};

/* ── Shared helpers ──────────────────────────────────── */
const fmtL   = (v) => v == null ? '0 L'   : `${(v / 1000).toLocaleString(undefined,{maximumFractionDigits:1})} L`;
const fmtRWF = (v) => v == null ? '0 RWF' : `${Number(v).toLocaleString()} RWF`;
const axisL  = (v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v);

/* ── Rich tooltip ────────────────────────────────────── */
function RichTooltip({ active, payload, label, unit = 'L' }) {
  if (!active || !payload?.length) return null;
  const fmt = unit === 'RWF' ? fmtRWF : fmtL;
  return (
    <div style={{
      background: C.bg(), border: `1px solid ${C.border()}`,
      borderRadius: 12, padding: '10px 14px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      fontSize: '0.76rem', minWidth: 140,
    }}>
      <div style={{ color: C.muted(), fontWeight: 700, marginBottom: 6, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ color: C.text(), fontWeight: 600 }}>{p.name}</span>
          <span style={{ marginLeft: 'auto', fontWeight: 800, color: p.color }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────── */
function Empty({ icon = '📊', msg = 'No data yet' }) {
  return (
    <div style={{
      height: 180, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      color: C.muted(), gap: 8,
    }}>
      <span style={{ fontSize: '2rem', opacity: 0.5 }}>{icon}</span>
      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{msg}</span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   1. Today vs Yesterday — dual smooth area chart
════════════════════════════════════════════════════════ */
export function UsageDualLineChart({ data, todayKey = 'today_ml', yesterdayKey = 'yesterday_ml' }) {
  if (!data?.length) return <Empty icon="💧" msg="No session data yet" />;

  const avg = data.reduce((s, d) => s + (d[todayKey] || 0), 0) / data.length;

  return (
    <ResponsiveContainer width="100%" height={210}>
      <AreaChart data={data} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="gToday" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={C.blue}  stopOpacity={0.22} />
            <stop offset="100%" stopColor={C.blue}  stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gYest" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={C.red}   stopOpacity={0.15} />
            <stop offset="100%" stopColor={C.red}   stopOpacity={0.01} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="4 4" stroke={C.grid()} vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: C.axis() }}
          tickLine={false} axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 10, fill: C.axis() }}
          tickLine={false} axisLine={false}
          width={46}
          tickFormatter={(v) => `${(v/1000).toFixed(0)}L`}
        />
        <Tooltip
          content={<RichTooltip unit="L" />}
          cursor={{ stroke: C.grid(), strokeWidth: 1 }}
        />
        <ReferenceLine
          y={avg} stroke={C.blue} strokeDasharray="6 3"
          strokeWidth={1} strokeOpacity={0.35}
          label={{ value: 'Avg', position: 'right', fontSize: 9, fill: C.blue, fontWeight: 700 }}
        />
        <Area
          type="monotone" dataKey={yesterdayKey}
          stroke={C.red} strokeWidth={1.8} strokeDasharray="6 3"
          fill="url(#gYest)" dot={false} name="Yesterday"
          activeDot={{ r: 4, fill: C.red, stroke: '#fff', strokeWidth: 2 }}
        />
        <Area
          type="monotone" dataKey={todayKey}
          stroke={C.blue} strokeWidth={2.5}
          fill="url(#gToday)" dot={false} name="Today"
          activeDot={{ r: 5, fill: C.blue, stroke: '#fff', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ════════════════════════════════════════════════════════
   2. Single usage area/line — trend
════════════════════════════════════════════════════════ */
export function UsageLineChart({ data, dataKey = 'total_ml', label = 'Usage' }) {
  if (!data?.length) return <Empty msg="No trend data" />;

  const avg = data.reduce((s, d) => s + (d[dataKey] || 0), 0) / data.length;

  return (
    <ResponsiveContainer width="100%" height={185}>
      <AreaChart data={data} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="gBlue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={C.cyan}  stopOpacity={0.3} />
            <stop offset="100%" stopColor={C.cyan}  stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="4 4" stroke={C.grid()} vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.axis() }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10, fill: C.axis() }} tickLine={false} axisLine={false} width={46} tickFormatter={(v) => `${(v/1000).toFixed(0)}L`} />
        <Tooltip content={<RichTooltip unit="L" />} cursor={{ stroke: C.grid(), strokeWidth: 1 }} />
        <ReferenceLine y={avg} stroke={C.cyan} strokeDasharray="5 3" strokeWidth={1} strokeOpacity={0.4}
          label={{ value: 'Avg', position: 'right', fontSize: 9, fill: C.cyan, fontWeight: 700 }} />
        <Area type="monotone" dataKey={dataKey} stroke={C.cyan} strokeWidth={2.5}
          fill="url(#gBlue)" dot={false} name={label}
          activeDot={{ r: 5, fill: C.cyan, stroke: '#fff', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ════════════════════════════════════════════════════════
   3. Monthly bar chart (admin)
════════════════════════════════════════════════════════ */
export function UsageBarChart({ data, dataKey = 'total_ml', label = 'Usage' }) {
  if (!data?.length) return <Empty msg="No monthly data" />;

  return (
    <ResponsiveContainer width="100%" height={185}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barSize={14} barCategoryGap="35%">
        <defs>
          <linearGradient id="gBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={C.blue}  stopOpacity={1} />
            <stop offset="100%" stopColor={C.blueLight} stopOpacity={0.7} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" stroke={C.grid()} vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.axis() }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10, fill: C.axis() }} tickLine={false} axisLine={false} width={46}
          tickFormatter={(v) => `${(v/1000).toFixed(0)}L`} />
        <Tooltip content={<RichTooltip unit="L" />} cursor={{ fill: C.grid() }} />
        <Bar dataKey={dataKey} fill="url(#gBar)" radius={[5, 5, 0, 0]} name={label}
          isAnimationActive animationDuration={600} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ════════════════════════════════════════════════════════
   4. Revenue area chart
════════════════════════════════════════════════════════ */
export function RevenueAreaChart({ data }) {
  if (!data?.length) return <Empty icon="💰" msg="No revenue data" />;
  return (
    <ResponsiveContainer width="100%" height={185}>
      <AreaChart data={data} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="gTeal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={C.teal} stopOpacity={0.28} />
            <stop offset="100%" stopColor={C.teal} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" stroke={C.grid()} vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.axis() }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10, fill: C.axis() }} tickLine={false} axisLine={false} width={52}
          tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
        <Tooltip content={<RichTooltip unit="RWF" />} cursor={{ stroke: C.grid(), strokeWidth: 1 }} />
        <Area type="monotone" dataKey="revenue" stroke={C.teal} strokeWidth={2.5}
          fill="url(#gTeal)" dot={false} name="Revenue (RWF)"
          activeDot={{ r: 5, fill: C.teal, stroke: '#fff', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ════════════════════════════════════════════════════════
   5. Revenue bar chart — monthly RWF bars (admin)
════════════════════════════════════════════════════════ */
export function RevenueBarChart({ data }) {
  if (!data?.length) return <Empty icon="💰" msg="No revenue data" />;
  return (
    <ResponsiveContainer width="100%" height={185}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barSize={14} barCategoryGap="35%">
        <defs>
          <linearGradient id="gRevBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={C.teal}  stopOpacity={1} />
            <stop offset="100%" stopColor="#0093e9"  stopOpacity={0.7} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" stroke={C.grid()} vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.axis() }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10, fill: C.axis() }} tickLine={false} axisLine={false} width={52}
          tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
        <Tooltip content={<RichTooltip unit="RWF" />} cursor={{ fill: C.grid() }} />
        <Bar dataKey="total_rwf" fill="url(#gRevBar)" radius={[5, 5, 0, 0]} name="Revenue (RWF)"
          isAnimationActive animationDuration={600} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ════════════════════════════════════════════════════════
   6. Combo — usage (L) + revenue (RWF) dual-bar (admin overview)
════════════════════════════════════════════════════════ */
export function UsageRevenueComboChart({ data }) {
  if (!data?.length) return <Empty msg="No data" />;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap="30%" barGap={3}>
        <defs>
          <linearGradient id="gUsage" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={C.blue}  />
            <stop offset="100%" stopColor={C.blueLight} stopOpacity={0.7} />
          </linearGradient>
          <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={C.teal}  />
            <stop offset="100%" stopColor="#0093e9"  stopOpacity={0.7} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" stroke={C.grid()} vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.axis() }} tickLine={false} axisLine={false} />
        <YAxis yAxisId="l" tick={{ fontSize: 10, fill: C.axis() }} tickLine={false} axisLine={false} width={46}
          tickFormatter={(v) => `${(v/1000).toFixed(0)}L`} />
        <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: C.axis() }} tickLine={false} axisLine={false} width={52}
          tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
        <Tooltip content={({ active, payload, label }) => {
          if (!active || !payload?.length) return null;
          return (
            <div style={{ background: C.bg(), border: `1px solid ${C.border()}`, borderRadius: 12, padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', fontSize: '0.76rem' }}>
              <div style={{ color: C.muted(), fontWeight: 700, marginBottom: 6, fontSize: '0.7rem', textTransform: 'uppercase' }}>{label}</div>
              {payload.map((p) => (
                <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                  <span style={{ color: C.text(), fontWeight: 600 }}>{p.name}</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 800, color: p.color }}>
                    {p.dataKey === 'total_ml' ? fmtL(p.value) : fmtRWF(p.value)}
                  </span>
                </div>
              ))}
            </div>
          );
        }} cursor={{ fill: C.grid() }} />
        <Legend iconType="circle" iconSize={8}
          formatter={(v) => <span style={{ fontSize: '0.72rem', color: C.text(), fontWeight: 600 }}>{v}</span>} />
        <Bar yAxisId="l" dataKey="total_ml"  fill="url(#gUsage)" radius={[4,4,0,0]} name="Water (L)" barSize={10} isAnimationActive />
        <Bar yAxisId="r" dataKey="total_rwf" fill="url(#gRev)"   radius={[4,4,0,0]} name="Revenue (RWF)" barSize={10} isAnimationActive />
      </BarChart>
    </ResponsiveContainer>
  );
}
