/**
 * Deploy to Fly.io — wraps flyctl so it works from npm scripts on Windows.
 * flyctl is installed to %USERPROFILE%\.fly\bin which isn't on the system PATH
 * by default, so this script prepends it before calling flyctl.
 * Updates are on GitHub — Fly only deploys backend (API + Socket.io).
 */
const { execSync } = require('child_process')
const path = require('path')
const os = require('os')

// Updates are on GitHub — no backend/updates to clean

const flyBin = path.join(os.homedir(), '.fly', 'bin')
const env = { ...process.env, PATH: `${flyBin}${path.delimiter}${process.env.PATH}` }

try {
  execSync('flyctl deploy --app nepsis-chat --local-only', {
    stdio: 'inherit',
    env,
    cwd: path.join(__dirname, '..'),
  })
} catch (e) {
  process.exit(e.status || 1)
}
