import { Router } from 'express'
import db from '../db/init.js'

export const serversRouter = Router()

serversRouter.get('/', (req, res) => {
  const servers = db.prepare('SELECT * FROM servers').all()
  res.json(servers)
})

serversRouter.get('/:id', (req, res) => {
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id)
  if (!server) return res.status(404).json({ error: 'Server not found' })
  res.json(server)
})

serversRouter.get('/:id/channels', (req, res) => {
  const channels = db.prepare('SELECT * FROM channels WHERE server_id = ? ORDER BY "order"').all(req.params.id)
  res.json(channels)
})
