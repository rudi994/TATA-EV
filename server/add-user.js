// Usage: npm run user -- <email> <password> [admin|viewer]
import { upsertUser } from './auth.js'

const [email, password, role = 'viewer'] = process.argv.slice(2)
if (!email || !password) {
  console.log('Usage: npm run user -- <email> <password> [admin|viewer]')
  process.exit(1)
}
if (!['admin', 'viewer'].includes(role)) {
  console.log('Role must be admin or viewer')
  process.exit(1)
}
if (password.length < 8) {
  console.log('Use a password of at least 8 characters')
  process.exit(1)
}
console.log(`User ${email} ${upsertUser({ email, password, role })} with role ${role}.`)
