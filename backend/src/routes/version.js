import { Router } from 'express'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const versionRouter = Router()

let cachedVersion = null

versionRouter.get('/', (req, res) => {
  try {
    if (!cachedVersion) {
      const pkgPath = join(__dirname, '../../package.json')
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
      cachedVersion = pkg.version || '1.0.0'
    }
    res.json({ version: cachedVersion })
  } catch {
    res.json({ version: '1.0.0' })
  }
})
