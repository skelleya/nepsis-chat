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
| 3 | Backend — Node.js, Express, Socket.io, SQLite |
| 4 | Integration — API, Socket.io signaling |
| 5 | Desktop app — Electron, NSIS installer, download page |
| + | Versioning 0.0.1, auto-updates, green update button |
| + | Branding — Nepsis logo (favicon, app icon, installer, all UI) |
| + | System tray — Close window hides to tray; right-click tray to Show/Quit |
| + | Deployment — Fly.io, GitHub, Docker, env-based config |
