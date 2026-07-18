# Deployment

Split deployment: **Vercel** (frontend) + **Self-hosted** (backend). Supabase for DB.

---

## Architecture (split)

```
User (browser)    → https://nepsis-chat.vercel.app   (Vercel — frontend only)
User (Electron)   → loads from Vercel or bundled

Both connect to:
   YOUR_BACKEND_URL   (self-hosted — backend)
                   ├─ /api/*       → Express API (data from Supabase Postgres)
                   ├─ (updates on GitHub Releases)
                   └─ /socket.io   → Socket.io (chat + voice signaling)

Supabase (external)
   ├─ Postgres      → All app data (users, servers, channels, messages)
   └─ Auth          → Email sign up / sign in
```

---

## Quick deploy (frontend changes only)

```bash
git push   # Vercel auto-deploys from GitHub — ~1 min
```

---

## Self-hosted backend

Run the backend on your own server (VPS, home server, etc.).

### Option 1: Node.js directly

```bash
cd backend
# Create .env with: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CORS_ORIGINS (optional, default *)
npm install
npm start
```

Default port: 3000. Use `PORT=8080` to override.

### Option 2: Docker

```bash
# From project root (build context: backend folder)
docker build -f backend/Dockerfile -t nepsis-backend backend
docker run -p 3000:8080 \
  -e SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
  -e SUPABASE_SERVICE_ROLE_KEY=your_service_role_key \
  -e CORS_ORIGINS='*' \
  nepsis-backend
```

Or use the root `Dockerfile`:

```bash
docker build -t nepsis-backend .
docker run -p 3000:8080 \
  -e SUPABASE_URL=... \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  -e CORS_ORIGINS='*' \
  nepsis-backend
```

### Environment variables (backend)

| Variable | Purpose |
|----------|---------|
| `PORT` | Server port (default 8080 in Docker, 3000 in Node) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `CORS_ORIGINS` | Allowed origins (default `*` for all) |
| `DATA_DIR` | Optional: persistent data directory (for SQLite if used) |

### Building frontend for your backend

Set `VITE_API_URL` to your backend URL when building:

```bash
cd frontend
VITE_API_URL=https://your-server.com/api npm run build
```

For Vercel: set `VITE_API_URL` in the Vercel dashboard to your backend URL.

---

## Supabase

| Item | Value |
|------|-------|
| Project URL | `https://opkatioqcmamnwmvqdtq.supabase.co` |
| Dashboard | `https://supabase.com/dashboard/project/opkatioqcmamnwmvqdtq` |
| Database | Postgres (tables: users, servers, channels, messages, dm_*) |
| Auth | Email/password sign up + sign in |

### Tables

| Table | Purpose |
|-------|---------|
| `users` | All users — guests (`is_guest=true`) and email accounts (`auth_id` links to Supabase Auth) |
| `servers` | Chat servers |
| `channels` | Text and voice channels per server |
| `messages` | Chat messages |
| `dm_conversations` | DM threads |
| `dm_participants` | DM participants |
| `dm_messages` | DM messages |

### Auth flow

- **Guest**: Username only → creates a row in `users` with `is_guest=true`, no Supabase Auth
- **Email**: Supabase Auth handles sign up/sign in → backend links `auth.users.id` to `users.auth_id`

### Migration

Schema is in `backend/supabase-migration.sql`. Run it in the Supabase SQL Editor to create/reset tables.

---

## Vercel (frontend)

| Item | Value |
|------|-------|
| Project | Connect repo to Vercel |
| Root | Set **Root Directory** to `frontend` |
| Build | Auto (uses `frontend/vercel.json`) |

### Env vars (set in Vercel dashboard)

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | Your backend API URL (e.g. `https://your-server.com/api`) |
| `VITE_SUPABASE_URL` | (from Supabase) |
| `VITE_SUPABASE_ANON_KEY` | (from Supabase) |

### Deploy

Push to GitHub — Vercel auto-deploys. ~1 min.

---

## Docker (backend only)

The `backend/Dockerfile` builds the backend. Use `context = "backend"` or build from root with the root Dockerfile.

---

## Environment Variables

### Backend (runtime — set via `backend/.env` or Docker `-e`)

| Variable | Purpose |
|----------|---------|
| `PORT` | Server port (default 8080 in Docker, 3000 in Node) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `CORS_ORIGINS` | Allowed origins (default `*`) |
| `TURN_URLS` | Optional comma-separated TURN URLs for P2P voice/calls |
| `TURN_USERNAME` | TURN username |
| `TURN_CREDENTIAL` | TURN password |

### Frontend (build-time)

| Variable | Dev | Production |
|----------|-----|------------|
| `VITE_API_URL` | `http://localhost:3000/api` | Your backend URL (e.g. `https://your-server.com/api`) |
| `VITE_SUPABASE_URL` | (from `.env.local`) | `https://opkatioqcmamnwmvqdtq.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | (from `.env.local`) | (in `.env.production`) |
| `VITE_TURN_*` | — | Optional TURN fallback; prefer backend `TURN_*` + `/api/webrtc/ice` |

### Electron

| Variable | Default | Purpose |
|----------|---------|---------|
| `UPDATE_URL` | GitHub Releases (skelleya/nepsis-chat) | Auto-update feed |
| `APP_URL` | `http://localhost:5173` | Dev-mode URL to load |

---

## Secret files (NEVER commit)

| File | Contains |
|------|----------|
| `backend/.env` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| `frontend/.env.local` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| `Nepsis Chat DB.txt` | DB password, service role key |

All are in `.gitignore`.
