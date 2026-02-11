# Errors & Solutions

Known issues and fixes.

---

## Server

| Error | Cause | Solution |
|-------|-------|----------|
| EADDRINUSE: address already in use :::3000 | Port 3000 in use | Kill process (see below) or use PORT=3001 |

### EADDRINUSE (port 3000 in use)

```powershell
netstat -ano | findstr :3000
taskkill /PID <pid> /F
```

Replace `<pid>` with the number from the last column. Or use a different port: `$env:PORT=3001; npm run dev` (PowerShell).

---

## Build & Tooling

| Error | Cause | Solution |
|-------|-------|----------|
| Tailwind PostCSS error | Tailwind v4 | Use Tailwind v3 |
| PowerShell `&&` invalid | PowerShell syntax | Use `;` instead of `&&` |
| npm ENOTEMPTY | Corrupt node_modules | Delete node_modules, run `npm install` |

---

## Download

| Error | Cause | Solution |
|-------|-------|----------|
| **"The file or directory is corrupted and unreadable"** when downloading installer | (1) Incomplete download — network interrupted or timeout. (2) Antivirus/Windows Defender quarantining or corrupting the exe. (3) Temp folder (scoped_dir) issue — Windows file system error. | Retry the download. Disable antivirus temporarily or add exception for the download URL. Try a different browser. If using Electron auto-update, ensure backend serves a valid exe and `latest.yml` has correct `path`. Run `npm run clean-updates` and `npm run release` so only one valid installer is served. |
| Downloaded file corrupt/unreadable | Link pointed to non-existent exe | Run `npm run package:full` (or `copy-exe`) before deploy so `frontend/public/NepsisChat-Setup.exe` exists. Also ensure `.dockerignore` allows the exe (see deployment.md) |
| Download link 404 / can't download exe | Exe excluded from Docker image or deploy without package:full | Deploy with `npm run release` (not just `npm run deploy`). |
| **White screen + "Cannot GET /updates/download"** | (1) Installer not in backend/updates; release script skipped publish-update. (2) Vercel missing `VITE_API_URL` — download link points to wrong host. | Run **`npm run release`** (not just `npm run deploy`). On Vercel, set `VITE_API_URL=https://nepsis-chat.fly.dev/api` so the download link points to the backend. |

---

## Electron

| Error | Cause | Solution |
|-------|-------|----------|
| Cannot create symbolic link (winCodeSign) | Windows symlink permissions | Set `signAndEditExecutable: false` |
| Update not detected | Wrong UPDATE_URL or missing files | Ensure `backend/updates/` has latest.yml and installer; backend must serve `/updates/` |
| Installer shows old text (e.g. old description) or wrong version | Using old build artifacts | Rebuild: `cd electron && npm run package:full` — installer reads from package.json |
| Grey screen + "Downloading" stuck | Update check found update but download hangs (e.g. unreachable localhost:3000) | UpdateButton now only shows when update is ready to install. Rebuild frontend; if dev mode, start frontend first (`cd frontend && npm run dev`) |

---

## WebRTC

