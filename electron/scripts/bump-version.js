const fs = require('fs')
const path = require('path')

const pkgPath = path.join(__dirname, '../package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))

const oldVersion = pkg.version
const parts = oldVersion.split('.').map(Number)
let [major = 0, minor = 0, patch = 0] = parts

patch += 1
if (patch >= 10) {
  patch = 0
  minor += 1
}
const newVersion = [major, minor, patch].join('.')

pkg.version = newVersion
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

console.log(`Version bumped: ${oldVersion} -> ${newVersion}`)
