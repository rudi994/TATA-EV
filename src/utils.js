// India has no daylight saving, so a fixed +5:30 offset is exact.
export const IST_OFFSET = 330 * 60 * 1000
const HOUR = 3600 * 1000
const DAY = 24 * HOUR

export const PHASE_COLORS = { 'Before start': '#e07b10', 'After start': '#2563eb' }
export const ACCENT = '#0f766e'

const dtFmt = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
})
const timeFmt = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
})
const dayFmt = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' })

export const fmtDateTime = (ms) => dtFmt.format(ms)
export const fmtTime = (ms) => timeFmt.format(ms)
export const fmtDay = (ms) => dayFmt.format(ms)

// 'YYYY-MM-DD' typed in a date input, read as an IST calendar day
export function istDayStart(yyyyMmDd) {
  const [y, m, d] = yyyyMmDd.split('-').map(Number)
  return Date.UTC(y, m - 1, d) - IST_OFFSET
}
export const istDayEnd = (s) => istDayStart(s) + DAY - 1
export function toIstDateInput(ms) {
  const d = new Date(ms + IST_OFFSET)
  return d.toISOString().slice(0, 10)
}
export const istHour = (ms) => new Date(ms + IST_OFFSET).getUTCHours()

export function normalize(r) {
  return {
    ...r,
    ts: new Date(r.session_ts).getTime(),
    state: r.state || 'Unmapped city',
    stop_reason: r.stop_reason || null,
    error_code: r.error_code || null,
  }
}

export function countBy(rows, key) {
  const m = new Map()
  for (const r of rows) {
    const k = typeof key === 'function' ? key(r) : r[key]
    m.set(k, (m.get(k) || 0) + 1)
  }
  return m
}

export const uniqSorted = (arr) => [...new Set(arr.filter((v) => v !== null && v !== undefined && v !== ''))].sort((a, b) => String(a).localeCompare(String(b), 'en', { numeric: true }))

// Continuous time buckets (hourly for short ranges, daily otherwise), stacked by phase
export function timeBuckets(rows) {
  if (!rows.length) return { data: [], unit: 'hour' }
  let min = Infinity, max = -Infinity
  for (const r of rows) { if (r.ts < min) min = r.ts; if (r.ts > max) max = r.ts }
  const unit = max - min <= 3 * DAY ? 'hour' : 'day'
  const size = unit === 'hour' ? HOUR : DAY
  const floor = (ms) => Math.floor((ms + IST_OFFSET) / size) * size - IST_OFFSET
  const start = floor(min), end = floor(max)
  const map = new Map()
  for (let t = start; t <= end; t += size) map.set(t, { t, 'Before start': 0, 'After start': 0 })
  for (const r of rows) {
    const b = map.get(floor(r.ts))
    if (b) b[r.start_phase] = (b[r.start_phase] || 0) + 1
  }
  const data = [...map.values()].map((b) => ({
    ...b,
    label: unit === 'hour' ? `${fmtDay(b.t)} ${String(istHour(b.t)).padStart(2, '0')}:00` : fmtDay(b.t),
    total: b['Before start'] + b['After start'],
  }))
  return { data, unit }
}

export function toCsv(rows) {
  const cols = [
    ['Reported (IST)', (r) => fmtDateTime(r.ts)], ['EVSE ID', 'evse_id'], ['Connector', (r) => (r.connector ? `Connector #${r.connector}` : '')],
    ['Site', 'site'], ['City', 'city'], ['State', 'state'], ['CDM Session ID', 'cdm_session_id'], ['Start phase', 'start_phase'],
    ['Stop reason', 'stop_reason'], ['Error code', 'error_code'], ['Charger model', 'charger_model'], ['Sample row', (r) => (r.is_sample ? 'yes' : 'no')],
  ]
  const esc = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`
  const lines = [cols.map((c) => esc(c[0])).join(',')]
  for (const r of rows) lines.push(cols.map(([, k]) => esc(typeof k === 'function' ? k(r) : r[k])).join(','))
  return lines.join('\n')
}

export function download(name, text, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type }))
  const a = document.createElement('a')
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
