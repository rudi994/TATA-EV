import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { normalize } from './utils.js'

export const POLL_SECONDS = 15

/**
 * Loads every failed session and keeps the list current.
 *  - mode 'sse':  the local server pushes inserts/deletes instantly.
 *  - mode 'poll': (Netlify) asks every 15s whether anything changed and reloads if so.
 */
export function useSessions({ mode = 'poll', onInsert, onSignedOut } = {}) {
  const [rows, setRows] = useState([])
  const [faultCodes, setFaultCodes] = useState([])
  const [status, setStatus] = useState('loading') // loading | live | offline | error
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [freshIds, setFreshIds] = useState(() => new Set())
  const cb = useRef({ onInsert, onSignedOut })
  cb.current = { onInsert, onSignedOut }
  const known = useRef(null)   // ids seen so far (null = first load)
  const version = useRef(null)

  const markFresh = useCallback((id) => {
    setFreshIds((s) => new Set(s).add(id))
    setTimeout(() => setFreshIds((s) => { const n = new Set(s); n.delete(id); return n }), 8000)
  }, [])

  const handleError = useCallback((e) => {
    if (e.status === 401) { cb.current.onSignedOut?.(); return }
    setError(e.message)
    setStatus((s) => (s === 'loading' ? 'error' : 'offline'))
  }, [])

  const load = useCallback(async () => {
    try {
      const [s, f] = await Promise.all([api('/sessions'), api('/fault-codes')])
      const next = s.rows.map(normalize)
      if (known.current) {
        for (const r of next) if (!known.current.has(r.id)) { markFresh(r.id); cb.current.onInsert?.(r) }
      }
      known.current = new Set(next.map((r) => r.id))
      if (s.version !== undefined) version.current = s.version
      setRows(next)
      setFaultCodes(f.rows)
      setLastUpdate(Date.now())
      setError(null)
      if (mode === 'poll') setStatus('live')
    } catch (e) { handleError(e) }
  }, [mode, markFresh, handleError])

  // Instant mode (local server)
  useEffect(() => {
    if (mode !== 'sse') return
    load()
    const es = new EventSource('/api/stream')
    es.addEventListener('hello', () => { setStatus('live'); load() })
    es.addEventListener('insert', (e) => {
      const r = normalize(JSON.parse(e.data))
      known.current?.add(r.id)
      setRows((prev) => [r, ...prev.filter((x) => x.id !== r.id)].sort((a, b) => b.ts - a.ts))
      setLastUpdate(Date.now())
      markFresh(r.id)
      cb.current.onInsert?.(r)
    })
    es.addEventListener('delete', (e) => {
      const { id } = JSON.parse(e.data)
      setRows((prev) => prev.filter((x) => x.id !== id))
      setLastUpdate(Date.now())
    })
    es.onerror = () => setStatus('offline')
    return () => es.close()
  }, [mode, load, markFresh])

  // Polling mode (Netlify): cheap version check, full reload only when something changed
  useEffect(() => {
    if (mode !== 'poll') return
    load()
    let stopped = false
    const tick = async () => {
      if (stopped || document.visibilityState !== 'visible') return
      try {
        const v = await api('/version')
        setStatus('live')
        if (v.version !== version.current) await load()
        else setLastUpdate(Date.now())
      } catch (e) { handleError(e) }
    }
    const timer = setInterval(tick, POLL_SECONDS * 1000)
    const onVisible = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { stopped = true; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [mode, load, handleError])

  return { rows, faultCodes, status, error, lastUpdate, freshIds, reload: load }
}
