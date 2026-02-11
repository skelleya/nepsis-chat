# Deployment

Fly.io deployment, Docker, and environment config.

---

## Architecture

In production the **backend serves everything** — API, Socket.io, and the frontend static files.

```
User/Electron → https://nepsis-chat.fly.dev
                   ├─ /api/*       → Express API
                   ├─ /updates/*   → Electron update files
                   ├─ /socket.io   → Socket.io (chat + voice signaling)
                   └─ /*           → Frontend static files (React SPA)
```

---

## Fly.io

| Item | Value |
|------|-------|
| App name | `nepsis-chat` |
| URL | `https://nepsis-chat.fly.dev` |
| Region | `ord` (Chicago) |
| Internal port | 8080 |
| Volume | `nepsis_data` mounted at `/data` (SQLite persistence) |

### First-time setup

```bash
# Install Fly CLI: https://fly.io/docs/flyctl/install/
fly auth login
fly launch          # Say no to modifications — fly.toml already exists
fly volumes create nepsis_data --region ord --size 1
fly deploy
```

### Subsequent deploys

```bash
fly deploy
```

### Logs and status

```bash
fly logs
fly status
fly ssh console     # SSH into the running machine
```

---

## Docker

The `Dockerfile` is a multi-stage build:

1. **Stage 1** (`frontend-build`): Installs frontend deps, runs `npm run build`
2. **Stage 2** (`production`): Installs backend deps, copies backend source + built frontend into `backend/public/`

### Build and run locally

```bash
docker build -t nepsis-chat .
docker run -p 8080:8080 -v nepsis_data:/data nepsis-chat
```

Then open `http://localhost:8080`.

---

## Environment Variables

### Backend (production)

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `8080` | Server port |
| `DATA_DIR` | `../` (relative to src) | Directory for `data.sqlite` — set to `/data` on Fly.io |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins |
| `NODE_ENV` | — | `production` on Fly.io |

### Frontend (build-time)

| Variable | Default (dev) | Production |
|----------|---------------|------------|
| `VITE_API_URL` | `http://localhost:3000/api` | `https://nepsis-chat.fly.dev/api` |

Configured in `frontend/.env.development` and `frontend/.env.production`.

### Electron

| Variable | Default | Purpose |
|----------|---------|---------|
| `UPDATE_URL` | `https://nepsis-chat.fly.dev/updates` | Auto-update feed URL |
| `APP_URL` | `http://localhost:5173` | Dev-mode URL to load |

---

## GitHub

Repository: push to GitHub, then Fly.io deploys from the Dockerfile.

```bash
git init
git add .
git commit -m "Initial commit"
gh repo create nepsis-chat --public --source=. --push
```

---

## SQLite on Fly.io

Fly.io machines have ephemeral filesystems. The `fly.toml` mounts a **persistent volume** at `/data`. The backend reads `DATA_DIR` and stores `data.sqlite` there.

- Volume survives deploys and machine restarts
- Volume is tied to a single machine (no multi-machine scaling with SQLite)
- To backup: `fly ssh sftp get /data/data.sqlite`
