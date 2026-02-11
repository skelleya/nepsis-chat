/**
 * Deploy to Fly.io — wraps flyctl so it works from npm scripts on Windows.
 * flyctl is installed to %USERPROFILE%\.fly\bin which isn't on the system PATH
 * by default, so this script prepends it before calling flyctl.
 * Runs clean-updates first so Fly only pushes ~100MB instead of 9GB.
 */
const { execSync } = require('child_process')
const path = require('path')
const os = require('os')

// Clean backend/updates to only latest installer (avoids pushing 8+ GB of old exes)
try {
  execSync('node scripts/clean-updates.js', { cwd: path.join(__dirname, '..'), stdio: 'inherit' })
} catch (e) {
  console.error('\nClean-updates failed. Close any apps that may have the installer open, then run: npm run clean-updates')
  process.exit(1)
}

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
