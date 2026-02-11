const fs = require('fs')
const path = require('path')

const pkgPath = path.join(__dirname, '../package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))

const oldVersion = pkg.version
const parts = oldVersion.split('.').map(Number)
parts[2] = (parts[2] || 0) + 1
const newVersion = parts.join('.')

pkg.version = newVersion
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

console.log(`Version bumped: ${oldVersion} -> ${newVersion}`)
