import { useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { toIstDateInput, IST_OFFSET } from './utils.js'
import { CloseIcon, ChevronIcon } from './icons.jsx'
import UsersDialog from './UsersDialog.jsx'

const nowIstTime = () => new Date(Date.now() + IST_OFFSET).toISOString().slice(11, 19)

function AddSessionDialog({ onClose, onToast, onChanged }) {
  const [cities, setCities] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [f, setF] = useState({
    date: toIstDateInput(Date.now()), time: nowIstTime(), evse: '', connector: '1', site: '', city: '',
    sid: '', phase: 'Before start', reason: '', code: '', model: '',
  })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  useEffect(() => { api('/cities').then((d) => setCities(d.rows)).catch(() => {}) }, [])

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      await api('/sessions', {
        method: 'POST',
        body: {
          date: f.date, time: f.time.length === 5 ? f.time + ':00' : f.time, 'evse id': f.evse, connector: f.connector, site: f.site, city: f.city,
          'cdm session id': f.sid, 'start phase': f.phase, 'stop reason': f.reason, 'error code': f.code, 'charger model': f.model,
        },
      })
      onChanged?.()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally { setBusy(false) }
  }

  return (
    <div className="modal-wrap" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <button type="button" className="drawer-scrim" aria-label="Close" onClick={onClose} />
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="add-title" onSubmit={submit}>
        <header className="drawer-head">
          <div><p className="eyebrow">Admin</p><h2 id="add-title">Add failed session</h2></div>
          <button type="button" className="btn btn-icon" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </header>
        <div className="form-grid">
          <label className="field"><span>Date (IST)</span><input type="date" required value={f.date} onChange={set('date')} /></label>
          <label className="field"><span>Time (IST)</span><input type="time" step="1" required value={f.time} onChange={set('time')} /></label>
          <label className="field"><span>EVSE ID</span><input required value={f.evse} onChange={set('evse')} placeholder="TPAC144NEW" /></label>
          <label className="field"><span>Connector</span>
            <select value={f.connector} onChange={set('connector')}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>#{n}</option>)}</select>
          </label>
          <label className="field span-2"><span>Site</span><input required value={f.site} onChange={set('site')} placeholder="Lodha Residential One" /></label>
          <label className="field"><span>City</span>
            <input required list="city-list" value={f.city} onChange={set('city')} placeholder="Mumbai" />
            <datalist id="city-list">{cities.map((c) => <option key={c.city} value={c.city}>{c.state}</option>)}</datalist>
          </label>
          <label className="field"><span>CDM Session ID</span><input required value={f.sid} onChange={set('sid')} placeholder="8777721" /></label>
          <label className="field"><span>Start phase</span>
            <select value={f.phase} onChange={set('phase')}><option>Before start</option><option>After start</option></select>
          </label>
          <label className="field"><span>Stop reason <em>optional</em></span><input value={f.reason} onChange={set('reason')} placeholder="EVDisconnected" /></label>
          <label className="field"><span>Error code <em>optional</em></span><input value={f.code} onChange={set('code')} placeholder="004017" /></label>
          <label className="field"><span>Charger model <em>optional</em></span><input value={f.model} onChange={set('model')} placeholder="Delta 25 kW CCS2" /></label>
        </div>
        {error && <div className="banner banner-error" role="alert">{error}</div>}
        <footer className="drawer-foot">
          <span className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Add session'}</button>
        </footer>
      </form>
    </div>
  )
}

export default function AdminTools({ onToast, onChanged, sampleCount }) {
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [usersOpen, setUsersOpen] = useState(false)
  const fileRef = useRef(null)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  async function importFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const r = await api('/import', { method: 'POST', body: { csv: await file.text() } })
      onToast({
        title: 'Import finished',
        text: `${r.added} added · ${r.duplicates} already existed${r.problemCount ? ` · ${r.problemCount} rows skipped (${r.problems[0]})` : ''}`,
        tone: r.problemCount && !r.added ? 'error' : undefined,
      })
      onChanged?.()
    } catch (err) {
      onToast({ title: 'Import failed', text: err.message, tone: 'error' })
    }
  }

  async function removeSamples() {
    setOpen(false)
    if (!window.confirm(`Delete all ${sampleCount} dummy rows? Real records are kept.`)) return
    try {
      const r = await api('/sample-rows', { method: 'DELETE' })
      onToast({ title: 'Dummy rows removed', text: `${r.deleted} rows deleted` })
      onChanged?.()
    } catch (err) { onToast({ title: 'Could not delete', text: err.message, tone: 'error' }) }
  }

  return (
    <div className="ms" ref={ref} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      <button type="button" className="btn btn-primary" aria-expanded={open} onClick={() => setOpen(!open)}>
        Manage data <ChevronIcon width={14} height={14} />
      </button>
      {open && (
        <div className="ms-pop menu" role="menu">
          <button type="button" role="menuitem" onClick={() => { setOpen(false); setAdding(true) }}>
            <strong>Add a session</strong><span>Type in one failed session</span>
          </button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); fileRef.current?.click() }}>
            <strong>Import CSV</strong><span>Same columns as the Failed Sessions extract</span>
          </button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); setUsersOpen(true) }}>
            <strong>Manage users</strong><span>Add people, reset passwords, set roles</span>
          </button>
          {sampleCount > 0 && (
            <button type="button" role="menuitem" className="danger" onClick={removeSamples}>
              <strong>Remove dummy rows</strong><span>{sampleCount} sample sessions</span>
            </button>
          )}
        </div>
      )}
      <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={importFile} />
      {adding && <AddSessionDialog onClose={() => setAdding(false)} onToast={onToast} onChanged={onChanged} />}
      {usersOpen && <UsersDialog onClose={() => setUsersOpen(false)} onToast={onToast} />}
    </div>
  )
}
