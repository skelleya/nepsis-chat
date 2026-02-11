# Deployment

Split deployment: **Vercel** (frontend) + **Fly.io** (backend). Supabase for DB.

---

## Architecture (split)

```
User (browser)    → https://nepsis-chat.vercel.app   (Vercel — frontend only)
User (Electron)   → loads from Vercel or local

Both connect to:
   https://nepsis-chat.fly.dev   (Fly.io — backend)
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

## Full deploy (backend or desktop release)

```bash
# Backend only (no Electron)
npm run deploy

# Full release (includes desktop installer)
npm run release
```

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
| `VITE_API_URL` | `https://nepsis-chat.fly.dev/api` |
| `VITE_SUPABASE_URL` | (from Supabase) |
| `VITE_SUPABASE_ANON_KEY` | (from Supabase) |

### Deploy

Push to GitHub — Vercel auto-deploys. ~1 min.

### First-time setup

1. Go to [vercel.com](https://vercel.com) → New Project → Import your GitHub repo
2. Set **Root Directory** to `frontend` (required for monorepo)
3. Add env vars: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
4. Deploy

---

## Fly.io (backend)

| Item | Value |
|------|-------|
| App name | `nepsis-chat` |
| URL | `https://nepsis-chat.fly.dev` |
| Region | `ord` (Chicago) |
| Internal port | 8080 |

### Deploy (~50MB)

Build context is **backend only** (`fly.toml` uses `context = "backend"`). Updates are on GitHub Releases — Fly only deploys API + Socket.io.

```bash
npm run deploy   # flyctl deploy
```

**Desktop release** (publish installer to GitHub):

```bash
npm run release   # electron-builder --win -p always (uploads to GitHub Releases)
```

Requires `GH_TOKEN` env with `repo` scope. The download page links to `https://github.com/skelleya/nepsis-chat/releases/latest/download/NepsisChat-Setup.exe`.

### Logs and status

```bash
flyctl logs --app nepsis-chat --no-tail
flyctl status --app nepsis-chat
```

### Secrets (set via `flyctl secrets set`)

| Secret | Purpose |
|--------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (private) |

---

## Docker (backend only)

The `backend/Dockerfile` is used with `context = "backend"` — Fly only uploads the backend folder (~50MB + latest installer if present). Electron and frontend are never sent.

After deploying, free disk space with:

```bash
docker system prune -a -f
```

---

## Environment Variables

### Backend (runtime — set via Fly.io secrets or `backend/.env`)

| Variable | Purpose |
|----------|---------|
| `PORT` | Server port (default 8080) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `CORS_ORIGINS` | Allowed origins (default `*`) |

### Frontend (build-time)

| Variable | Dev | Production |
|----------|-----|------------|
| `VITE_API_URL` | `http://localhost:3000/api` | `https://nepsis-chat.fly.dev/api` |
| `VITE_SUPABASE_URL` | (from `.env.local`) | `https://opkatioqcmamnwmvqdtq.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | (from `.env.local`) | (in `.env.production`) |

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
