import { useEffect, useRef } from 'react'
import { fmtDateTime } from './utils.js'
import { PhaseBadge } from './SessionsTable.jsx'
import { CloseIcon, CopyIcon } from './icons.jsx'

export default function SessionDrawer({ session: s, history, faultMap, onClose, onOpen, onCopied, onDelete }) {
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus() }, [s.id])
  const code = s.error_code ? faultMap[s.error_code] : null
  const others = history.filter((h) => h.id !== s.id).sort((a, b) => b.ts - a.ts)

  const copy = async () => {
    const text = [
      `CDM session: ${s.cdm_session_id}`, `Reported: ${fmtDateTime(s.ts)} IST`, `EVSE: ${s.evse_id} (Connector #${s.connector ?? '?'})`,
      `Site: ${s.site}, ${s.city}, ${s.state}`, `Start phase: ${s.start_phase}`, `Stop reason: ${s.stop_reason || '—'}`,
      `Error code: ${s.error_code ? `${s.error_code}${code ? ' · ' + code.description : ''}` : '—'}`, `Charger model: ${s.charger_model || '—'}`,
    ].join('\n')
    try { await navigator.clipboard.writeText(text); onCopied() } catch { /* clipboard blocked */ }
  }

  const Field = ({ label, children, mono }) => (
    <div className="field-view"><span>{label}</span><strong className={mono ? 'mono' : ''}>{children}</strong></div>
  )

  return (
    <div className="drawer-wrap" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <button type="button" className="drawer-scrim" aria-label="Close details" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" tabIndex={-1} ref={ref}>
        <header className="drawer-head">
          <div>
            <p className="eyebrow">Failed session</p>
            <h2 id="drawer-title" className="mono">{s.cdm_session_id}</h2>
            <PhaseBadge phase={s.start_phase} />
            {s.is_sample && <span className="badge badge-sample">Dummy row</span>}
          </div>
          <button type="button" className="btn btn-icon" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </header>

        <div className="drawer-body">
          <div className="field-grid">
            <Field label="Reported (IST)" mono>{fmtDateTime(s.ts)}</Field>
            <Field label="EVSE ID" mono>{s.evse_id}</Field>
            <Field label="Connector">{s.connector ? `#${s.connector}` : '—'}</Field>
            <Field label="Charger model">{s.charger_model || '—'}</Field>
            <Field label="Stop reason">{s.stop_reason || 'Not recorded'}</Field>
            <Field label="Error code" mono>{s.error_code || '—'}</Field>
          </div>

          {code && (
            <div className="callout">
              <code>{code.code}</code> {code.description}
              <span className="muted small"> · {code.charger_model}</span>
            </div>
          )}

          <div className="loc">
            <span className="eyebrow">Location</span>
            <strong>{s.site}</strong>
            <span>{s.city}, {s.state}</span>
          </div>

          <div>
            <h3 className="h-small">This charger's other failures <span className="muted">({others.length})</span></h3>
            {others.length === 0 ? <p className="muted small">No other failures recorded for {s.evse_id}.</p> : (
              <ul className="history">
                {others.map((h) => (
                  <li key={h.id}>
                    <button type="button" onClick={() => onOpen(h)}>
                      <span className="mono small">{fmtDateTime(h.ts)}</span>
                      <PhaseBadge phase={h.start_phase} />
                      <span className="small muted">{h.stop_reason || h.error_code || ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <footer className="drawer-foot">
          {onDelete && <button type="button" className="btn btn-danger" onClick={() => onDelete(s)}>Delete</button>}
          <span className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
          <button type="button" className="btn btn-primary" onClick={copy}><CopyIcon width={16} height={16} /> Copy details</button>
        </footer>
      </aside>
    </div>
  )
}
