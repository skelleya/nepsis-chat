# Frontend

React + Vite + TypeScript + Tailwind CSS.

---

## Branding — Logo

The Nepsis logo is used everywhere:

| File | Used in |
|------|---------|
| public/logo.png | ServerBar, ChannelList, LoginPage, DownloadPage |
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
├── pages/                LoginPage, DownloadPage
├── data/                 mockData
└── types/                TypeScript
```

---

## Components

| Component | Purpose |
|-----------|---------|
| ServerBar | Server list (left sidebar) |
| ChannelList | Text + voice channels |
| ChatView | Messages, input |
| VoiceView | Voice participants, join/leave |
| MembersSidebar | Online members |
| RemoteAudio | Plays remote WebRTC stream |
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
| signaling.ts | BroadcastChannel (2-tab test) |
| socketSignaling.ts | Socket.io (with backend) |
| webrtc.ts | WebRTC peer connections |

---

## State

- **AppContext** — user, servers, channels, messages
- No Redux/Zustand; useState in components

---

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| VITE_API_URL | — | API base (e.g. `http://localhost:3000/api`) |

When `VITE_API_URL` is set, voice uses Socket.io instead of BroadcastChannel.
