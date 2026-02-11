# Nepsis Chat

A web application with WebRTC voice chat using Opus audio codec.

## Quick Start

### Development

1. **Backend** (Terminal 1):
   ```powershell
   cd backend; npm run dev
   ```

2. **Frontend** (Terminal 2):
   ```powershell
   cd frontend; npm run dev
   ```

3. Open http://localhost:5173

4. **Voice test**: Open two browser tabs, log in with different usernames, join the same voice channel in both, and speak—audio should stream between tabs.

### Desktop App

1. Build frontend: `cd frontend && npm run build`
2. Run Electron: `cd electron && npm start`
3. Set `APP_URL` env to your backend URL if needed (default: http://localhost:5173)

### Packaging (Windows exe)

```bash
cd electron
npm run package:full
```

This builds the NSIS installer, publishes it to `backend/updates/` for auto-updates, and copies it to `frontend/public/` for the download page. The version auto-bumps after each release (starts at 0.0.1).

- **Installer**: `Nepsis Chat Setup 1.0.0.exe` – installs the app to Program Files
- **Auto-updates**: When you push a new version, run `npm run package:full`, then `npm run publish-update` to update `backend/updates/`. Users with the desktop app will see a green **Update Available** button (top right)
- **Download page**: Serves `NepsisChat-Setup.exe` from `/download`

**Production**: Edit `electron/package.json` → `build.publish.url` to your server (e.g. `https://api.yoursite.com/updates`). Upload `Nepsis Chat Setup X.X.X.exe` and `latest.yml` to that URL.

## Structure

- `frontend/` - React + Vite + Tailwind + WebRTC
- `backend/` - Node.js + Express + Socket.io + SQLite
- `electron/` - Desktop app wrapper
- `docs/` - WIKI (see [docs/WIKI.md](docs/WIKI.md) for full index)

## Voice Architecture

- **WebRTC** mesh (P2P) for 2-4 users per voice channel
- **Opus** codec (browser default for WebRTC)
- **Signaling**: BroadcastChannel (2-tab test) or Socket.io (with backend)
