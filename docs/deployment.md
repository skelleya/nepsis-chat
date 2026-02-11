# Deployment

Fly.io deployment, Supabase, Docker, and environment config.

---

## Architecture

```
User/Electron → https://nepsis-chat.fly.dev
                   ├─ /api/*       → Express API (data from Supabase Postgres)
                   ├─ /updates/*   → Electron update files
                   ├─ /socket.io   → Socket.io (chat + voice signaling)
                   └─ /*           → Frontend static files (React SPA)

Supabase (external)
   ├─ Postgres      → All app data (users, servers, channels, messages)
   └─ Auth          → Email sign up / sign in
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

## Fly.io

| Item | Value |
|------|-------|
| App name | `nepsis-chat` |
| URL | `https://nepsis-chat.fly.dev` |
| Region | `ord` (Chicago) |
| Internal port | 8080 |

### Deploy

```bash
flyctl deploy --app nepsis-chat --local-only
```

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

## Docker

The `Dockerfile` is a multi-stage build:

1. **Stage 1** (`frontend-build`): Installs frontend deps, runs `npm run build`
2. **Stage 2** (`production`): Installs backend deps, copies backend source + built frontend into `backend/public/`

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
| `UPDATE_URL` | `https://nepsis-chat.fly.dev/updates` | Auto-update feed URL |
| `APP_URL` | `http://localhost:5173` | Dev-mode URL to load |

---

## Secret files (NEVER commit)

| File | Contains |
|------|----------|
| `backend/.env` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| `frontend/.env.local` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| `Nepsis Chat DB.txt` | DB password, service role key |

All are in `.gitignore`.