| Error | Cause | Solution |
|-------|-------|----------|
| getUserMedia fails | Not HTTPS/localhost | Use localhost or HTTPS |
| No audio between peers | Firewall/NAT | Add TURN server for strict NAT |
| Users can't see/hear each other in voice (each sees only themselves) | **Two bugs**: (1) `handlePeerJoined` used `shouldInitiate` (socket ID comparison) — in socket mode, only existing peers get `peer-joined`, so if the existing peer's ID is larger, nobody initiates. (2) `handleOffer` never added local audio tracks to the peer connection — the answerer's audio was never included in the answer SDP, making them silent. | **Three fixes**: (1) In socket mode, `handlePeerJoined` ALWAYS initiates (no ID comparison needed — only existing peers receive the event). BroadcastChannel mode keeps the comparison to avoid glare. (2) `handleOffer` now adds `currentLocalStream` tracks before creating the answer. (3) Backend sends `room-peers` event to new joiners listing existing peers in the room. Files: `webrtc.ts`, `socketSignaling.ts`, `voice.js`. |
| Remote user shows as socket ID (e.g. `RYmOZK82...`) instead of username | Backend `voice.js` only forwarded `fromUserId` in offer/answer/ice-candidate events, NOT `fromUsername`. The `socketSignaling.ts` also didn't map `fromUsername` to the `username` field. The webrtc client fell back to peerId (the socket ID) when username was undefined. | Backend now sends `fromUsername: socket.username` in all signaling events. `socketSignaling.ts` maps it to `username`. `webrtc.ts` uses `updatePeerMeta` to update username on every message. Files: `voice.js`, `socketSignaling.ts`, `webrtc.ts`. |
| Camera/screen share not visible to remote users | Video/screen share streams were captured locally but never added to WebRTC peer connections. No renegotiation happened. | Added `addTrackToAllPeers` and `removeTrackFromAllPeers` to `webrtc.ts` which add/remove tracks and trigger SDP renegotiation. `VoiceContext.tsx` calls these when toggling camera/screen share. `handleOffer` now handles renegotiation offers for existing connections. |

---

## Installer / Desktop App

| Error | Cause | Solution |
|-------|-------|----------|
| App shows blank after install | Previously loaded from URL | Now bundles frontend; rebuild with `npm run package` |
| Grey screen when running `npm start` (electron) | Frontend dev server not running | Start frontend first: `cd frontend && npm run dev`, then `cd electron && npm start` |
| Desktop app still shows old Electron logo (taskbar) | Missing `app.setAppUserModelId()` on Windows. Without it, the taskbar groups the app with the generic `electron.exe` icon. Icon also wasn't loaded via `nativeImage`. | Fixed: Added `app.setAppUserModelId('com.nepsis.chat')` before `app.whenReady()`, switched to `nativeImage.createFromPath()` for icon loading, and added explicit `mainWindow.setIcon(icon)`. Now shows Nepsis icon in both dev and packaged modes. Clear Windows icon cache if stale: delete `%localappdata%\IconCache.db` and restart Explorer. |
|| Desktop app shows nothing / no servers or chats (packaged) | **CORS bug**: `CORS_ORIGINS=*` was split into `['*']` array — the `cors` package treats arrays as literal matches, not wildcards. All cross-origin requests from `file://` were silently blocked. Also no session persistence. | **Three fixes**: (1) Fixed backend CORS — `CORS_ORIGINS=*` now passes `true` to cors package (allow all). Custom handler also allows `null` origin for `file://`. (2) Packaged app now loads from production URL instead of `file://` — same-origin avoids CORS entirely. Falls back to `file://` if server unreachable. (3) Added localStorage session persistence in AppContext — user stays logged in across app restarts. |
| Invalid icon file (NSIS) | icon.png not a valid .ico | Remove icon config or use .ico file |
| Only find 0.0.1 when 0.0.3 exists | publish-update/copy-exe used first .exe found | Scripts now use latest.yml to pick the correct installer; run `npm run package:full` |
| Packaged app blank / routes broken / stuck on download page | `BrowserRouter` doesn't work with `file://` protocol. When Electron loads `index.html` via `loadFile`, the pathname is the full file path (not `/`), so no React Router route matches properly. | Switched from `BrowserRouter` to `HashRouter` in `main.tsx`. Hash routing (`/#/path`) works with any protocol including `file://`. Rebuild: `cd electron && npm run package:full`. |
| Images (logo, favicon) not loading in packaged app | Hardcoded absolute paths like `/logo.png` resolve to filesystem root under `file://` protocol. | Changed asset paths from `/logo.png` to `./logo.png` in components (LoginPage, DownloadPage). Relative paths resolve correctly from `index.html` location. Vite's `base: './'` handles built JS/CSS assets automatically. |

---

## Fly.io Deployment

