// SQLite database (built into Node 22.13+). One file: data/tata-ev.db
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCsv, csvRowToSession } from './csv.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const DB_PATH = process.env.DB_PATH || join(ROOT, 'data', 'tata-ev.db')
mkdirSync(dirname(DB_PATH), { recursive: true })

export const db = new DatabaseSync(DB_PATH)
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT UNIQUE NOT NULL COLLATE NOCASE,
    name          TEXT,
    role          TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin','viewer')),
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE IF NOT EXISTS login_sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS city_state (
    city  TEXT PRIMARY KEY COLLATE NOCASE,
    state TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS fault_codes (
    code          TEXT PRIMARY KEY,
    charger_model TEXT,
    description   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS failed_sessions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    session_ts     TEXT NOT NULL,              -- ISO time in UTC
    evse_id        TEXT NOT NULL,
    connector      INTEGER,
    site           TEXT,
    city           TEXT,
    state          TEXT,
    cdm_session_id TEXT UNIQUE NOT NULL,
    start_phase    TEXT NOT NULL CHECK (start_phase IN ('Before start','After start')),
    stop_reason    TEXT,
    error_code     TEXT,
    charger_model  TEXT,
    is_sample      INTEGER NOT NULL DEFAULT 0, -- 1 = dummy row
    created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_fs_ts   ON failed_sessions(session_ts DESC);
  CREATE INDEX IF NOT EXISTS idx_fs_evse ON failed_sessions(evse_id);
`)

const CITY_STATE = {
  Mumbai: 'Maharashtra', Pune: 'Maharashtra', Nagpur: 'Maharashtra', Nilgiris: 'Tamil Nadu', Chennai: 'Tamil Nadu',
  Kolkata: 'West Bengal', Gurgaon: 'Haryana', Bengaluru: 'Karnataka', Hyderabad: 'Telangana', Ahmedabad: 'Gujarat',
  Vadodara: 'Gujarat', Jaipur: 'Rajasthan', Lucknow: 'Uttar Pradesh', Noida: 'Uttar Pradesh', Kochi: 'Kerala',
  'New Delhi': 'Delhi', Indore: 'Madhya Pradesh', Bhubaneswar: 'Odisha', Chandigarh: 'Chandigarh',
}
const FAULT_CODES = [
  ['004008', 'Delta 25 kW CCS2', 'Emergency button pressed'],
  ['004014', 'Delta 25 kW CCS2', 'Stop charging by RFID'],
  ['004017', 'Delta 25 kW CCS2', 'Plug-in timeout after authorization'],
  ['006003', 'Delta 25 kW CCS2', '3G backend connection disconnected'],
]
{
  const ins = db.prepare('INSERT OR IGNORE INTO city_state (city, state) VALUES (?, ?)')
  for (const [c, s] of Object.entries(CITY_STATE)) ins.run(c, s)
  const insF = db.prepare('INSERT OR IGNORE INTO fault_codes (code, charger_model, description) VALUES (?, ?, ?)')
  for (const f of FAULT_CODES) insF.run(...f)
}

const stateOf = db.prepare('SELECT state FROM city_state WHERE city = ?')
const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO failed_sessions
    (session_ts, evse_id, connector, site, city, state, cdm_session_id, start_phase, stop_reason, error_code, charger_model, is_sample)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)

export function rowOut(r) {
  return r && { ...r, is_sample: !!r.is_sample }
}

/** Insert one session; returns the stored row, or null if the CDM session ID already exists. */
export function insertSession(s) {
  const state = s.state || (s.city ? stateOf.get(s.city)?.state : null) || null
  const res = insertStmt.run(
    s.session_ts, s.evse_id, s.connector ?? null, s.site || null, s.city || null, state, s.cdm_session_id,
    s.start_phase, s.stop_reason || null, s.error_code || null, s.charger_model || null, s.is_sample ? 1 : 0,
  )
  if (!res.changes) return null
  return rowOut(db.prepare('SELECT * FROM failed_sessions WHERE id = ?').get(res.lastInsertRowid))
}

// First run: load the 7 real + 30 dummy sessions
const count = db.prepare('SELECT count(*) AS n FROM failed_sessions').get().n
const seedFile = join(ROOT, 'data', 'failed_sessions_37.csv')
if (count === 0 && existsSync(seedFile)) {
  const rows = parseCsv(readFileSync(seedFile, 'utf8'))
  let n = 0
  for (const r of rows) { const s = csvRowToSession(r); if (s.ok && insertSession(s.value)) n++ }
  console.log(`Seeded ${n} sessions from ${seedFile}`)
}
