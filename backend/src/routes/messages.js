import { Router } from 'express'
import db from '../db/init.js'

export const messagesRouter = Router()

messagesRouter.get('/channel/:channelId', (req, res) => {
  const { channelId } = req.params
  const limit = Math.min(parseInt(req.query.limit) || 50, 100)
  const before = req.query.before
  let messages
  if (before) {
    messages = db.prepare(`
      SELECT m.*, u.username FROM messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.channel_id = ? AND m.created_at < ?
      ORDER BY m.created_at DESC LIMIT ?
    `).all(channelId, before, limit)
  } else {
    messages = db.prepare(`
      SELECT m.*, u.username FROM messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.channel_id = ?
      ORDER BY m.created_at DESC LIMIT ?
    `).all(channelId, limit)
  }
  res.json(messages.reverse())
})

messagesRouter.post('/', (req, res) => {
  const { channelId, userId, content } = req.body
  if (!channelId || !userId || !content) {
    return res.status(400).json({ error: 'channelId, userId, content required' })
  }
  const id = 'm' + Date.now() + Math.random().toString(36).slice(2)
  db.prepare('INSERT INTO messages (id, channel_id, user_id, content) VALUES (?, ?, ?, ?)').run(id, channelId, userId, content)
  const msg = db.prepare('SELECT m.*, u.username FROM messages m JOIN users u ON m.user_id = u.id WHERE m.id = ?').get(id)
  res.status(201).json(msg)
})
