# Project Structure

File layout and architecture.

---

## Top-Level

```
e:\Nepsis Chat\
├── frontend/       React + Vite + Tailwind
├── backend/        Node.js + Express + Socket.io
├── electron/       Desktop app (Electron)
├── docs/           Documentation (this WIKI)
├── package.json    Root scripts
└── README.md
```

---

## Frontend (`frontend/`)

| Path | Purpose |
|------|---------|
| `src/App.tsx` | Main app, routes, layout |
| `src/main.tsx` | React entry |
| `src/components/` | UI components |
| `src/hooks/` | React hooks |
| `src/services/` | API, signaling, WebRTC |
| `src/contexts/` | AppContext |
| `src/pages/` | LoginPage, DownloadPage |
| `src/data/` | mockData |
| `src/types/` | TypeScript interfaces |
| `public/` | Static assets: logo.png, favicon.png, NepsisChat-Setup.exe |

### Components

- **ServerBar** — Server list (left)
- **ChannelList** — Text/voice channels
- **ChatView** — Text channel + messages
- **VoiceView** — Voice channel + participants
- **MembersSidebar** — Online members
- **RemoteAudio** — Plays remote WebRTC audio
- **UpdateButton** — Green update button (Electron only)
- **LoginPage** — Username login

### Services

- **api.ts** — REST API client
- **signaling.ts** — BroadcastChannel signaling (2-tab test)
- **socketSignaling.ts** — Socket.io signaling (with backend)
- **webrtc.ts** — WebRTC client
- **chatSocket.ts** — Chat Socket.io (optional)

---

## Backend (`backend/`)

| Path | Purpose |
|------|---------|
| `src/index.js` | Express server, Socket.io |
| `src/db/init.js` | SQLite schema + seed |
| `src/routes/` | REST routes |
| `src/socket/` | Socket.io handlers |
| `data.sqlite` | Database file |
| `updates/` | Update files (installer, latest.yml) |

### Routes

- `auth.js` — login, users
- `servers.js` — servers, channels
- `messages.js` — messages
- `version.js` — app version

### Socket namespaces

- `/chat` — chat, typing
- `/voice` — WebRTC signaling

---

## Electron (`electron/`)

| Path | Purpose |
|------|---------|
| `main.js` | Main process, autoUpdater |
| `icon.png` | Nepsis logo — app icon (window, tray, installer, desktop shortcut) |
| `preload.js` | Exposes electronAPI to renderer |
| `scripts/bump-version.js` | Version bump |
| `scripts/publish-update.js` | Copy to backend/updates |
| `dist/` | Build output |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| Voice | WebRTC, Opus (default) |
| Real-time | Socket.io |
| Backend | Node.js, Express |
| Database | SQLite (better-sqlite3) |
| Desktop | Electron, electron-updater |
| Packaging | electron-builder (NSIS) |