| Error | Cause | Solution |
|-------|-------|----------|
| **Fly pushing 9+ GB** (should be ~100MB) | (1) Build context included `electron/` (~11GB) or `frontend/` (~2GB). (2) `backend/updates/` had 8+ GB of old installers. | **Fixed:** `fly.toml` now uses `context = "backend"` — only backend folder is sent. Run `npm run clean-updates` before deploy to remove old installers. Deploy script runs it automatically. |
| **This machine has exhausted its maximum restart attempts (10)** | App process exits immediately on startup; Fly.io retries until limit. | **Most likely: missing Supabase secrets.** Set secrets: `fly secrets set SUPABASE_URL=https://YOUR_PROJECT.supabase.co SUPABASE_SERVICE_ROLE_KEY=your_service_role_key` (replace with your values). Then `fly deploy`. Check logs: `fly logs --app nepsis-chat`. |
| Machine restart loop | Backend `process.exit(1)` when `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` are missing | Set both secrets via `fly secrets set`. Get keys from Supabase Dashboard → Settings → API. |
| Volume mount error | `nepsis_data` volume missing or wrong region | Create volume: `fly volumes create nepsis_data --region ord --size 1` |

---

## Friends & DM

| Error | Cause | Solution |
|-------|-------|----------|
| "Friends feature not yet configured" when adding friend | `friend_requests` table missing | Run Supabase migration: `supabase/migrations/20250211000002_friend_requests.sql` in Supabase SQL Editor, or `supabase db push` |

---

## Voice UI Icons

| Issue | Cause | Solution |
|-------|-------|----------|
| Mic icon looks snipped/cut off | Tight viewBox or inline SVGs clipping at edges | Shared `VoiceIcons.tsx` with `MicOffIcon` using `viewBox="-1 -1 26 26"` for padding. All voice icons use explicit viewBox. |
| Wrong icon when muted (speaker/bell instead of mic) | Inconsistent or wrong SVG paths | `MicOffIcon` uses mic outline + diagonal slash (not speaker). Used in UserPanel, ChannelList, VoiceView. |
| Headphones slashed when not deafened | Logic or icon mix-up | Show `HeadphonesIcon` when undeafened, `HeadphonesOffIcon` only when deafened. Same for `MicIcon`/`MicOffIcon` with muted. |
| Dead code block in ChannelList | Leftover `{false && <svg>}` from refactor | Removed dead block. |

**Files:** `frontend/src/components/icons/VoiceIcons.tsx`, `UserPanel.tsx`, `ChannelList.tsx`, `VoiceView.tsx`

---

## Chat UI

| Issue | Cause | Solution |
|-------|-------|----------|
| Emoji picker scrollbar overlapping rightmost emojis | Scrollbar rendered on top of content | Added `[scrollbar-gutter:stable]` + `pr-4` so scrollbar never overlaps emojis. |
| Chat input box too short/shrunken | Single-line input with minimal padding | Increased to `min-h-[48px]` and `py-4` for taller input. |

**Files:** `frontend/src/components/EmojiPicker.tsx`, `frontend/src/components/ChatInput.tsx`

---

## Presence & Voice Status

| Issue | Cause | Solution |
|-------|-------|----------|
| User shows "In voice" on Server A when they're in voice on Server B | Presence is global (one status per user). Members list showed raw presence without checking if the voice channel belongs to the current server. | **Fix**: Only show "In voice" when the member's `voiceChannelId` is in the current server's voice channels. MembersSidebar and MemberProfilePanel compute `displayStatus` using `voiceChannels.some(ch => ch.id === member.voiceChannelId)`. Voice connection bar in ChannelList only shows when `channels.some(c => c.id === voiceConnection.channelId)`. Files: `MembersSidebar.tsx`, `MemberProfilePanel.tsx`, `ChannelList.tsx`. |

---

## Adding New Issues

When a new error occurs:

1. Add it here with cause and solution
2. Update [WIKI.md](WIKI.md) if it affects main flows
