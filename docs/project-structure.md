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

- **ServerBar** — Server list (left sidebar), server icon tooltips, + button for creating servers, discover button
- **ChannelList** — Text/voice channels organized by categories, collapsible sections, create channel button per category, server dropdown menu (create channel, create category, server settings), voice connection bar (when in voice shows channel name, disconnect, camera, screen share)
- **ChatView** — Text channel + messages
- **VoiceView** — Voice channel + participants, camera/screen share video grid, mute/deafen/camera/screenshare/disconnect controls
- **MembersSidebar** — Online members
- **UserPanel** — Bottom-left user panel: avatar, username, status, mute button, deafen button, settings gear (opens UserSettingsModal)
- **CreateServerModal** — Modal for creating a new server (name input, icon placeholder)
- **CreateChannelModal** — Modal for creating a new channel (type selection: text/voice, name input)
- **ServerSettingsModal** — Full-screen server settings: rename, delete server, navigation sidebar
- **UserSettingsModal** — Full-screen user settings: account info, avatar, logout, navigation sidebar
- **RemoteAudio** — Plays remote WebRTC audio
- **UpdateButton** — Green update button (Electron only)
- **LoginPage** — Username login

### Contexts

- **AppContext** — Global app state: user, servers, channels, categories, messages, CRUD operations for servers/channels/categories
- **VoiceContext** — Global voice state: current voice channel, mute/deafen, camera/screen share, participants, join/leave/toggle controls

### Services

- **api.ts** — REST API client (auth, servers, channels, categories, messages — full CRUD)
- **layoutCache.ts** — Client-side cache for server layout (channels + categories), localStorage, instant preview on server switch
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
