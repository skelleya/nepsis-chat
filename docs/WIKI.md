# Nepsis Chat — WIKI

Main documentation index. Nepsis Chat is a WebRTC voice chat application (Opus codec).

---

## Contents

| Page | Description |
|------|-------------|
| [Commands](commands.md) | All npm scripts and CLI commands |
| [Project Structure](project-structure.md) | File layout, architecture, and tech stack |
| [Backend](backend.md) | API, database, Socket.io |
| [Frontend](frontend.md) | Components, hooks, services |
| [Electron & Desktop App](electron.md) | Desktop app, installer, packaging |
| [WebRTC & Voice](webrtc-voice.md) | Voice channels, signaling, Opus |
| [Versioning & Updates](versioning-updates.md) | Versioning, auto-updates, release flow |
| [Deployment](deployment.md) | Fly.io, Docker, GitHub |
| [Errors & Solutions](errors-solutions.md) | Known issues and fixes |

---

## Quick Reference

| Task | Command |
|------|---------|
| Start backend | `npm run dev:backend` |
| Start frontend | `npm run dev:frontend` |
| Run desktop app | `npm run electron` |
| Full release build | `npm run package:full` |
| Deploy to Fly.io | `npm run deploy` |
| **Release everything** | **`npm run release`** |

---

## Creation Timeline

| Phase | What |
|-------|------|
| 1 | Frontend foundation — React, Vite, Tailwind, chat UI |
| 2 | WebRTC voice — getUserMedia, mesh P2P, BroadcastChannel signaling |
| 3 | Backend — Node.js, Express, Socket.io, SQLite → Supabase Postgres |
| 4 | Integration — API, Socket.io signaling |
| 5 | Desktop app — Electron, NSIS installer, download page |
| + | Versioning 0.0.1, auto-updates, green update button |
| + | Branding — Nepsis logo, bright orange (#FF6600), all locations consistent |
| + | System tray — Close window hides to tray; right-click tray to Show/Quit |
| + | Deployment — Fly.io, GitHub, Docker, env-based config |
| + | Supabase migration — Postgres DB + email auth (guest + email login) |

---

## Logo / Branding

The Nepsis logo is **bright orange** (#FF6600) on a white background, in a square format with stylized "NEPSIS" text.

| File | Size | Purpose |
|------|------|---------|
| `electron/icon.png` | 1024x1024 | **Master logo** — Electron app icon (window, tray, installer, taskbar) |
| `frontend/public/logo.png` | 1024x1024 | UI logo (LoginPage, ServerBar, ChannelList, DownloadPage) |
| `frontend/public/favicon.png` | 32x32 | Browser tab favicon |

**To update the logo:**
1. Replace `electron/icon.png` with the new logo (keep >=256x256 for Windows)
2. Copy the same file to `frontend/public/logo.png`
3. Resize to 32x32 and save as `frontend/public/favicon.png`
4. Rebuild: `npm run package:full`

All three files must stay in sync and use the same bright orange color.
