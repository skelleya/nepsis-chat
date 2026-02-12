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
| **Download 404 — GitHub releases page shows "There aren't any releases here"** | No GitHub release has been published yet. The download page links to `releases/latest/download/NepsisChat-Setup.exe` but the repo has zero releases. | Set `GH_TOKEN` (GitHub PAT with `repo` scope) then run `npm run release`. This builds the Electron app and uploads the exe to GitHub Releases via electron-builder. PowerShell: `$env:GH_TOKEN="ghp_xxx"; npm run release`. |
| **Stuck on "Checking availability..." when downloading exe** | (1) Logic bug: when GitHub API returns 404/403 or no assets, the code returned false but never called `setAvailable(false)`, so state stayed `null`. (2) No timeout: if the fetch hangs (CORS, rate limit, network), the promise never resolves. | Fixed: DownloadPage now always calls `setAvailable(false)` on API error or missing assets, and uses `AbortController` with 8s timeout so hangs fall through to catch and show "Coming soon". |
| **White screen + "Cannot GET /updates/download"** | (1) Installer not in backend/updates; release script skipped publish-update. (2) Vercel missing `VITE_API_URL` — download link points to wrong host. | Run **`npm run release`** (not just `npm run deploy`). On Vercel, set `VITE_API_URL=https://nepsis-chat.fly.dev/api` so the download link points to the backend. |
| **404: NOT_FOUND / DEPLOYMENT_NOT_FOUND** (after install) | Packaged app was loading from Vercel; that deployment/project may not exist. | Now fixed: the app loads from bundled frontend by default. Rebuild with `npm run package` or `npm run release` and reinstall. Ensure `npm run build:frontend` runs before packaging so `webapp/` is populated. |

---

## Electron

| Error | Cause | Solution |
|-------|-------|----------|
| **Application entry file "main.js" in app.asar is corrupted: ENOENT** | `extraResources` with `"to": "app"` conflicts with electron-builder's main app packaging — `app.asar` was never created; only `resources/app/` (frontend) existed. | Change `extraResources` to use `"to": "webapp"` instead of `"to": "app"`. Update `main.js` fallback path from `process.resourcesPath, 'app'` to `process.resourcesPath, 'webapp'`. Clean `electron/dist` and run `npm run package`. |
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
| Audio stops working when friend turns on camera | Remote stream overwritten: each `ontrack` event delivered a different MediaStream depending on the sender's stream. When camera video arrived, the old audio stream reference was lost. | **Fix**: Each peer now uses ONE combined `remoteStream` (`new MediaStream()`). All incoming tracks (audio + video) are added to it. `RemoteAudio` extracts audio tracks. `ParticipantCard` checks for video tracks. Files: `webrtc.ts`, `RemoteAudio.tsx`, `VoiceView.tsx`. |
| Can't see friend's camera/screen share | VoiceView only rendered local video/screen (`videoStream`, `screenStream`). Remote participant video was never displayed. | **Fix**: `ParticipantCard` now checks `stream.getVideoTracks().length > 0` via `useVideoTrackCount` hook. When video tracks exist, it renders a `<video>` element filling the card. Track removal detected via `onended` + `onmute` fallback. Files: `VoiceView.tsx`, `webrtc.ts`. |
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
| **CORS — "No 'Access-Control-Allow-Origin' header"** when frontend (nepsischat.vercel.app) calls API (nepsis-chat.fly.dev) | (1) Fly.io returns 502/503 before app starts (cold start, app asleep). (2) Backend env `CORS_ORIGINS` overridden by Fly secrets. (3) Unhandled error response missing CORS headers. | **Solutions**: (1) Run `npm run deploy` to redeploy backend. Ensure `fly.toml` has `CORS_ORIGINS = '*'` in [env]. If using Fly secrets, don't set `CORS_ORIGINS` unless you include Vercel domains. (2) Backend now sets CORS headers on all responses (404, 500, errors). (3) If app is cold-starting (min_machines_running=0), first request may fail; retry after a few seconds. |

