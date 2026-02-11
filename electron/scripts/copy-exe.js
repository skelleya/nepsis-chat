const fs = require('fs')
const path = require('path')

const electronDist = path.join(__dirname, '../dist')
const latestYmlPath = path.join(electronDist, 'latest.yml')
const frontendPublic = path.join(__dirname, '../../frontend/public')

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

const destPath = path.join(frontendPublic, 'NepsisChat-Setup.exe')
fs.copyFileSync(path.join(electronDist, setupExe), destPath)
console.log(`Copied ${setupExe} to frontend/public/NepsisChat-Setup.exe`)
