import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'
import Login from './Login.jsx'
import Dashboard from './Dashboard.jsx'

export default function App() {
  const [me, setMe] = useState(undefined) // undefined = still checking, null = signed out

  const check = useCallback(() => api('/me').then((d) => setMe(d)).catch(() => setMe(null)), [])
  useEffect(() => { check() }, [check])

  const signOut = async () => {
    try { await api('/logout', { method: 'POST' }) } catch { /* already signed out */ }
    setMe(null)
  }

  if (me === undefined) {
    return <div className="splash"><span className="spinner" aria-hidden="true" /> Checking sign-in…</div>
  }
  if (!me) return <Login onSignedIn={check} />
  // live: 'sse' = instant push (local server), 'poll' = check every 15s (Netlify)
  return <Dashboard user={me.user} liveMode={me.live || 'poll'} onSignOut={signOut} onSessionExpired={() => setMe(null)} />
}