---

## Friends & DM

| Error | Cause | Solution |
|-------|-------|----------|
| "Friends feature not yet configured" when adding friend | `friend_requests` table missing | Run Supabase migration: `supabase/migrations/20250211000002_friend_requests.sql` in Supabase SQL Editor, or `supabase db push` |
| **DM / Friends 404** — `/api/dm/conversations`, `/api/friends/list` return 404 | Backend on Fly.io not deployed with latest code, or CORS blocking | Redeploy backend: `npm run deploy` or `fly deploy --app nepsis-chat`. Ensure `CORS_ORIGINS=*` in fly.toml or Fly secrets. Run Supabase migrations for `dm_conversations`, `dm_participants`, `dm_messages`, `friend_requests`. |
| **Guest logout 500** — "Failed to delete guest account" | FK constraints: user referenced by dm_messages, dm_participants, friend_requests, etc. | Backend now deletes from all referencing tables before deleting user. Redeploy backend. |
| **"Failed to fetch friend requests"** | `friend_requests` table missing or migration not applied | Run Supabase migration: `supabase/migrations/20250211000002_friend_requests.sql` in Supabase Dashboard → SQL Editor. Copy contents of `supabase/run-all-pending-migrations.sql` (includes friend_requests) or run migration 2 explicitly. Backend now returns clearer "Friends feature not yet configured" when table is missing. |
| **404 on `/api/dm/conversations`** / **"Cannot read properties of undefined (reading 'username')"** | (1) DM tables (`dm_conversations`, `dm_participants`, `dm_messages`) missing. (2) Backend deployment doesn't include DM routes. (3) Malformed API response. | Run `supabase/run-all-pending-migrations.sql` in Supabase SQL Editor — it now includes DM tables (Migration 5b). Redeploy backend to Fly so DM routes are served. Frontend now has defensive null checks for `other_user`/`username`. |
| **404 on `/api/servers/reorder`** or **500 on `/api/servers/:id`** | Backend on Fly.io not deployed with latest code after git push. | **Redeploy backend**: `npm run deploy` or `cd backend && fly deploy --app nepsis-chat`. Pushing to GitHub does not auto-deploy the backend; you must run deploy manually. |

---

## Call Notifications

| Issue | Cause | Solution |
|-------|-------|----------|
| No notification when someone calls while app is in another tab | Browser Notification API not used; sound only plays in active tab | CallContext now shows browser Notification when `document.hidden` and incoming call received. Permission is requested on socket connect. If user previously denied, they must re-enable in browser settings. |

---

## Voice Speaking Indicator

| Issue | Cause | Solution |
|-------|-------|----------|
| Green bubble / ring not showing around profile when talking | (1) Browsers start `AudioContext` in a suspended state—the analyser never processes audio until resumed. (2) Threshold `avg > 12` might be too high for quieter mics. | **Fix**: Call `audioCtx.resume()` when `audioCtx.state === 'suspended'` before starting the analysis loop. Lower threshold to 8. Add `analyser.smoothingTimeConstant = 0.5` for smoother transitions. Files: `VoiceView.tsx` (useSpeakingDetector), `VoiceContext.tsx` (local speaking detection). |

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

## Voice & Invites

