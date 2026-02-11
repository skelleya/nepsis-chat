/**
 * Deploy to Fly.io — wraps flyctl so it works from npm scripts on Windows.
 * flyctl is installed to %USERPROFILE%\.fly\bin which isn't on the system PATH
 * by default, so this script prepends it before calling flyctl.
 */
const { execSync } = require('child_process')
const path = require('path')
const os = require('os')

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
