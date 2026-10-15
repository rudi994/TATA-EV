import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { PHASE_COLORS, ACCENT } from './utils.js'

const AXIS = { fontSize: 11, fill: '#64748b' }
const GRID = '#e8edf2'

function TipBox({ active, payload, label, unit = 'sessions' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="tip">
      {label !== undefined && <div className="tip-title">{label}</div>}
      {payload.map((p) => (
        <div key={p.dataKey ?? p.name} className="tip-row">
          <span className="tip-swatch" style={{ background: p.color || p.payload?.fill || ACCENT }} />
          <span>{p.name}</span>
          <strong>{p.value}</strong>
        </div>
      ))}
      {payload.length > 1 && (
        <div className="tip-row tip-total"><span /> <span>Total</span><strong>{payload.reduce((s, p) => s + (p.value || 0), 0)}</strong></div>
      )}
      {payload.length === 1 && <div className="tip-unit">{unit}</div>}
    </div>
  )
}

export function Empty() {
  return <div className="empty">No sessions match these filters.</div>
}

export function TimelineChart({ data, unit, onPick }) {
  if (!data.length) return <Empty />
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap={data.length > 30 ? 1 : '20%'}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={28} />
        <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
        <Tooltip content={<TipBox />} cursor={{ fill: 'rgba(15,118,110,.06)' }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#334155' }} />
        <Bar dataKey="Before start" stackId="a" fill={PHASE_COLORS['Before start']} stroke="#fff" strokeWidth={1} onClick={(d) => onPick?.(d)} cursor="pointer" />
        <Bar dataKey="After start" stackId="a" fill={PHASE_COLORS['After start']} stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} onClick={(d) => onPick?.(d)} cursor="pointer" />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function PhaseDonut({ before, after }) {
  const total = before + after
  if (!total) return <Empty />
  const data = [
    { name: 'Before start', value: before },
    { name: 'After start', value: after },
  ]
  return (
    <div className="donut">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={2} stroke="#fff" strokeWidth={2} startAngle={90} endAngle={-270}>
            {data.map((d) => <Cell key={d.name} fill={PHASE_COLORS[d.name]} />)}
          </Pie>
          <Tooltip content={<TipBox />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="donut-center"><strong>{total}</strong><span>sessions</span></div>
      <ul className="donut-legend">
        {data.map((d) => (
          <li key={d.name}>
            <span className="tip-swatch" style={{ background: PHASE_COLORS[d.name] }} />
            <span>{d.name}</span>
            <strong>{d.value}</strong>
            <span className="muted">{Math.round((d.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Horizontal ranked bars. Click a bar to filter by it. */
export function RankBars({ data, onPick, color = ACCENT, height, valueLabel = 'sessions', labelWidth = 110 }) {
  if (!data.length) return <Empty />
  const h = height || Math.max(120, data.length * 30 + 20)
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 28, left: 0, bottom: 0 }} barCategoryGap={6}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={labelWidth} tick={{ ...AXIS, fill: '#334155' }} tickLine={false} axisLine={false} />
        <Tooltip content={<TipBox unit={valueLabel} />} cursor={{ fill: 'rgba(15,118,110,.06)' }} />
        <Bar dataKey="value" name={valueLabel} fill={color} radius={[0, 4, 4, 0]} maxBarSize={18}
          label={{ position: 'right', fontSize: 11, fill: '#334155' }} onClick={(d) => onPick?.(d.name)} cursor={onPick ? 'pointer' : 'default'} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function HourChart({ data }) {
  if (!data.some((d) => d.value)) return <Empty />
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -24, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval={2} />
        <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
        <Tooltip content={<TipBox />} cursor={{ fill: 'rgba(15,118,110,.06)' }} />
        <Bar dataKey="value" name="Failed sessions" fill={ACCENT} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