| Issue | Cause | Solution |
|-------|-------|----------|
| Failed to create invite | (1) server_invites table not created. (2) User not a server member. (3) API error. | Run migration `20250211000004_server_invites_audit.sql`. Frontend now shows the actual backend error. Backend returns a helpful message if the table is missing. |
| Main screen shows only "you" when others are in voice | Participants only added when WebRTC stream arrives; room-peers and peer-joined were ignored. | Process `room-peers` and `peer-joined` to add participants with stream=null ("Connecting..."); update when stream arrives. |
| **Ghost "Connecting..." when another user leaves voice** | When user A leaves, `peer-left` removes A from WebRTC participants, but `voiceUsersInChannel` (from presence) can still include A for a few seconds. Merge re-adds A with stream=null → stuck "Connecting...". | Track `leftUserIds` in VoiceContext when `onPeerLeft` fires; exclude them when merging `voiceUsersInChannel` in VoiceView. Files: VoiceContext.tsx, VoiceView.tsx. |
| Sidebar voice list doesn't update when someone leaves | serverMembers polled every 8s; slow to reflect presence changes. | Poll every 2s when user is in a voice channel (`voice.voiceChannelId`); 8s otherwise. |
| **Other user visible in sidebar but not in main voice grid** | Main grid only showed WebRTC participants; users from presence (sidebar) weren't merged. | Pass `voiceUsersInChannel` to VoiceView and merge with participants so everyone in the channel shows in the main grid (remote users show "Connecting..." until stream arrives). |
| **Screen share layout only for host, not receivers** | Remote tracks often lack `displaySurface` in getSettings(); `isScreenShareTrack` returned false for remote screen share. | Add fallbacks: (1) track.label regex for "screen|display|window|monitor|capture". (2) When 2+ video tracks, treat larger-dimension track as screen share. Lower minSize to 5% for both panels so users can make cards or screen share "tinier". Files: VoiceView.tsx. |

**Files:** `webrtc.ts`, `VoiceContext.tsx`, `App.tsx`, `api.ts`, `servers.js`

---

## Presence & Voice Status

| Issue | Cause | Solution |
|-------|-------|----------|
| User shows "In voice" on Server A when they're in voice on Server B | Presence is global (one status per user). Members list showed raw presence without checking if the voice channel belongs to the current server. | **Fix**: Only show "In voice" when the member's `voiceChannelId` is in the current server's voice channels. MembersSidebar and MemberProfilePanel compute `displayStatus` using `voiceChannels.some(ch => ch.id === member.voiceChannelId)`. Voice connection bar in ChannelList only shows when `channels.some(c => c.id === voiceConnection.channelId)`. Files: `MembersSidebar.tsx`, `MemberProfilePanel.tsx`, `ChannelList.tsx`. |

---

## Profile (Avatar & Banner)

| Issue | Cause | Solution |
|-------|-------|----------|
| Banner not updating on profile | `handleBannerUpload` in UserSettingsModal dispatched `nepsis-user-updated` event but never called `onUserUpdate`. Context/user state was never updated with new banner_url. | Call `onUserUpdate?.({ banner_url: url })` after banner upload so context stays in sync. Files: `UserSettingsModal.tsx`. |
| Profile icon not changing in members list when changing avatar | (1) MembersSidebar always showed username initial, never `member.avatarUrl`. (2) Context user avatar updated but serverMembers wasn't refetched; no `currentUserAvatarUrl` override for immediate display. | (1) Render avatar image when `member.avatarUrl` exists. (2) Pass `currentUserAvatarUrl={user.avatar_url}` to MembersSidebar so current user's avatar updates immediately. (3) Add `user?.avatar_url` to serverMembers useEffect deps to refetch when current user changes avatar. Files: `MembersSidebar.tsx`, `App.tsx`. |

**Files:** `UserSettingsModal.tsx`, `MembersSidebar.tsx`, `App.tsx`, `UserPanel.tsx`

---

## Server Banner

| Issue | Cause | Solution |
|-------|-------|----------|
| Server banner not visible | Banner was only shown in Server Settings modal, never in the main UI. | Add `serverBannerUrl` prop to ChannelList and render banner above the server header. Files: `ChannelList.tsx`, `App.tsx`. |
| Unable to publish server banner | (1) No error feedback when upload failed. (2) Server Settings only visible to owners, not admins. | (1) Add `bannerError` and `bannerLoading` state in ServerSettingsModal; show error message below banner upload area. (2) Show Server Settings to admins (`isAdminOrOwner`). Common upload errors: Storage not configured (create "attachments" bucket in Supabase), Network/CORS issues. Files: `ServerSettingsModal.tsx`, `ChannelList.tsx`. |

**Files:** `ChannelList.tsx`, `App.tsx`, `ServerSettingsModal.tsx`

