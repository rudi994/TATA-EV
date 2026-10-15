// Tata EV Diagnostics API for Netlify Functions.
// Storage is Netlify Blobs: one JSON document for sessions, one for users.
// `store` is passed in ({ get(key), set(key, value) }) so this file can be tested locally.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { parseCsv, csvRowToSession } from '../../server/csv.js'
import { hashPassword, verifyPassword } from '../../server/passwords.js'
import { SEED_SESSIONS, CITY_STATE, FAULT_CODES } from './seed.mjs'

const COOKIE = 'tev_sid'
const SESSION_SECONDS = 7 * 24 * 3600
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } })
const fail = (status, error) => json({ error }, status)

// ---------- storage ----------
async function loadSessions(store) {
  let doc = await store.get('sessions')
  if (!doc) {
    doc = { version: 1, nextId: SEED_SESSIONS.length + 1, rows: SEED_SESSIONS }
    await store.set('sessions', doc)
  }
  return doc
}
async function saveSessions(store, doc) {
  doc.version = (doc.version || 0) + 1
  doc.rows.sort((a, b) => (a.session_ts < b.session_ts ? 1 : -1))
  await store.set('sessions', doc)
}
async function loadUsers(store, env) {
  let users = await store.get('users')
  if (!users || !users.length) {
    if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) return null
    users = [{ id: 1, email: env.ADMIN_EMAIL.trim().toLowerCase(), name: 'Administrator', role: 'admin', password_hash: hashPassword(env.ADMIN_PASSWORD) }]
    await store.set('users', users)
  }
  return users
}

// ---------- signed login cookie ----------
function sign(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}
function unsign(token, secret) {
  const [body, sig] = String(token || '').split('.')
  if (!body || !sig) return null
  const want = createHmac('sha256', secret).update(body).digest('base64url')
  if (sig.length !== want.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString())
    return p.exp > Date.now() / 1000 ? p : null
  } catch { return null }
}
function readCookie(req, name) {
  for (const part of (req.headers.get('cookie') || '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return null
}
const cookieHeader = (value, maxAge) => `${COOKIE}=${value}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${maxAge}`

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role })

