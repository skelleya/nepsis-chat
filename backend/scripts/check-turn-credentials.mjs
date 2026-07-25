/**
 * Quick check that Open Relay static-auth HMAC credentials mint correctly.
 */
import crypto from 'crypto'

const secret = 'openrelayprojectsecret'
const expiry = Math.floor(Date.now() / 1000) + 3600
const username = `${expiry}:nepsis`
const credential = crypto.createHmac('sha1', secret).update(username).digest('base64')

if (!username.includes(':') || !credential || credential.length < 10) {
  console.error('FAIL: bad credential shape', { username, credential })
  process.exit(1)
}
console.log('ok: minted Open Relay TURN credential')
console.log(JSON.stringify({ username, credentialLength: credential.length }, null, 2))
