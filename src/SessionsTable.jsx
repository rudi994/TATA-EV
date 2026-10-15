import { useEffect, useMemo, useState } from 'react'
import { fmtDateTime } from './utils.js'
import { SortIcon } from './icons.jsx'

const COLS = [
  { key: 'ts', label: 'Reported (IST)', render: (r) => <span className="mono">{fmtDateTime(r.ts)}</span> },
  { key: 'evse_id', label: 'EVSE ID', render: (r) => <span className="mono strong">{r.evse_id}</span> },
  { key: 'connector', label: 'Conn.', render: (r) => (r.connector ? `#${r.connector}` : '—') },
  { key: 'site', label: 'Site', render: (r) => <span className="clip" title={r.site}>{r.site}</span> },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'cdm_session_id', label: 'CDM session', render: (r) => <span className="mono">{r.cdm_session_id}</span> },
  { key: 'start_phase', label: 'Start phase', render: (r) => <PhaseBadge phase={r.start_phase} /> },
  { key: 'stop_reason', label: 'Stop reason', render: (r) => r.stop_reason || <span className="muted">—</span> },
  { key: 'error_code', label: 'Error', render: (r) => (r.error_code ? <code>{r.error_code}</code> : <span className="muted">—</span>) },
]

export function PhaseBadge({ phase }) {
  return <span className={`badge ${phase === 'Before start' ? 'badge-before' : 'badge-after'}`}><span className="dot" />{phase}</span>
}

export default function SessionsTable({ rows, freshIds, onOpen, actions }) {
  const [sort, setSort] = useState({ key: 'ts', dir: 'desc' })
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(15)

  const sorted = useMemo(() => {
    const s = [...rows]
    const { key, dir } = sort
    s.sort((a, b) => {
      const x = a[key] ?? '', y = b[key] ?? ''
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'en', { numeric: true })
      return dir === 'asc' ? c : -c
    })
    return s
  }, [rows, sort])

  const pages = Math.max(1, Math.ceil(sorted.length / size))
  useEffect(() => { if (page > pages - 1) setPage(0) }, [pages, page])
  const view = sorted.slice(page * size, page * size + size)
  const toggleSort = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }))

  return (
    <section className="card table-card">
      <header className="card-head">
        <div>
          <h3>Failed sessions</h3>
          <p className="muted small">Click a row for the full record and that charger's history</p>
        </div>
        {actions}
      </header>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {COLS.map((c) => (
                <th key={c.key} scope="col" aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" onClick={() => toggleSort(c.key)}>
                    {c.label} <SortIcon dir={sort.key === c.key ? sort.dir : null} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.length === 0 && (
              <tr><td colSpan={COLS.length} className="empty">No sessions match these filters.</td></tr>
            )}
            {view.map((r) => (
              <tr key={r.id} className={freshIds.has(r.id) ? 'fresh' : ''} tabIndex={0}
                onClick={() => onOpen(r)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(r) }}>
                {COLS.map((c) => <td key={c.key}>{c.render ? c.render(r) : (r[c.key] ?? '—')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="pager">
        <label className="muted small">
          Rows per page{' '}
          <select value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0) }}>
            {[10, 15, 25, 50, 100].map((n) => <option key={n}>{n}</option>)}
          </select>
        </label>
        <span className="muted small">
          {sorted.length ? `${page * size + 1}–${Math.min(sorted.length, (page + 1) * size)} of ${sorted.length}` : '0 results'}
        </span>
        <div className="pager-btns">
          <button type="button" className="btn btn-ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</button>
          <span className="small">Page {page + 1} / {pages}</span>
          <button type="button" className="btn btn-ghost" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </footer>
    </section>
  )
}
