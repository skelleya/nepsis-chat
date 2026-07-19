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
| `npm run electron` | Run Electron desktop app (dev) |
| `npm run package:win` | Build Windows NSIS installer |
| `npm run package:mac` | Build macOS DMG/ZIP (**run on a Mac**) |
| `npm run package:all` | Build Win + Mac |
| `npm run release` | Publish Win+Mac to GitHub Releases (`GH_TOKEN`) |
| `npm run release:win` | Publish Windows only |
| `npm run release:mac` | Publish macOS only |

---

## Backend (`backend/`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with `--watch` |
| `npm start` | Start server |

**Default port:** 3000

---

## Frontend (`frontend/`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production web build |
| `npm run build -- --mode desktop` | Desktop bundle (uses `.env.desktop`) |

---

## Electron (`electron/`)

| Command | Description |
|---------|-------------|
| `npm start` | Run Electron (loads Vite `APP_URL`) |
| `npm run build:frontend` | Build frontend with `--mode desktop` |
| `npm run package:win` | Windows installer → `electron/dist/` |
| `npm run package:mac` | macOS DMG + ZIP |
| `npm run publish:github` | Build Win+Mac and upload to GitHub Releases |
| `npm run bump` | Bump patch version |

**Updates:** GitHub Releases via `electron-updater`. Top Nepsis badge in the app when a new version is available.

**Env:**
- `GH_TOKEN` — required to publish
- `APP_URL` — dev load URL (default `http://localhost:5173`)
- Desktop API keys — `frontend/.env.desktop`

---

## Typical Workflows

### Development
```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev

# Optional desktop shell
cd electron && npm start
```

### Ship a desktop release
```bash
# Set GH_TOKEN with repo release permissions
export GH_TOKEN=ghp_...

# Windows machine (or CI windows-latest):
npm run release:win

# Mac machine (or CI macos-latest):
npm run release:mac

# Or both from a Mac with Wine not required for --mac only:
npm run release:mac
```

After publish, installed apps show the **update badge** at the top when `latest.yml` / `latest-mac.yml` advertise a newer version.
