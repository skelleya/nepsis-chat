import 'dotenv/config'
import fs from 'fs'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
// Supabase client is imported by each route — no SQLite init needed
import { authRouter } from './routes/auth.js'
import { serversRouter } from './routes/servers.js'
import { messagesRouter } from './routes/messages.js'
import { uploadsRouter } from './routes/uploads.js'
import { emojisRouter } from './routes/emojis.js'
import { usersRouter } from './routes/users.js'
import { dmRouter } from './routes/dm.js'
import { friendsRouter } from './routes/friends.js'
import { invitesRouter } from './routes/invites.js'
import { versionRouter } from './routes/version.js'
import { registerChatHandlers } from './socket/chat.js'
import { registerVoiceHandlers } from './socket/voice.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const httpServer = createServer(app)

// CORS: allow env-configured origins, plus localhost for dev.
// CORS_ORIGINS=* means allow all; otherwise comma-separated list of origins.
// Also allow null origin which is sent by Electron's file:// protocol.
const rawOrigins = process.env.CORS_ORIGINS || ''
const allowAll = rawOrigins.trim() === '*'
const allowedOrigins = allowAll
  ? true // cors package: true = reflect request origin (allow all)
  : ['http://localhost:5173', 'http://127.0.0.1:5173',
     ...rawOrigins.split(',').map((o) => o.trim()).filter(Boolean)]

// Custom origin handler to also accept null origin (Electron file://)
const corsOrigin = allowAll
  ? true
  : function (origin, callback) {
      // Allow requests with no origin (Electron file://, server-to-server, curl)
      if (!origin) return callback(null, true)
      if (allowedOrigins.includes(origin)) return callback(null, true)
      callback(new Error('Not allowed by CORS'))
    }

const io = new Server(httpServer, {
  cors: { origin: corsOrigin },
})

app.use(cors({ origin: corsOrigin }))
app.use(express.json())

// API routes
app.use('/api/auth', authRouter)
app.use('/api/servers', serversRouter)
app.use('/api/messages', messagesRouter)
app.use('/api/uploads', uploadsRouter)
app.use('/api/emojis', emojisRouter)
app.use('/api/users', usersRouter)
app.use('/api/dm', dmRouter)
app.use('/api/friends', friendsRouter)
app.use('/api/invites', invitesRouter)
app.use('/api/version', versionRouter)

// Redirect /updates/download to latest installer (for download page when frontend is on Vercel)
app.get('/updates/download', (req, res) => {
  const updatesDir = path.join(__dirname, '../updates')
  const latestYml = path.join(updatesDir, 'latest.yml')
  if (!fs.existsSync(latestYml)) {
    return res.status(404).json({ error: 'No installer available yet' })
  }
  const yml = fs.readFileSync(latestYml, 'utf8')
  const pathMatch = yml.match(/^path:\s*(.+)$/m)
  const installerName = pathMatch ? pathMatch[1].trim() : null
  if (!installerName || !fs.existsSync(path.join(updatesDir, installerName))) {
    return res.status(404).json({ error: 'Installer not found' })
  }
  res.redirect(302, `/updates/${encodeURIComponent(installerName)}`)
})

app.use('/updates', express.static(path.join(__dirname, '../updates')))

// Frontend is on Vercel — Fly only serves API, Socket.io, and /updates

const chatNamespace = io.of('/chat')
const voiceNamespace = io.of('/voice')

app.set('voiceNamespace', voiceNamespace)

registerChatHandlers(chatNamespace)
registerVoiceHandlers(voiceNamespace)

const PORT = process.env.PORT || 3000
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
