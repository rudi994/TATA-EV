import { useCallback, useMemo, useState } from 'react'
import { useSessions } from './useSessions.js'
import { api } from './api.js'
import AdminTools from './AdminTools.jsx'
import { FilterBar, EMPTY_FILTERS } from './Filters.jsx'
import { TimelineChart, PhaseDonut, RankBars, HourChart } from './Charts.jsx'
import SessionsTable from './SessionsTable.jsx'
import SessionDrawer from './SessionDrawer.jsx'
import {
  countBy, uniqSorted, timeBuckets, istDayStart, istDayEnd, istHour, toIstDateInput, fmtTime, toCsv, download, PHASE_COLORS,
} from './utils.js'
import { BoltIcon, RefreshIcon, LogoutIcon, DownloadIcon, PlugIcon, PinIcon, AlertIcon, RepeatIcon } from './icons.jsx'

const NOT_RECORDED = 'Not recorded'

function LiveBadge({ status, lastUpdate, mode }) {
  const map = {
    live: ['live', 'Live'], connecting: ['wait', 'Connecting…'], loading: ['wait', 'Loading…'],
    offline: ['off', 'Reconnecting…'], error: ['off', 'Connection error'],
  }
  const [cls, text] = map[status] || map.loading
  return (
    <span className={`live live-${cls}`} title={`${mode === 'poll' ? 'Checks for new data every 15 seconds. ' : 'Updates instantly. '}${lastUpdate ? `Last checked ${fmtTime(lastUpdate)} IST` : ''}`}>
      <span className="live-dot" aria-hidden="true" /> {text}
      {lastUpdate && <span className="live-time">· {fmtTime(lastUpdate)}</span>}
    </span>
  )
}

function Kpi({ label, value, sub, icon, tone = 'default' }) {
  return (
    <article className={`kpi kpi-${tone}`}>
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        {icon && <span className="kpi-icon" aria-hidden="true">{icon}</span>}
      </div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </article>
  )
}

function Card({ title, sub, children, actions, className = '' }) {
  return (
    <section className={`card chart-card ${className}`}>
      <header className="card-head">
        <div>
          <h3>{title}</h3>
          {sub && <p className="muted small">{sub}</p>}
        </div>
        {actions}
      </header>
      {children}
    </section>
  )
}

