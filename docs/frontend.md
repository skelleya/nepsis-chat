# Frontend

React + Vite + TypeScript + Tailwind CSS.

---

## Branding — Logo

The Nepsis logo is used everywhere:

| File | Used in |
|------|---------|
| public/logo.png | ServerBar, ChannelList, LoginPage, DownloadPage; ServerBar logo opens Friends page |
| public/favicon.png | Browser tab / Electron window favicon |

Both are the same Nepsis logo asset. For dark themes, the logo (dark text on black) is visible; on light backgrounds it may be subtle.

---

## Structure

```
frontend/src/
├── App.tsx              Main app, routes
├── main.tsx             Entry
├── index.css            Tailwind
├── components/          UI components
├── hooks/                React hooks
├── services/             API, signaling, WebRTC
├── contexts/             AppContext
├── pages/                LoginPage, DownloadPage, FriendsPage, CommunityPage, InvitePage
├── data/                 mockData
└── types/                TypeScript
```

---

## Components

| Component | Purpose |
|-----------|---------|
| VoiceIcons | Shared mic/mic-off/headphones/headphones-off SVGs (prevents clipping/snipping) |
| ServerBar | Server list (left sidebar) |
| ChannelList | Text + voice channels |
| ChatView | Messages, input |
| VoiceView | Voice participants, join/leave |
| MembersSidebar | Online members |
| RemoteAudio | Plays remote WebRTC stream |
| CallOverlay | DM call UI: outgoing/incoming/in-call states |
| FriendsPage | Friends list and friend requests; opened by clicking Nepsis logo |
| UpdateButton | Green update (Electron only) |
| LoginPage | Username login |

---

## Hooks

| Hook | Purpose |
|------|---------|
| useVoiceChannel | WebRTC voice state, join/leave |
| useDesktopUpdate | Update button state (Electron) |

---

## Services

| Service | Purpose |
|---------|---------|
| api.ts | REST (login, servers, channels, messages) |
| layoutCache.ts | localStorage cache for channels + categories per server; instant preview on switch |
| signaling.ts | BroadcastChannel (2-tab test) |
| socketSignaling.ts | Socket.io (with backend) |
| webrtc.ts | WebRTC peer connections |
| sounds.ts | Web Audio API notification/call sounds (no external files) |

---

## Layout Cache

Channels and categories are cached in `localStorage` (`nepsis_layout_cache`) so:

1. **Instant preview** — When switching servers, cached layout shows immediately.
2. **Background refresh** — When the tab becomes visible, all servers' layouts refresh in background.
3. **Preload** — Other servers' layouts are fetched in background when viewing one server.
4. **Mutations** — Create/reorder/delete channel or category updates cache.

Cache is cleared on logout. See `frontend/src/services/layoutCache.ts`.

---

## State

- **AppContext** — user, servers, channels, messages
- **VoiceContext** — voice channel state, WebRTC, participants, speaking detection
- **CallContext** — private DM calls, WebRTC 1-on-1, call state machine
- No Redux/Zustand; useState in components

---

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| VITE_API_URL | — | API base (e.g. `http://localhost:3000/api`) |

When `VITE_API_URL` is set, voice uses Socket.io instead of BroadcastChannel.
