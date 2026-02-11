/**
 * Cleans backend/updates to only the latest installer.
 * Run before deploy to avoid sending 8+ GB of old installers.
 */
const fs = require('fs')
const path = require('path')

const backendUpdates = path.join(__dirname, '../backend/updates')
if (!fs.existsSync(backendUpdates)) {
  console.log('backend/updates does not exist, nothing to clean.')
  process.exit(0)
}

const latestYml = path.join(backendUpdates, 'latest.yml')
if (!fs.existsSync(latestYml)) {
  console.log('No latest.yml, clearing backend/updates.')
  fs.readdirSync(backendUpdates).forEach((f) => fs.unlinkSync(path.join(backendUpdates, f)))
  process.exit(0)
}

const yml = fs.readFileSync(latestYml, 'utf8')
const pathMatch = yml.match(/^path:\s*(.+)$/m)
const keepFile = pathMatch ? pathMatch[1].trim() : null

const files = fs.readdirSync(backendUpdates)
let removed = 0
for (const f of files) {
  if (f === 'latest.yml' || f === keepFile) continue
  fs.unlinkSync(path.join(backendUpdates, f))
  removed++
}

console.log(`Cleaned backend/updates: removed ${removed} old file(s). Kept: latest.yml${keepFile ? `, ${keepFile}` : ''}`)
