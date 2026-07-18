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

## Railway (recommended for production API)

Deploy the Express + Socket.io backend so Vercel can reach it (fixes production “Load failed”).

### 1. Create the service

1. Go to [railway.app](https://railway.app/) → sign up (GitHub is easiest)
2. **New Project** → **Deploy from GitHub repo** → select `nepsis-chat`
3. After it appears, open the service → **Settings**:
   - **Root Directory:** `backend`
   - If using Docker: Dockerfile path is `Dockerfile` (inside `backend/`). Build context is `backend/` — do **not** use repo-root `COPY backend/...` paths.
   - **Start Command:** `npm start` (only if not using Dockerfile; Docker image already runs `node src/index.js`)
4. **Settings → Networking → Generate Domain** — leave Railway’s detected port (it injects `PORT`). Do **not** hardcode `PORT` in the Dockerfile. If you must pick: check deploy logs for `Server running on port …` and use that number.

You should get something like `https://nepsis-chat-production-xxxx.up.railway.app`.

### 2. Environment variables (Railway → Variables)

**Required** — without these the old build exited immediately and Railway showed **502**:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | `https://qeopqyquskszzgprghiy.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase **service_role** key (Dashboard → Settings → API) |
| `CORS_ORIGINS` | `https://nepsischat.vercel.app` (or `*` while testing) |
| `PORT` | Leave unset — Railway injects `PORT` |

Redeploy after saving variables. `backend/railway.toml` uses **Nixpacks** + `npm start` (not Docker) so `PORT` wiring stays simple.

### 3. Smoke-test the API

Open in a browser:

1. `https://YOUR_RAILWAY_DOMAIN/api/health` → `{"ok":true,"supabaseConfigured":true,…}`
2. `https://YOUR_RAILWAY_DOMAIN/api/version` → `{"version":"…"}`

If you get **502 Application failed to respond**, the Node process is not listening (crash/wrong port). Check **Deploy Logs** for `Server running on port` or `[supabase] Missing…`.

### 4. Point Vercel at Railway

Vercel → Project → **Settings → Environment Variables**:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://YOUR_RAILWAY_DOMAIN/api` |
| `VITE_SUPABASE_URL` | `https://qeopqyquskszzgprghiy.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | same anon key |

Then **Deployments → … → Redeploy** (required — `VITE_*` is baked at build time).

Sign-in on the live site should work after that.

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
| Project URL | `https://qeopqyquskszzgprghiy.supabase.co` |
| Project ref | `qeopqyquskszzgprghiy` |
| Dashboard | `https://supabase.com/dashboard/project/qeopqyquskszzgprghiy` |
| MCP (scoped) | `https://mcp.supabase.com/mcp?project_ref=qeopqyquskszzgprghiy` |
| MCP Connect UI | [Dashboard → Connect → MCP](https://supabase.com/dashboard/project/qeopqyquskszzgprghiy?showConnect=true&connectTab=mcp) — copy Cursor config from there; auth is triggered inside Cursor, not by opening the MCP URL alone |
| Database | Postgres — **configured** (19 migrations applied; 21 public tables; seed demo servers) |
| Storage | Public bucket `attachments` (50MB) with public SELECT policy |
| Auth | Email/password sign up + sign in |

### Env wiring

| File | Status |
|------|--------|
| `frontend/.env.production` | URL + anon key for project `qeopqyquskszzgprghiy` |
| `frontend/.env.local` | Same (gitignored) for local Vite |
| `backend/.env.example` | Template with project URL |
| `backend/.env` | URL + anon set; **paste `SUPABASE_SERVICE_ROLE_KEY`** from Dashboard → API (gitignored) |
| Vercel | Set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` to the new project values |

### Auth flow

- **Guest**: Username only → creates a row in `users` with `is_guest=true`, no Supabase Auth
- **Email**: Supabase Auth handles sign up/sign in → backend links `auth.users.id` to `users.auth_id`

### Migration

Base schema: `backend/supabase-migration.sql`. Incrementals: `supabase/migrations/`. Fresh project was bootstrapped via Supabase MCP (`apply_migration` × 19).

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
| `VITE_API_URL` | Your **public** backend API URL (e.g. `https://api.yourdomain.com/api`). **Not** `localhost`. **Not** `nepsis-chat.fly.dev` (Fly removed). |
| `VITE_SUPABASE_URL` | `https://qeopqyquskszzgprghiy.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Anon key from that Supabase project |

After changing env vars, trigger a **Redeploy** (Vercel bakes `VITE_*` at build time).

If sign-in shows **“Load failed”**, the site cannot reach the API — almost always a stale/wrong `VITE_API_URL`.

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
| `VITE_SUPABASE_URL` | (from `.env.local`) | `https://qeopqyquskszzgprghiy.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | (from `.env.local`) | (paste from new project API settings into `.env.production` / Vercel) |
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
