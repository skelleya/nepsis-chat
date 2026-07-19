# Project Structure

Nepsis Chat — Discord-like voice/video chat (web + Electron).

---

## Top level

| Path | Purpose |
|------|---------|
| `frontend/` | React + Vite + TypeScript + Tailwind app |
| `backend/` | Node.js + Express + Socket.io API |
| `electron/` | Desktop shell (Electron + auto-update) |
| `supabase/` | Postgres migrations + config |
| `docs/` | WIKI, domain docs, errors & solutions |
| `scripts/` | Ops helpers (clean-disk, clean-updates) |

---

## Frontend (`frontend/`)

| Path | Purpose |
|------|---------|
| `src/App.tsx` | Auth gate, main layout, mobile nav, view routing |
| `src/main.tsx` | Entry, HashRouter, appearance prefs boot |
| `src/index.css` | Tailwind + CSS tokens (`--app-*`, landing) |
| `src/components/` | UI (chat, voice, settings, landing, modals) |
| `src/contexts/` | AppContext, VoiceContext, CallContext |
| `src/services/` | API, WebRTC, signaling, prefs, blocked users |
| `src/hooks/` | Voice, desktop update, GSAP menu helper |
| `src/pages/` | Download, Invite, Friends, Community, Onboarding |
| `public/` | Logo, favicon, optional installer assets |

---

## Backend (`backend/`)

| Path | Purpose |
|------|---------|
| `src/index.js` | Express server, Socket.io, CORS |
| `src/db/supabase.js` | Supabase service client |
| `src/db/init.js` | Legacy SQLite helper (unused; DB is Supabase) |
| `src/routes/` | REST routes (auth, servers, messages, DM, friends, …) |
| `src/socket/` | `/chat`, `/voice`, `/calls` namespaces |
| `updates/` | Optional local update files (prefer GitHub Releases) |

### Socket namespaces

- `/chat` — chat, typing
- `/voice` — WebRTC signaling, screen-share, voice-state (mute/deafen)
- `/calls` — DM 1:1 calls

---

## Electron (`electron/`)

| Path | Purpose |
|------|---------|
| `main.js` | Main process, autoUpdater, tray |
| `preload.js` | Exposes `electronAPI` to renderer |
| `scripts/` | bump-version, publish-update, copy-exe |
| `dist/` | Build output |

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite 7, TypeScript, Tailwind 3, GSAP |
| Voice / calls | WebRTC mesh, Socket.io signaling, STUN + optional TURN |
| Real-time | Socket.io + Supabase Realtime |
| Backend | Node.js, Express |
| Database / Auth / Storage | Supabase (Postgres, Auth, Storage) |
| Desktop | Electron 33, electron-builder, electron-updater |
| Deploy | Frontend → Vercel; backend → Railway/VPS; desktop → GitHub Releases |

---

## Related docs

- [WIKI](WIKI.md) — index + changelog
- [Frontend](frontend.md) — components & GSAP
- [Backend](backend.md) — API & sockets
- [WebRTC / Voice](webrtc-voice.md) — mesh, ICE, screen share
- [Errors & Solutions](errors-solutions.md) — known issues and fixes
- [Deployment](deployment.md) — env & hosting
