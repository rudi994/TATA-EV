import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'
import { CloseIcon } from './icons.jsx'

export default function UsersDialog({ onClose, onToast }) {
  const [users, setUsers] = useState([])
  const [form, setForm] = useState({ email: '', password: '', role: 'viewer' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => api('/users').then((d) => setUsers(d.rows)).catch((e) => setError(e.message)), [])
  useEffect(() => { load() }, [load])

  async function save(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const r = await api('/users', { method: 'POST', body: form })
      onToast({ title: r.status === 'created' ? 'User added' : 'User updated', text: `${form.email} · ${form.role}. Share the password with them securely.` })
      setForm({ email: '', password: '', role: 'viewer' })
      load()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function remove(u) {
    if (!window.confirm(`Remove ${u.email}? They will no longer be able to sign in.`)) return
    try { await api(`/users/${u.id}`, { method: 'DELETE' }); load(); onToast({ title: 'User removed', text: u.email }) }
    catch (err) { setError(err.message) }
  }

  return (
    <div className="modal-wrap" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <button type="button" className="drawer-scrim" aria-label="Close" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="users-title">
        <header className="drawer-head">
          <div><p className="eyebrow">Admin</p><h2 id="users-title">Users</h2></div>
          <button type="button" className="btn btn-icon" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </header>
        <div className="users-body">
          <table className="users-table">
            <thead><tr><th scope="col">Email</th><th scope="col">Role</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td><span className={`badge ${u.role === 'admin' ? 'badge-after' : 'badge-sample'}`}>{u.role}</span></td>
                  <td className="right">
                    <button type="button" className="link-btn" onClick={() => setForm({ email: u.email, password: '', role: u.role })}>Reset password</button>
                    {' · '}
                    <button type="button" className="link-btn danger-link" onClick={() => remove(u)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <form className="users-form" onSubmit={save}>
            <h3 className="h-small">Add a user or reset a password</h3>
            <p className="muted small">Using an existing email updates that person's password and role.</p>
            <div className="form-grid tight">
              <label className="field"><span>Email</span><input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              <label className="field"><span>Password (8+ characters)</span><input type="text" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" /></label>
              <label className="field"><span>Role</span>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="viewer">Viewer: can look, filter and export</option>
                  <option value="admin">Admin: can also change data and users</option>
                </select>
              </label>
            </div>
            {error && <div className="banner banner-error" role="alert">{error}</div>}
            <div className="row-end"><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save user'}</button></div>
          </form>
        </div>
      </div>
    </div>
  )
}