---

## DM Calls

| Issue | Cause | Solution |
|-------|-------|----------|
| Call button does nothing / no ring | `/calls` namespace not registered on backend | Ensure `registerCallHandlers(callsNamespace)` is in `backend/src/index.js` and backend is restarted |
| "User is offline" immediately after clicking Call | Target user's browser hasn't connected to the `/calls` namespace yet | The CallProvider must be mounted (user must be logged in). Check that `CallProvider` wraps `MainLayout` in `App.tsx` |
| No audio after accepting call | WebRTC ICE candidate exchange failed (firewall/NAT) | Add TURN server to ICE_CONFIG in `CallContext.tsx` for strict NAT environments |
| Call rings forever / doesn't auto-decline | Timeout not firing | Both caller and callee have 30s timeouts. Check browser console for errors in CallContext |

**Files:** `backend/src/socket/calls.js`, `frontend/src/contexts/CallContext.tsx`, `frontend/src/components/CallOverlay.tsx`

---

## Sounds

| Issue | Cause | Solution |
|-------|-------|----------|
| No sounds playing | Browser requires user interaction before AudioContext can play | AudioContext is created on first sound call; user must have interacted with the page (click/keypress) first. This is normal browser behavior. |
| Sounds too loud/quiet | Volume constants in `sounds.ts` | Adjust `volume` parameter in each sound method (0.0–1.0). Current defaults: 0.06–0.14 |

**Files:** `frontend/src/services/sounds.ts`

---

## Server Members & Realtime

| Issue | Cause | Solution |
|-------|-------|----------|
| **Slow to see someone join/leave a server** — member list takes 5+ seconds to update | Frontend polled `server_members` every 5 seconds (no Supabase Realtime subscription). Unlike `messages` and `dm_messages`, `server_members` was never added to the `supabase_realtime` publication. | **Three fixes**: (1) Added `server_members` to `supabase_realtime` publication — run migration `20250211000006_server_members_realtime.sql` (or Migration 7 in `run-all-pending-migrations.sql`). (2) Added `subscribeToServerMembers()` in `realtime.ts` for instant join/leave updates via Supabase Realtime. (3) App.tsx now uses realtime subscription + light fallback poll (15s normal, 2s in voice) instead of aggressive 5s polling. |
| **Guest logout 500** — "Failed to delete guest account" (repeated retries) | `message_reactions` table not cleaned up before deleting guest user. If guest reacted to messages, FK constraint `message_reactions.user_id → users.id` blocks deletion. | Added `message_reactions` to the cleanup table list in `auth.js` (before `messages`). Redeploy backend. |
| **Ghost "random number account" joins when user logs out** | Race condition: `deleteGuestAccount` deletes `server_members` first, then `users`. During the gap, a pending `GET /api/servers?userId=xxx` could previously auto-join community servers and create phantom entries. | **Fixes**: (1) Frontend: `logout()` clears user state and stops polling BEFORE calling `deleteGuestAccount`. (2) Backend: `GET /api/servers` no longer auto-joins community servers—new/temp accounts start with no servers; users join via invite or Explore page. File: `backend/src/routes/servers.js`. |
| **Can't edit community server after making self owner** | Ownership is in two places: `servers.owner_id` (used by frontend for edit UI) and `server_members.role` (used by backend). If you only updated `server_members.role = 'owner'`, the frontend wouldn't show edit controls. | **Fix**: Frontend now treats `role = 'owner'` as owner even if `servers.owner_id` wasn't updated. For full consistency, update both in Supabase: `UPDATE servers SET owner_id = 'your-user-id' WHERE id = 'server-id'; UPDATE server_members SET role = 'owner' WHERE server_id = 'server-id' AND user_id = 'your-user-id';` (and demote old owner to 'member'). |
| **Server banner/icon upload 500 or doesn't display** | (1) Upload fails: bucket missing, secrets wrong, or `servers.banner_url` column missing. (2) Upload succeeds but banner doesn't show: bucket is private — image URLs return 403. | **Fix**: (1) Create `attachments` bucket (public) in Supabase Dashboard. (2) Run migration `20250211000012_storage_attachments_policies.sql` — adds public SELECT on `storage.objects` for attachments bucket so images load. (3) Ensure `fly secrets set SUPABASE_SERVICE_ROLE_KEY=...`. |
| **Failed to fetch soundboard** | GET /api/soundboard returns 500. Usually means `soundboard_sounds` table is missing. | **Fix**: Run migration `20250211000009_soundboard_sounds.sql` in Supabase SQL Editor (or `supabase db push`). Table creates `soundboard_sounds` with RLS policies. |
| **Soundboard PATCH 500 / emoji column missing** | `soundboard_sounds` table exists but lacks `emoji` column. | Run migration `20250211000014_soundboard_emoji.sql` (or Migration 15 in `run-all-pending-migrations.sql`). Adds `emoji` column and UPDATE policy. |
| **Server icons bounce back when dragging to reorder** | Reorder fails or `display_order` column missing. | **Fix**: Run migration `20250211000011_server_members_display_order.sql` in Supabase. Adds `display_order` to `server_members`. Optimistic update now shows new order immediately; on API failure it reverts. |
| **Failed to reorder servers: Error: Not found** (404 on `/api/servers/reorder`) | Deployed backend on Fly.io doesn't include the new reorder route. | **Fix**: Redeploy the backend: `npm run deploy`. This deploys the backend to Fly.io with the new `PUT /api/servers/reorder` endpoint. |

