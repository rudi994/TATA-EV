// Password hashing with scrypt (built into Node). Shared by the local server and the Netlify function.
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto'

export function hashPassword(pw) {
  const salt = randomBytes(16)
  const hash = scryptSync(String(pw), salt, 64)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

export function verifyPassword(pw, stored) {
  const [, saltHex, hashHex] = String(stored || '').split('$')
  if (!saltHex || !hashHex) return false
  const hash = scryptSync(String(pw), Buffer.from(saltHex, 'hex'), 64)
  const want = Buffer.from(hashHex, 'hex')
  return want.length === hash.length && timingSafeEqual(hash, want)
}
