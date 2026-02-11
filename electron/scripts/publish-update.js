const fs = require('fs')
const path = require('path')

const electronDist = path.join(__dirname, '../dist')
const backendUpdates = path.join(__dirname, '../../backend/updates')
const latestYmlPath = path.join(electronDist, 'latest.yml')

if (!fs.existsSync(latestYmlPath)) {
  console.error('No latest.yml found. Run "npm run package" first.')
  process.exit(1)
}

const latestYml = fs.readFileSync(latestYmlPath, 'utf8')
const pathMatch = latestYml.match(/^path:\s*(.+)$/m)
let setupExe = pathMatch ? pathMatch[1].trim() : null

if (!setupExe || !fs.existsSync(path.join(electronDist, setupExe))) {
  setupExe = fs.readdirSync(electronDist).find((f) => f.endsWith('.exe') && f.includes('Setup'))
  if (!setupExe) {
    console.error('No Setup exe found. Run "npm run package" first.')
    process.exit(1)
  }
}

if (!fs.existsSync(backendUpdates)) {
  fs.mkdirSync(backendUpdates, { recursive: true })
}

fs.copyFileSync(path.join(electronDist, setupExe), path.join(backendUpdates, setupExe))
fs.copyFileSync(latestYmlPath, path.join(backendUpdates, 'latest.yml'))

console.log(`Published ${setupExe} and latest.yml to backend/updates/`)
console.log('Restart the backend to serve the update.')
