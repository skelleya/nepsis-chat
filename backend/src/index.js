import 'dotenv/config'
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
app.use('/api/version', versionRouter)
app.use('/updates', express.static(path.join(__dirname, '../updates')))

// Serve frontend static files in production
const frontendPath = path.join(__dirname, '../public')
app.use(express.static(frontendPath))
// SPA fallback — any non-API route serves index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/updates') || req.path.startsWith('/socket.io')) {
    return next()
  }
  res.sendFile(path.join(frontendPath, 'index.html'))
})

const chatNamespace = io.of('/chat')
const voiceNamespace = io.of('/voice')

registerChatHandlers(chatNamespace)
registerVoiceHandlers(voiceNamespace)

const PORT = process.env.PORT || 3000
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
