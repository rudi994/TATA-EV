import { useEffect, useRef, useState } from 'react'
import { ChevronIcon, SearchIcon } from './icons.jsx'

export const EMPTY_FILTERS = {
  from: '', to: '', states: [], cities: [], phase: 'all', connectors: [], reasons: [], models: [], q: '', includeSample: true,
}

export function MultiSelect({ label, options, value, onChange, format = (v) => v }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  const summary = value.length === 0 ? 'All' : value.length === 1 ? format(value[0]) : `${value.length} selected`
  return (
    <div className="ms" ref={ref} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      <button type="button" className={`ms-btn ${value.length ? 'is-active' : ''}`} aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="ms-label">{label}</span>
        <span className="ms-value">{summary}</span>
        <ChevronIcon width={14} height={14} />
      </button>
      {open && (
        <div className="ms-pop" role="group" aria-label={label}>
          <div className="ms-actions">
            <button type="button" className="link-btn" onClick={() => onChange([])}>All</button>
            <button type="button" className="link-btn" onClick={() => onChange(options)}>Select every option</button>
          </div>
          <div className="ms-list">
            {options.length === 0 && <div className="muted small">No options</div>}
            {options.map((o) => (
              <label key={o} className="ms-opt">
                <input type="checkbox" checked={value.includes(o)} onChange={() => toggle(o)} />
                <span>{format(o)}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function FilterBar({ filters, setFilters, options, onReset, resultCount, totalCount }) {
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }))
  const chips = []
  if (filters.from || filters.to) chips.push({ k: 'dates', text: `${filters.from || '…'} → ${filters.to || '…'}`, clear: { from: '', to: '' } })
  if (filters.phase !== 'all') chips.push({ k: 'phase', text: filters.phase, clear: { phase: 'all' } })
  for (const [key, label] of [['states', 'State'], ['cities', 'City'], ['connectors', 'Connector'], ['reasons', 'Stop reason'], ['models', 'Model']]) {
    if (filters[key].length) chips.push({ k: key, text: `${label}: ${filters[key].length === 1 ? filters[key][0] : filters[key].length + ' selected'}`, clear: { [key]: [] } })
  }
  if (filters.q) chips.push({ k: 'q', text: `Search: “${filters.q}”`, clear: { q: '' } })
  if (!filters.includeSample) chips.push({ k: 'sample', text: 'Real records only', clear: { includeSample: true } })

  return (
    <section className="card filters" aria-label="Filters">
      <div className="filters-row">
        <div className="search">
          <SearchIcon width={16} height={16} />
          <input type="search" aria-label="Search EVSE, session ID or site" placeholder="Search EVSE ID, session ID, site…" value={filters.q} onChange={(e) => set({ q: e.target.value })} />
        </div>
        <div className="seg" role="radiogroup" aria-label="Start phase">
          {['all', 'Before start', 'After start'].map((p) => (
            <button key={p} type="button" role="radio" aria-checked={filters.phase === p} className={filters.phase === p ? 'on' : ''} onClick={() => set({ phase: p })}>
              {p !== 'all' && <span className={`dot ${p === 'Before start' ? 'dot-before' : 'dot-after'}`} />}
              {p === 'all' ? 'All phases' : p}
            </button>
          ))}
        </div>
        <label className="date">
          <span>From</span>
          <input type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} />
        </label>
        <label className="date">
          <span>To</span>
          <input type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} />
        </label>
      </div>
      <div className="filters-row">
        <MultiSelect label="State" options={options.states} value={filters.states} onChange={(v) => set({ states: v, cities: [] })} />
        <MultiSelect label="City" options={options.cities} value={filters.cities} onChange={(v) => set({ cities: v })} />
        <MultiSelect label="Connector" options={options.connectors} value={filters.connectors} onChange={(v) => set({ connectors: v })} format={(v) => `#${v}`} />
        <MultiSelect label="Stop reason" options={options.reasons} value={filters.reasons} onChange={(v) => set({ reasons: v })} />
        <MultiSelect label="Model" options={options.models} value={filters.models} onChange={(v) => set({ models: v })} />
        <label className="toggle">
          <input type="checkbox" checked={filters.includeSample} onChange={(e) => set({ includeSample: e.target.checked })} />
          <span>Include dummy rows</span>
        </label>
        <span className="filters-count">
          <strong>{resultCount}</strong> of {totalCount} sessions
        </span>
      </div>
      {chips.length > 0 && (
        <div className="chips">
          {chips.map((c) => (
            <button key={c.k} type="button" className="chip" onClick={() => set(c.clear)} aria-label={`Remove filter ${c.text}`}>
              {c.text} <span aria-hidden="true">×</span>
            </button>
          ))}
          <button type="button" className="link-btn" onClick={onReset}>Clear all</button>
        </div>
      )}
    </section>
  )
}
