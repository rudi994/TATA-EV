// Tata EV Diagnostics server: API + login + live updates + serves the React app
import express from 'express'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { db, insertSession, rowOut, DB_PATH } from './db.js'
import {
  COOKIE, verifyPassword, createLoginSession, userFromToken, endLoginSession, readCookie,
  tooManyAttempts, noteFailure, clearFailures, upsertUser,
} from './auth.js'
import { parseCsv, csvRowToSession } from './csv.js'

const PORT = Number(process.env.PORT || 3000)
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const app = express()
app.set('trust proxy', 1)
app.use(express.json({ limit: '10mb' }))

// ---------- auth helpers ----------
function requireUser(req, res, next) {
  const user = userFromToken(readCookie(req, COOKIE))
  if (!user) return res.status(401).json({ error: 'Please sign in' })
  req.user = user
  next()
}
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admins only' })
  next()
}
function setCookie(req, res, token, maxAge) {
  const secure = req.secure ? '; Secure' : ''
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(maxAge / 1000)}${secure}`)
}

// ---------- live updates (Server-Sent Events) ----------
const clients = new Set()
function broadcast(type, payload) {
  const msg = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`
  for (const res of clients) res.write(msg)
}
setInterval(() => { for (const res of clients) res.write(': ping\n\n') }, 25000).unref()

// ---------- routes ----------
app.post('/api/login', (req, res) => {
  const ip = req.ip
  if (tooManyAttempts(ip)) return res.status(429).json({ error: 'Too many attempts. Try again in 10 minutes.' })
  const { email = '', password = '' } = req.body || {}
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).trim())
  if (!u || !verifyPassword(String(password), u.password_hash)) {
    noteFailure(ip)
    return res.status(401).json({ error: 'Email or password is incorrect.' })
  }
  clearFailures(ip)
  const { token, maxAge } = createLoginSession(u.id)
  setCookie(req, res, token, maxAge)
  res.json({ user: { id: u.id, email: u.email, name: u.name, role: u.role } })
})

app.post('/api/logout', (req, res) => {
  endLoginSession(readCookie(req, COOKIE))
  setCookie(req, res, '', 0)
  res.json({ ok: true })
})

app.get('/api/me', requireUser, (req, res) => res.json({ user: req.user, live: 'sse' }))

app.get('/api/version', requireUser, (req, res) => {
  const r = db.prepare('SELECT count(*) AS n, max(id) AS m FROM failed_sessions').get()
  res.json({ version: `${r.n}-${r.m}`, count: r.n })
})

// Admin: user management
app.get('/api/users', requireUser, requireAdmin, (req, res) => {
  res.json({ rows: db.prepare('SELECT id, email, name, role FROM users ORDER BY email').all() })
})
app.post('/api/users', requireUser, requireAdmin, (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const role = req.body?.role === 'admin' ? 'admin' : 'viewer'
  const password = String(req.body?.password || '')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email.' })
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' })
  if (email === req.user.email.toLowerCase() && role !== 'admin') return res.status(400).json({ error: 'You cannot remove your own admin role.' })
  res.json({ ok: true, status: upsertUser({ email, password, role, name: req.body?.name || null }) })
})
app.delete('/api/users/:id', requireUser, requireAdmin, (req, res) => {
  const id = Number(req.params.id)
  if (id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account.' })
  const r = db.prepare('DELETE FROM users WHERE id = ?').run(id)
  if (!r.changes) return res.status(404).json({ error: 'Not found' })
  res.json({ ok: true })
})

app.get('/api/sessions', requireUser, (req, res) => {
  const rows = db.prepare('SELECT * FROM failed_sessions ORDER BY session_ts DESC').all().map(rowOut)
  res.json({ rows })
})

app.get('/api/fault-codes', requireUser, (req, res) => {
  res.json({ rows: db.prepare('SELECT * FROM fault_codes ORDER BY code').all() })
})

app.get('/api/cities', requireUser, (req, res) => {
  res.json({ rows: db.prepare('SELECT * FROM city_state ORDER BY city').all() })
})

app.get('/api/stream', requireUser, (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
  res.write('event: hello\ndata: {}\n\n')
  clients.add(res)
  req.on('close', () => clients.delete(res))
})

// Admin: add one session (Date/Time in IST, same fields as the CSV)
app.post('/api/sessions', requireUser, requireAdmin, (req, res) => {
  const parsed = csvRowToSession(Object.fromEntries(Object.entries(req.body || {}).map(([k, v]) => [k.toLowerCase(), String(v ?? '').trim()])))
  if (!parsed.ok) return res.status(400).json({ error: parsed.errors.join('; ') })
  const row = insertSession(parsed.value)
  if (!row) return res.status(409).json({ error: 'A session with that CDM Session ID already exists.' })
  broadcast('insert', row)
  res.status(201).json({ row })
})

// Admin: import a CSV (same columns as the export / original extract)
app.post('/api/import', requireUser, requireAdmin, (req, res) => {
  const rows = parseCsv(String(req.body?.csv || ''))
  if (!rows.length) return res.status(400).json({ error: 'The file has no data rows.' })
  let added = 0, duplicates = 0
  const problems = []
  db.exec('BEGIN')
  try {
    rows.forEach((r, i) => {
      const p = csvRowToSession(r)
      if (!p.ok) { problems.push(`Row ${i + 2}: ${p.errors.join('; ')}`); return }
      const row = insertSession(p.value)
      if (row) { added++; broadcast('insert', row) } else duplicates++
    })
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    return res.status(500).json({ error: e.message })
  }
  res.json({ added, duplicates, problems: problems.slice(0, 20), problemCount: problems.length })
})

app.delete('/api/sessions/:id', requireUser, requireAdmin, (req, res) => {
  const id = Number(req.params.id)
  const r = db.prepare('DELETE FROM failed_sessions WHERE id = ?').run(id)
  if (!r.changes) return res.status(404).json({ error: 'Not found' })
  broadcast('delete', { id })
  res.json({ ok: true })
})

app.delete('/api/sample-rows', requireUser, requireAdmin, (req, res) => {
  const ids = db.prepare('SELECT id FROM failed_sessions WHERE is_sample = 1').all().map((r) => r.id)
  db.prepare('DELETE FROM failed_sessions WHERE is_sample = 1').run()
  for (const id of ids) broadcast('delete', { id })
  res.json({ deleted: ids.length })
})

app.use('/api', (req, res) => res.status(404).json({ error: 'Unknown API route' }))

// ---------- the React app ----------
const dist = join(ROOT, 'dist')
if (existsSync(dist)) {
  app.use(express.static(dist))
  app.get('*', (req, res) => res.sendFile(join(dist, 'index.html')))
} else {
  app.get('/', (req, res) => res.send('Run "npm run build" first, then restart the server.'))
}

app.listen(PORT, () => {
  console.log(`Tata EV Diagnostics running at http://localhost:${PORT}`)
  console.log(`Database file: ${DB_PATH}`)
})
