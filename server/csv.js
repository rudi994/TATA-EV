// Small CSV reader (handles quotes, commas and newlines inside quotes)
export function parseCsv(text) {
  const out = []
  let row = [], field = '', q = false
  text = text.replace(/^﻿/, '')
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else q = false }
      else field += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((v) => v !== '')) out.push(row)
      row = []
    } else field += c
  }
  if (field !== '' || row.length) { row.push(field); if (row.some((v) => v !== '')) out.push(row) }
  if (!out.length) return []
  const head = out[0].map((h) => h.trim().toLowerCase())
  return out.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])))
}

const IST_MS = 330 * 60 * 1000

/**
 * Turns one CSV row (the dashboard's export format, or the original
 * Failed Sessions extract) into a session object. Date + Time are IST.
 */
export function csvRowToSession(r) {
  const get = (...keys) => { for (const k of keys) if (r[k] !== undefined && r[k] !== '') return r[k]; return '' }
  const date = get('date'), time = get('time') || '00:00:00'
  const evse = get('evse id', 'evse_id'), sid = get('cdm session id', 'cdm_session_id')
  const phase = get('start phase', 'start_phase')
  const errors = []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push('Date must be YYYY-MM-DD')
  if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(time)) errors.push('Time must be HH:MM:SS')
  if (!evse) errors.push('EVSE ID missing')
  if (!sid) errors.push('CDM Session ID missing')
  if (!['Before start', 'After start'].includes(phase)) errors.push('Start phase must be "Before start" or "After start"')
  if (errors.length) return { ok: false, errors }
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm, ss = 0] = time.split(':').map(Number)
  const ts = new Date(Date.UTC(y, m - 1, d, hh, mm, ss) - IST_MS).toISOString()
  let site = get('site'), city = get('city')
  const loc = get('location')
  if (loc && !site && !city) {
    const parts = loc.split('·').map((s) => s.trim())
    site = parts[0]; city = parts[1] || ''
  }
  const conn = get('connector').replace(/\D/g, '')
  const sample = get('sample', 'is_sample', 'sample row').toLowerCase()
  return {
    ok: true,
    value: {
      session_ts: ts, evse_id: evse, connector: conn ? Number(conn) : null, site, city, state: get('state') || null,
      cdm_session_id: sid, start_phase: phase, stop_reason: get('stop reason', 'stop_reason'),
      error_code: get('error code', 'error_code'), charger_model: get('charger model', 'charger_model'),
      is_sample: sample === 'true' || sample === 'yes' || sample === '1',
    },
  }
}