export default function Dashboard({ user, liveMode, onSignOut, onSessionExpired }) {
  const [toasts, setToasts] = useState([])
  const pushToast = useCallback((t) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((ts) => [...ts, { id, ...t }].slice(-3))
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 6000)
  }, [])
  const onInsert = useCallback((r) => pushToast({
    title: 'New failed session',
    text: `${r.evse_id} · ${r.site || ''}${r.city ? ', ' + r.city : ''} · ${r.start_phase}`,
  }), [pushToast])

  const { rows, faultCodes, status, error, lastUpdate, freshIds, reload } = useSessions({ mode: liveMode, onInsert, onSignedOut: onSessionExpired })
  const isAdmin = user?.role === 'admin'
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [selected, setSelected] = useState(null)

  const faultMap = useMemo(() => Object.fromEntries(faultCodes.map((f) => [f.code, f])), [faultCodes])

  // Options come from all rows so choices never disappear while filtering; City narrows to chosen states
  const options = useMemo(() => {
    const ts = rows.map((r) => r.ts)
    return {
      states: uniqSorted(rows.map((r) => r.state)),
      cities: uniqSorted(rows.filter((r) => !filters.states.length || filters.states.includes(r.state)).map((r) => r.city)),
      connectors: uniqSorted(rows.map((r) => (r.connector != null ? String(r.connector) : null))),
      reasons: [...uniqSorted(rows.map((r) => r.stop_reason)), ...(rows.some((r) => !r.stop_reason) ? [NOT_RECORDED] : [])],
      models: uniqSorted(rows.map((r) => r.charger_model)),
      minDate: ts.length ? toIstDateInput(Math.min(...ts)) : undefined,
      maxDate: ts.length ? toIstDateInput(Math.max(...ts)) : undefined,
    }
  }, [rows, filters.states])

  const filtered = useMemo(() => {
    const f = filters
    const from = f.from ? istDayStart(f.from) : -Infinity
    const to = f.to ? istDayEnd(f.to) : Infinity
    const q = f.q.trim().toLowerCase()
    return rows.filter((r) =>
      r.ts >= from && r.ts <= to
      && (f.includeSample || !r.is_sample)
      && (f.phase === 'all' || r.start_phase === f.phase)
      && (!f.states.length || f.states.includes(r.state))
      && (!f.cities.length || f.cities.includes(r.city))
      && (!f.connectors.length || f.connectors.includes(String(r.connector)))
      && (!f.reasons.length || f.reasons.includes(r.stop_reason || NOT_RECORDED))
      && (!f.models.length || f.models.includes(r.charger_model))
      && (!q || [r.evse_id, r.cdm_session_id, r.site, r.city].some((v) => String(v || '').toLowerCase().includes(q))))
  }, [rows, filters])

  const stats = useMemo(() => {
    const byEvse = countBy(filtered, 'evse_id')
    const before = filtered.filter((r) => r.start_phase === 'Before start').length
    const repeatEvses = [...byEvse.entries()].filter(([, n]) => n > 1)
    const top = (m, n = 8) => [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).slice(0, n).map(([name, value]) => ({ name: name ?? '—', value }))
    const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: `${String(h).padStart(2, '0')}:00`, value: 0 }))
    for (const r of filtered) hours[istHour(r.ts)].value++
    const lastByEvse = new Map()
    for (const r of filtered) if (!lastByEvse.has(r.evse_id) || lastByEvse.get(r.evse_id).ts < r.ts) lastByEvse.set(r.evse_id, r)
    return {
      total: filtered.length,
      before, after: filtered.length - before,
      evses: byEvse.size,
      repeat: repeatEvses.length,
      cities: new Set(filtered.map((r) => r.city)).size,
      states: new Set(filtered.map((r) => r.state)).size,
      sites: new Set(filtered.map((r) => r.site)).size,
      cityBars: top(countBy(filtered, 'city')),
      stateBars: top(countBy(filtered, 'state'), 10),
      reasonBars: top(countBy(filtered, (r) => r.stop_reason || NOT_RECORDED)),
      codeBars: top(countBy(filtered.filter((r) => r.error_code), 'error_code')),
      connectorBars: top(countBy(filtered, (r) => `Connector #${r.connector ?? '?'}`)),
      repeatList: repeatEvses.sort((a, b) => b[1] - a[1]).slice(0, 8).map(([evse, n]) => ({ evse, n, last: lastByEvse.get(evse) })),
      hours,
      timeline: timeBuckets(filtered),
    }
  }, [filtered])

  const pct = (n) => (stats.total ? `${Math.round((n / stats.total) * 100)}% of failures` : '—')
  const addFilter = (key, v) => setFilters((f) => (f[key].includes(v) ? f : { ...f, [key]: [...f[key], v] }))

  const exportCsv = () => {
    download(`tata-ev-failed-sessions-${toIstDateInput(Date.now())}.csv`, toCsv(filtered))
    pushToast({ title: 'Export ready', text: `${filtered.length} sessions downloaded as CSV` })
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo"><BoltIcon /></span>
          <div>
            <div className="brand-name">Tata EV Diagnostics</div>
            <div className="brand-sub">Failed-session review &amp; charger fault reference</div>
          </div>
        </div>
        <div className="topbar-right">
          <LiveBadge status={status} lastUpdate={lastUpdate} mode={liveMode} />
          {isAdmin && <AdminTools onToast={pushToast} onChanged={reload} sampleCount={rows.filter((r) => r.is_sample).length} />}
          <button type="button" className="btn btn-icon" onClick={reload} aria-label="Reload data" title="Reload data"><RefreshIcon /></button>
          <div className="user">
            <span className="avatar" aria-hidden="true">{(user?.email || '?')[0].toUpperCase()}</span>
            <span className="user-email">{user?.email}<small>{isAdmin ? 'Admin' : 'Viewer'}</small></span>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onSignOut}><LogoutIcon width={16} height={16} /> Sign out</button>
        </div>
      </header>

      <main className="content">
        {error && (
          <div className="banner banner-error" role="alert">
            Could not load data: {error}. <button type="button" className="link-btn" onClick={reload}>Try again</button>
          </div>
        )}

        <FilterBar filters={filters} setFilters={setFilters} options={options} onReset={() => setFilters(EMPTY_FILTERS)} resultCount={filtered.length} totalCount={rows.length} />

        <section className="kpis" aria-label="Summary">
          <Kpi label="Failed sessions" value={stats.total} sub={`${stats.sites} sites`} icon={<AlertIcon />} tone="dark" />
          <Kpi label="Before start" value={stats.before} sub={pct(stats.before)} tone="before" />
          <Kpi label="After start" value={stats.after} sub={pct(stats.after)} tone="after" />
          <Kpi label="Chargers affected" value={stats.evses} sub="distinct EVSE IDs" icon={<PlugIcon />} />
          <Kpi label="Repeat-failure chargers" value={stats.repeat} sub="2+ failures · visit first" icon={<RepeatIcon />} tone={stats.repeat ? 'warn' : 'default'} />
          <Kpi label="Coverage" value={<>{stats.cities} <small>cities</small></>} sub={`across ${stats.states} states`} icon={<PinIcon />} />
        </section>

        <div className="grid grid-2-1">
          <Card title="Failures over time" sub={`${stats.timeline.unit === 'hour' ? 'Hourly' : 'Daily'} · stacked by start phase · IST`}>
            <TimelineChart data={stats.timeline.data} unit={stats.timeline.unit} />
          </Card>
          <Card title="Start phase split" sub="Did charging begin before it failed?">
            <PhaseDonut before={stats.before} after={stats.after} />
          </Card>
        </div>

        <div className="grid grid-3">
          <Card title="Top cities" sub="Click a bar to filter">
            <RankBars data={stats.cityBars} onPick={(v) => addFilter('cities', v)} />
          </Card>
          <Card title="Stop reasons" sub="Click a bar to filter">
            <RankBars data={stats.reasonBars} onPick={(v) => addFilter('reasons', v)} color="#475569" />
          </Card>
          <Card title="Failures by state" sub="Click a bar to filter">
            <RankBars data={stats.stateBars} onPick={(v) => addFilter('states', v)} labelWidth={120} />
          </Card>
        </div>

        <div className="grid grid-3">
          <Card title="Time of day" sub="When failures happen (IST)">
            <HourChart data={stats.hours} />
          </Card>
          <Card title="Repeat-failure chargers" sub="Chargers with 2 or more failures">
            {stats.repeatList.length === 0 ? <div className="empty">No charger failed more than once.</div> : (
              <ol className="repeat-list">
                {stats.repeatList.map(({ evse, n, last }) => (
                  <li key={evse}>
                    <button type="button" onClick={() => setFilters((f) => ({ ...f, q: evse }))}>
                      <span className="mono strong">{evse}</span>
                      <span className="muted small">{last?.site} · {last?.city}</span>
                    </button>
                    <span className={`count ${n >= 4 ? 'count-hot' : ''}`}>{n}×</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
          <Card title="Error codes" sub="Charger fault codes reported">
            {stats.codeBars.length === 0 ? <div className="empty">No error codes in this selection.</div> : (
              <ul className="code-list">
                {stats.codeBars.map(({ name, value }) => (
                  <li key={name}>
                    <code>{name}</code>
                    <span className="code-desc">{faultMap[name]?.description || 'Unknown code'}</span>
                    <strong>{value}</strong>
                  </li>
                ))}
              </ul>
            )}
            <div className="mini-head">By connector</div>
            <RankBars data={stats.connectorBars} color="#64748b" labelWidth={92} />
          </Card>
        </div>

        <SessionsTable
          rows={filtered}
          freshIds={freshIds}
          onOpen={setSelected}
          actions={<button type="button" className="btn btn-ghost" onClick={exportCsv} disabled={!filtered.length}><DownloadIcon width={16} height={16} /> Export CSV</button>}
        />

        <section className="card">
          <header className="card-head"><div><h3>Charger fault reference</h3><p className="muted small">Codes the dashboard can explain</p></div></header>
          <div className="ref-grid">
            {faultCodes.map((f) => (
              <div key={f.code} className="ref-item"><code>{f.code}</code><span>{f.description}</span><span className="muted small">{f.charger_model}</span></div>
            ))}
          </div>
        </section>

        <footer className="foot muted small">
          Times shown in IST. {rows.filter((r) => r.is_sample).length} of {rows.length} records are dummy rows
          {' '}(<span style={{ color: PHASE_COLORS['Before start'] }}>■</span> Before start · <span style={{ color: PHASE_COLORS['After start'] }}>■</span> After start).
        </footer>
      </main>

      {selected && (
        <SessionDrawer
          session={selected}
          history={rows.filter((r) => r.evse_id === selected.evse_id)}
          faultMap={faultMap}
          onClose={() => setSelected(null)}
          onOpen={setSelected}
          onCopied={() => pushToast({ title: 'Copied', text: 'Session details copied to clipboard' })}
          onDelete={isAdmin ? async (r) => {
            if (!window.confirm(`Delete session ${r.cdm_session_id}? This cannot be undone.`)) return
            try { await api(`/sessions/${r.id}`, { method: 'DELETE' }); setSelected(null); reload(); pushToast({ title: 'Deleted', text: `Session ${r.cdm_session_id} removed` }) }
            catch (e) { pushToast({ title: 'Could not delete', text: e.message, tone: 'error' }) }
          } : null}
        />
      )}

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone === 'error' ? 'toast-error' : ''}`}><strong>{t.title}</strong><span>{t.text}</span></div>
        ))}
      </div>
    </div>
  )
}