// ---------- request handler ----------
export async function handle(req, store, env = process.env) {
  const secret = env.SESSION_SECRET
  if (!secret || secret.length < 16) return fail(500, 'Server not configured: set SESSION_SECRET (at least 16 characters) in Netlify environment variables.')
  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/api/, '').replace(/\/$/, '') || '/'
  const method = req.method
  const body = method === 'POST' ? await req.json().catch(() => ({})) : {}

  const users = await loadUsers(store, env)
  if (!users) return fail(500, 'Server not configured: set ADMIN_EMAIL and ADMIN_PASSWORD in Netlify environment variables.')

  if (path === '/login' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase()
    const u = users.find((x) => x.email === email)
    if (!u || !verifyPassword(String(body.password || ''), u.password_hash)) {
      await new Promise((r) => setTimeout(r, 600)) // slow down guessing
      return fail(401, 'Email or password is incorrect.')
    }
    const token = sign({ uid: u.id, pv: u.password_hash.slice(-12), exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS }, secret)
    return json({ user: publicUser(u) }, 200, { 'Set-Cookie': cookieHeader(token, SESSION_SECONDS) })
  }
  if (path === '/logout' && method === 'POST') {
    return json({ ok: true }, 200, { 'Set-Cookie': cookieHeader('', 0) })
  }

  // Everything below needs a signed-in user. A password reset logs that user out everywhere.
  const tok = unsign(readCookie(req, COOKIE), secret)
  const user = tok && users.find((x) => x.id === tok.uid && x.password_hash.slice(-12) === tok.pv)
  if (!user) return fail(401, 'Please sign in')
  const isAdmin = user.role === 'admin'
  const adminOnly = () => fail(403, 'Admins only')

  if (path === '/me' && method === 'GET') return json({ user: publicUser(user), live: 'poll' })
  if (path === '/fault-codes' && method === 'GET') return json({ rows: FAULT_CODES })
  if (path === '/cities' && method === 'GET') return json({ rows: Object.entries(CITY_STATE).map(([city, state]) => ({ city, state })) })

  if (path === '/version' && method === 'GET') {
    const doc = await loadSessions(store)
    return json({ version: doc.version, count: doc.rows.length })
  }
  if (path === '/sessions' && method === 'GET') {
    const doc = await loadSessions(store)
    return json({ rows: doc.rows, version: doc.version })
  }

  if (path === '/sessions' && method === 'POST') {
    if (!isAdmin) return adminOnly()
    const p = csvRowToSession(Object.fromEntries(Object.entries(body).map(([k, v]) => [k.toLowerCase(), String(v ?? '').trim()])))
    if (!p.ok) return fail(400, p.errors.join('; '))
    const doc = await loadSessions(store)
    if (doc.rows.some((r) => r.cdm_session_id === p.value.cdm_session_id)) return fail(409, 'A session with that CDM Session ID already exists.')
    const row = toRow(p.value, doc.nextId++)
    doc.rows.push(row)
    await saveSessions(store, doc)
    return json({ row }, 201)
  }

  if (path === '/import' && method === 'POST') {
    if (!isAdmin) return adminOnly()
    const rows = parseCsv(String(body.csv || ''))
    if (!rows.length) return fail(400, 'The file has no data rows.')
    const doc = await loadSessions(store)
    const seen = new Set(doc.rows.map((r) => r.cdm_session_id))
    let added = 0, duplicates = 0
    const problems = []
    rows.forEach((r, i) => {
      const p = csvRowToSession(r)
      if (!p.ok) { problems.push(`Row ${i + 2}: ${p.errors.join('; ')}`); return }
      if (seen.has(p.value.cdm_session_id)) { duplicates++; return }
      seen.add(p.value.cdm_session_id)
      doc.rows.push(toRow(p.value, doc.nextId++))
      added++
    })
    if (added) await saveSessions(store, doc)
    return json({ added, duplicates, problems: problems.slice(0, 20), problemCount: problems.length })
  }

  let m = path.match(/^\/sessions\/(\d+)$/)
  if (m && method === 'DELETE') {
    if (!isAdmin) return adminOnly()
    const doc = await loadSessions(store)
    const before = doc.rows.length
    doc.rows = doc.rows.filter((r) => r.id !== Number(m[1]))
    if (doc.rows.length === before) return fail(404, 'Not found')
    await saveSessions(store, doc)
    return json({ ok: true })
  }
  if (path === '/sample-rows' && method === 'DELETE') {
    if (!isAdmin) return adminOnly()
    const doc = await loadSessions(store)
    const before = doc.rows.length
    doc.rows = doc.rows.filter((r) => !r.is_sample)
    await saveSessions(store, doc)
    return json({ deleted: before - doc.rows.length })
  }

  // ---- user management (admins) ----
  if (path === '/users' && method === 'GET') {
    if (!isAdmin) return adminOnly()
    return json({ rows: users.map(publicUser) })
  }
  if (path === '/users' && method === 'POST') {
    if (!isAdmin) return adminOnly()
    const email = String(body.email || '').trim().toLowerCase()
    const role = body.role === 'admin' ? 'admin' : 'viewer'
    const password = String(body.password || '')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(400, 'Enter a valid email.')
    if (password.length < 8) return fail(400, 'Password must be at least 8 characters.')
    const existing = users.find((u) => u.email === email)
    if (existing) {
      if (existing.id === user.id && role !== 'admin') return fail(400, 'You cannot remove your own admin role.')
      existing.role = role
      existing.password_hash = hashPassword(password)
      if (body.name) existing.name = String(body.name)
    } else {
      users.push({ id: Math.max(0, ...users.map((u) => u.id)) + 1, email, name: body.name ? String(body.name) : null, role, password_hash: hashPassword(password) })
    }
    await store.set('users', users)
    return json({ ok: true, status: existing ? 'updated' : 'created' })
  }
  m = path.match(/^\/users\/(\d+)$/)
  if (m && method === 'DELETE') {
    if (!isAdmin) return adminOnly()
    const id = Number(m[1])
    if (id === user.id) return fail(400, 'You cannot delete your own account.')
    const next = users.filter((u) => u.id !== id)
    if (next.length === users.length) return fail(404, 'Not found')
    await store.set('users', next)
    return json({ ok: true })
  }

  return fail(404, 'Unknown API route')
}

function toRow(s, id) {
  return {
    id, session_ts: s.session_ts, evse_id: s.evse_id, connector: s.connector, site: s.site || null, city: s.city || null,
    state: s.state || CITY_STATE[s.city] || Object.entries(CITY_STATE).find(([c]) => c.toLowerCase() === String(s.city).toLowerCase())?.[1] || null,
    cdm_session_id: s.cdm_session_id, start_phase: s.start_phase, stop_reason: s.stop_reason || null, error_code: s.error_code || null,
    charger_model: s.charger_model || null, is_sample: !!s.is_sample, created_at: new Date().toISOString(),
  }
}
