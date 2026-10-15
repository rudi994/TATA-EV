import { useState } from 'react'
import { api } from './api.js'
import { BoltIcon } from './icons.jsx'

function Brand() {
  return (
    <div className="login-brand">
      <span className="logo"><BoltIcon /></span>
      <div>
        <div className="login-brand-name">Tata EV Diagnostics</div>
        <div className="login-brand-sub">Failed-session review &amp; charger fault reference</div>
      </div>
    </div>
  )
}

export default function Login({ onSignedIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError(''); setBusy(true)
    try {
      const { user } = await api('/login', { method: 'POST', body: { email: email.trim(), password } })
      onSignedIn(user)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-art">
        <div className="login-art-inner">
          <Brand />
          <h2>Every failed charge, in one place.</h2>
          <p>Live view of failed charging sessions across the Tata EV network: where they happen, when, and why.</p>
          <ul className="login-points">
            <li>Updates live as new sessions are recorded</li>
            <li>Filter by state, city, charger, phase and stop reason</li>
            <li>Drill into any charger's failure history</li>
          </ul>
        </div>
      </div>
      <main className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div className="login-card-brand"><Brand /></div>
          <h1>Sign in</h1>
          <p className="muted">Use the account your administrator created for you.</p>

          <label className="field">
            <span>Email</span>
            <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" autoFocus />
          </label>
          <label className="field">
            <span>Password</span>
            <div className="pw">
              <input type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="link-btn" onClick={() => setShow(!show)} aria-pressed={show}>{show ? 'Hide' : 'Show'}</button>
            </div>
          </label>

          {error && <div className="banner banner-error" role="alert">{error}</div>}

          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="fine">Access is by invitation only. Forgot your password? Ask your diagnostics admin to reset it.</p>
        </form>
      </main>
    </div>
  )
}
