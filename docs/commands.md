# Commands Reference

All npm scripts and CLI commands for Nepsis Chat.

---

## Root (`package.json`)

| Command | Description |
|---------|-------------|
| `npm run dev:backend` | Start backend dev server |
| `npm run dev:frontend` | Start frontend dev server |
| `npm run build:frontend` | Build frontend for production |
| `npm run start:backend` | Start backend (no watch) |
| `npm run electron` | Run Electron desktop app |
| `npm run package` | Build Electron installer (from electron/) |

---

## Backend (`backend/`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with `--watch` (restarts on file change) |
| `npm start` | Start server (no watch) |

**Default port:** 3000

---

## Frontend (`frontend/`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | TypeScript check + Vite build |
| `npm run preview` | Preview production build |

**Default port:** 5173

**Env:** `VITE_API_URL` — API base URL (e.g. `http://localhost:3000/api`)

---

## Electron (`electron/`)

| Command | Description |
|---------|-------------|
| `npm start` | Run Electron (loads `APP_URL`) |
| `npm run build:frontend` | Build frontend before packaging |
| `npm run bump` | Bump patch version (0.0.1 → 0.0.2) |
| `npm run package` | Bump + build frontend + build installer |
| `npm run package:full` | package + publish-update + copy-exe + bump |
| `npm run publish-update` | Copy installer + latest.yml to `backend/updates/` |
| `npm run copy-exe` | Copy installer to `frontend/public/` |

**Env:**
- `APP_URL` — URL the app loads (default: `http://localhost:5173`)
- `UPDATE_URL` — Update server URL (default: `http://localhost:3000/updates`)
- `NODE_ENV=development` — Enables dev tools

---

## Typical Workflows

### Development
```powershell
# Terminal 1 (PowerShell: use ; not &&)
cd backend; npm run dev

# Terminal 2
cd frontend; npm run dev

# Optional: run as desktop app
cd electron; npm start
```

### Release a new version
```powershell
cd electron
npm run package:full
# Restart backend to serve new update files
```

### Manual steps (instead of package:full)
```powershell
cd electron
npm run package          # Build installer
npm run publish-update   # Copy to backend/updates/
npm run copy-exe         # Copy to frontend/public/
# Version auto-bumps at end of package:full
```

### Run the app after building

From project root:
```powershell
# Unpacked app (no install)
& ".\electron\dist\win-unpacked\Nepsis Chat.exe"

# Or run the installer (check electron/dist/ for the version)
& ".\electron\dist\Nepsis Chat Setup 0.0.3.exe"
```

From `electron` folder:
```powershell
& ".\dist\win-unpacked\Nepsis Chat.exe"
```

---

## Deployment

| Command | Description |
|---------|-------------|
| `fly deploy` | Build Docker image and deploy to Fly.io |
| `fly logs` | View live server logs |
| `fly status` | Check machine status |
| `fly ssh console` | SSH into the running machine |
| `fly ssh sftp get /data/data.sqlite` | Download database backup |

### First deploy
```bash
fly auth login
fly launch            # fly.toml already configured
fly volumes create nepsis_data --region ord --size 1
fly deploy
```
