/**
 * Clean up large temp/build files to free disk space.
 * Run: node scripts/clean-disk.js
 */
const fs = require('fs')
const path = require('path')
const os = require('os')

const projectRoot = path.join(__dirname, '..')
let freed = 0

function getSize(dir) {
  if (!fs.existsSync(dir)) return 0
  let total = 0
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) total += getSize(full)
      else total += fs.statSync(full).size
    }
  } catch {}
  return total
}

function rm(dir, label) {
  if (!fs.existsSync(dir)) return
  const sizeMB = (getSize(dir) / 1024 / 1024).toFixed(1)
  try {
    fs.rmSync(dir, { recursive: true })
    console.log(`Deleted ${label}: ${sizeMB} MB`)
    freed += parseFloat(sizeMB)
  } catch (err) {
    console.error(`Failed to delete ${label}:`, err.message)
  }
}

console.log('Cleaning project build artifacts and old files...\n')

// Project: backend/updates (old installers — now on GitHub)
const updates = path.join(projectRoot, 'backend', 'updates')
rm(updates, 'backend/updates (old installers)')

// Project: electron/dist (~10 GB of build output)
const electronDist = path.join(projectRoot, 'electron', 'dist')
rm(electronDist, 'electron/dist (build output)')

// Project: frontend/dist (can rebuild)
const frontendDist = path.join(projectRoot, 'frontend', 'dist')
rm(frontendDist, 'frontend/dist (build output)')

console.log('\n--- C: drive caches (run manually if needed) ---')
console.log('npm cache:  npm cache clean --force')
console.log('electron:   rm -rf %LOCALAPPDATA%\\electron\\Cache')
console.log('')

if (freed > 0) {
  console.log(`Freed ~${freed.toFixed(1)} MB from project`)
}
