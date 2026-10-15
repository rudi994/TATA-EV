// Netlify Function: every /api/* request lands here.
import { getStore } from '@netlify/blobs'
import { handle } from '../lib/app.mjs'

export default async (req) => {
  const blobs = getStore({ name: 'tata-ev', consistency: 'strong' })
  const store = {
    get: (key) => blobs.get(key, { type: 'json' }),
    set: (key, value) => blobs.setJSON(key, value),
  }
  try {
    return await handle(req, store, process.env)
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: 'Server error: ' + e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

export const config = { path: '/api/*' }