**Files:** `frontend/src/services/realtime.ts`, `frontend/src/App.tsx`, `backend/src/routes/auth.js`, `supabase/migrations/20250211000006_server_members_realtime.sql`

---

## Socket.io / CORS

| Issue | Cause | Solution |
|-------|-------|----------|
| **CORS errors on socket.io polling** — "No 'Access-Control-Allow-Origin' header" | (1) Socket.io CORS config was missing `credentials: true`. (2) When Fly.io backend is restarting, proxy returns 502 with no CORS headers — browser reports this as a CORS error. | **Fixes**: (1) Added `credentials: true` to socket.io CORS config. (2) Added `withCredentials: true` to all socket.io clients. (3) Added `transports: ['websocket', 'polling']` with reconnection settings (10 attempts, exponential backoff) to all socket clients. (4) Increased `pingTimeout` (30s) and `pingInterval` (25s) on server to reduce spurious disconnects on Fly.io. |
| **WebSocket connection closed before established** | Fly.io machine wake-up latency — socket.io opens WebSocket probe while HTTP transport is still in use; server restarts mid-handshake. | Socket.io clients now configured with proper reconnection (10 attempts, 1s→10s delay). `allowEIO3: true` on server for broader protocol compatibility. |
| **502 Bad Gateway on socket.io requests** | Fly.io proxy returns 502 when backend is starting/restarting. | Increased server ping/pong timeouts. Socket.io clients have reconnection enabled. No CORS headers appear on 502 responses — this is normal Fly.io proxy behavior; the client reconnects automatically. |
| **Backend crash loop: `io.of is not a function`** in voice.js | `registerVoiceHandlers(voiceNamespace)` passes the `/voice` namespace as `io`, but code called `io.of('/voice')` which doesn't exist on namespaces (only on root Server). The crash killed the entire Node process, causing all API requests to fail with 502/CORS errors. | **Fix**: Changed `io.of('/voice').adapter.rooms.get(room)` → `io.adapter.rooms.get(room)` and `io.of('/voice').sockets.get(sid)` → `io.sockets.get(sid)` since `io` IS already the namespace. File: `backend/src/socket/voice.js`. |

**Files:** `backend/src/index.js`, `frontend/src/services/chatSocket.ts`, `frontend/src/services/socketSignaling.ts`, `frontend/src/contexts/CallContext.tsx`

---

## Adding New Issues

When a new error occurs:

1. Add it here with cause and solution
2. Update [WIKI.md](WIKI.md) if it affects main flows
