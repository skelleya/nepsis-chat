import { Router } from 'express'
import db from '../db/init.js'

export const authRouter = Router()

authRouter.post('/login', (req, res) => {
  const { username } = req.body
  if (!username) {
    return res.status(400).json({ error: 'Username required' })
  }
  let user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
  if (!user) {
    const id = 'u' + Date.now()
    db.prepare('INSERT INTO users (id, username) VALUES (?, ?)').run(id, username)
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
  }
  res.json(user)
})

authRouter.get('/users', (req, res) => {
  const users = db.prepare('SELECT id, username, avatar_url FROM users').all()
  res.json(users)
})
