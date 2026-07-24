import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import path from 'path'
import { fileURLToPath } from 'url'
// Supabase client is imported by each route — no SQLite init needed
import { authRouter } from './routes/auth.js'
import { isSupabaseConfigured } from './db/supabase.js'
import { serversRouter } from './routes/servers.js'
import { messagesRouter } from './routes/messages.js'
import { uploadsRouter } from './routes/uploads.js'
import { emojisRouter } from './routes/emojis.js'
import { usersRouter } from './routes/users.js'
import { dmRouter } from './routes/dm.js'
import { friendsRouter } from './routes/friends.js'
import { invitesRouter } from './routes/invites.js'
import { versionRouter } from './routes/version.js'
import { healthRouter } from './routes/health.js'
import { bugReportsRouter } from './routes/bugReports.js'
import { soundboardRouter } from './routes/soundboard.js'
import { webrtcRouter } from './routes/webrtc.js'
import { gifsRouter } from './routes/gifs.js'
import { registerChatHandlers } from './socket/chat.js'
import { registerVoiceHandlers } from './socket/voice.js'
import { registerCallHandlers } from './socket/calls.js'

const PORT = Number(process.env.PORT) || 3000
console.log(`[boot] starting nepsis backend PORT=${PORT} NODE_ENV=${process.env.NODE_ENV || ''}`)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const httpServer = createServer(app)

// CORS: allow env-configured origins. CORS_ORIGINS=* or empty = allow all.
// Use explicit middleware so headers are always set (avoids cors package quirks).
const rawOrigins = (process.env.CORS_ORIGINS || '').trim()
const allowAll = rawOrigins === '*' || rawOrigins === ''
const allowedOrigins = allowAll
  ? null // null = allow any origin
  : ['http://localhost:5173', 'http://127.0.0.1:5173',
     'https://nepsischat.vercel.app', 'https://nepsis-chat.vercel.app',
     ...rawOrigins.split(',').map((o) => o.trim()).filter(Boolean)]

function setCorsHeaders(req, res) {
  const origin = req.headers.origin
  const allowed = allowAll
    ? (origin || '*')
    : (origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0])
  res.setHeader('Access-Control-Allow-Origin', allowed)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (allowed !== '*') res.setHeader('Access-Control-Allow-Credentials', 'true')
}

app.use((req, res, next) => {
  setCorsHeaders(req, res)
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

const io = new Server(httpServer, {
  cors: {
    origin: allowAll ? true : allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Longer timeouts to reduce spurious disconnects
  pingTimeout: 30000,
  pingInterval: 25000,
  // Allow EIO3 clients for broader compatibility
  allowEIO3: true,
})
app.use(express.json())

// Root health (Railway healthcheck) — registered before API routers
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    supabaseConfigured: isSupabaseConfigured,
    port: PORT,
  })
})

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
app.use('/api/health', healthRouter)
app.use('/api/bug-reports', bugReportsRouter)
app.use('/api/soundboard', soundboardRouter)
app.use('/api/webrtc', webrtcRouter)
app.use('/api/gifs', gifsRouter)

// 404 — ensure CORS headers on unknown routes
app.use((req, res) => {
  setCorsHeaders(req, res)
  res.status(404).json({ error: 'Not found' })
})

// Global error handler — ensure CORS headers on all error responses
app.use((err, req, res, next) => {
  setCorsHeaders(req, res)
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

// Updates are on GitHub Releases — backend serves API and Socket.io

const chatNamespace = io.of('/chat')
const voiceNamespace = io.of('/voice')
const callsNamespace = io.of('/calls')

app.set('voiceNamespace', voiceNamespace)

registerChatHandlers(chatNamespace)
registerVoiceHandlers(voiceNamespace)
registerCallHandlers(callsNamespace)

// Bind 0.0.0.0 so Railway/Docker proxies can reach the process
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
})

httpServer.on('error', (err) => {
  console.error('[boot] listen failed:', err)
  process.exit(1)
})
