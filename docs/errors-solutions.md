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
| **Download 404 — GitHub releases page shows "There aren't any releases here"** | No **published** GitHub Release yet (drafts don't count for `/releases/latest`). | Run **Actions → Desktop Release** or push tag `v*`, or `npm run release:win` / `release:mac` with `GH_TOKEN`. Confirm the release is not left as draft. First public: **v0.1.0**. |
| **Desktop Release publish job skipped on tag push** | `if: inputs.publish` — `inputs` only exists for `workflow_dispatch`, so tag pushes skipped publish even when builds succeeded. | **Fix**: publish `if` uses `github.event_name != 'workflow_dispatch' \|\| inputs.publish`. Builds use `electron-builder -p never`. |
| **Mac: “Nepsis Chat is damaged and cannot be opened”** | Gatekeeper quarantine on an unsigned (or not notarized) download. `identity: null` left the app with no signature, which macOS often reports as “damaged”. | **User fix (immediate):** Terminal → `xattr -cr "/Applications/Nepsis Chat.app"` then reopen. Or right-click → Open. **Build fix:** ad-hoc sign with `mac.identity: "-"` (v0.1.1+). Full notarization needs an Apple Developer cert later. |
| **Stuck on "Checking availability..." when downloading exe** | (1) Logic bug: when GitHub API returns 404/403 or no assets, the code returned false but never called `setAvailable(false)`, so state stayed `null`. (2) No timeout: if the fetch hangs (CORS, rate limit, network), the promise never resolves. | Fixed: DownloadPage now always calls `setAvailable(false)` on API error or missing assets, and uses `AbortController` with 8s timeout so hangs fall through to catch and show "Coming soon". |
| **White screen + "Cannot GET /updates/download"** | (1) Installer not in backend/updates; release script skipped publish-update. (2) Vercel missing `VITE_API_URL` — download link points to wrong host. | Run **`npm run release`** to publish to GitHub Releases. On Vercel, set `VITE_API_URL` to your backend URL so the download link points correctly. |
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
| **Remote camera/screen share not showing until switching channels** | `onRemoteStream` passes same `MediaStream` reference; React skips re-render. `MediaStream.addTrack()` doesn't fire the `addtrack` event. | Added `streamVersion` counter to `VoiceParticipant`; bumped on every `onRemoteStream` call. `useVideoTrackCount` now depends on `streamVersion` to force recount. Files: VoiceContext.tsx, VoiceView.tsx. |

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

## Self-hosted Backend

| Error | Cause | Solution |
|-------|-------|----------|
| Backend crash on startup | Missing `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` | Create `backend/.env` with both vars. Get keys from Supabase Dashboard → Settings → API. |
| **CORS — "No 'Access-Control-Allow-Origin' header"** when frontend calls API | (1) Backend not running or unreachable. (2) `CORS_ORIGINS` too restrictive. (3) Unhandled error response missing CORS headers. | **Solutions**: (1) Ensure backend is running and reachable. (2) Set `CORS_ORIGINS=*` in `backend/.env` or omit to allow all. (3) Backend sets CORS headers on all responses (404, 500, errors). |

---

## Friends & DM

| Error | Cause | Solution |
|-------|-------|----------|
| "Friends feature not yet configured" when adding friend | `friend_requests` table missing | Run Supabase migration: `supabase/migrations/20250211000002_friend_requests.sql` in Supabase SQL Editor, or `supabase db push` |
| **DM / Friends 404** — `/api/dm/conversations`, `/api/friends/list` return 404 | Backend not running latest code, or CORS blocking | Restart backend with latest code. Ensure `CORS_ORIGINS=*` in `backend/.env`. Run Supabase migrations for `dm_conversations`, `dm_participants`, `dm_messages`, `friend_requests`. |
| **Guest logout 500** — "Failed to delete guest account" | FK constraints: user referenced by dm_messages, dm_participants, friend_requests, etc. | Backend now deletes from all referencing tables before deleting user. Redeploy backend. |
| **"Failed to fetch friend requests"** | `friend_requests` table missing or migration not applied | Run Supabase migration: `supabase/migrations/20250211000002_friend_requests.sql` in Supabase Dashboard → SQL Editor. Copy contents of `supabase/run-all-pending-migrations.sql` (includes friend_requests) or run migration 2 explicitly. Backend now returns clearer "Friends feature not yet configured" when table is missing. |
| **404 on `/api/dm/conversations`** / **"Cannot read properties of undefined (reading 'username')"** | (1) DM tables (`dm_conversations`, `dm_participants`, `dm_messages`) missing. (2) Backend doesn't include DM routes. (3) Malformed API response. | Run `supabase/run-all-pending-migrations.sql` in Supabase SQL Editor — it includes DM tables (Migration 5b). Restart backend. Frontend has defensive null checks for `other_user`/`username`. |
| **404 on `/api/servers/reorder`** or **500 on `/api/servers/:id`** | Backend not running latest code. | Restart backend with latest code. Pushing to GitHub does not auto-deploy; you must restart your self-hosted backend. |
| **Invite link doesn't add user to server** | InvitePage did `window.location.reload()` after join which was fragile — session restore could race, `setCurrentServerId(prev \|\| id)` wouldn't switch if prev was already set. | Fixed: InvitePage now calls `loadServers()` + `setCurrentServer(serverId)` directly (same as CommunityPage), then `navigate('/')` without reload. Files: InvitePage.tsx. |

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
| No audio after accepting call / voice | WebRTC ICE failed (firewall/strict NAT); STUN-only can’t relay | Configure TURN: set backend `TURN_URLS` + `TURN_USERNAME` + `TURN_CREDENTIAL`, restart API. Clients load via `GET /api/webrtc/ice`. Or set `VITE_TURN_*` as fallback. See [webrtc-voice.md](webrtc-voice.md). |
| **White screen after agent/branch switch** | Workspace moved to another git branch (e.g. TURN work off `master`) while Vite HMR was running; module graph breaks. Not caused by TURN itself (TURN only loads on voice/call). | Hard refresh the browser; restart `frontend` (`npm run dev`). Confirm backend is up (`localhost:3000`). If you still need GSAP/settings work, switch back to that feature branch and merge TURN into it. |
| **Completely blank white app (no login, no UI)** | Login crossfade GSAP `onComplete` called `setShowLogin(false)` after logout (or mid-transition), leaving `showApp` and `showLogin` both false — `#root` rendered nothing. | **Fix**: Kill login tweens on logout; only hide login if still signed in; always show login layer when `!user`; wrap app in `ErrorBoundary`. File: `App.tsx`, `ErrorBoundary.tsx`. |
| **Production sign-in shows “Load failed”** | Vercel build still has `VITE_API_URL=https://nepsis-chat.fly.dev/api` (Fly removed; DNS fails). Safari reports failed `fetch` as “Load failed”. Bundle may also still use old Supabase `opkatio…`. | **Fix (Vercel → Settings → Environment Variables):** set `VITE_API_URL` to your **live** backend `https://YOUR_HOST/api` (Hetzner/VPS — not localhost, not fly.dev). Set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` to `qeopqyquskszzgprghiy`. Redeploy. Backend must allow CORS for `https://nepsischat.vercel.app`. |
| **Railway Docker: `backend/supabase-migration.sql` not found** | `backend/Dockerfile` used `COPY backend/...` but Railway Root Directory = `backend` makes the build context `backend/` itself, so those paths don’t exist. | **Fix**: Dockerfile copies `package*.json`, `src/`, `supabase-migration.sql` relative to `backend/`. Redeploy on Railway. |
| **Railway 502 + login stuck after email** | App not listening / wrong PORT; or missing Supabase env so process exits. Email auth hits Supabase OK, then `authCallback` to Railway fails → UI never set `user` and spinner stayed. Username needs API too. | **Fix**: Listen on `0.0.0.0` + Railway `PORT` (don’t hardcode `ENV PORT` in Dockerfile). Set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` on Railway. Domain port = app port. Login now completes `authCallback` in `loginWithEmail` / `loginWithUsername` and shows an error if API is down. Username works in the same field when API is healthy. |
| **Vercel shows Cannot reach Railway API** | `VITE_API_URL` is correct, but Railway returns 502. Common: missing Supabase variables (process used to `exit(1)`), wrong public-domain port, or deploy never became healthy. | Open `https://YOUR.up.railway.app/api/health`. Set Railway Variables, redeploy from `master`, match domain port to log line `Server running on port`. Prefer Nixpacks (`backend/railway.toml`). |
| **Railway “Application failed to respond” on /health** | Public domain points at the wrong container port, Root Directory isn’t `backend`, or Docker build was used instead of Nixpacks. | (1) Settings → Root Directory = `backend`. (2) Redeploy from `master` (Nixpacks; `Dockerfile` removed from backend). (3) Deploy Logs → find `Server running on port N` → Networking domain target port = **N**. (4) Variables: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. Test `/health` then `/api/health`. |
| **Voice shows many “Connecting…” tiles / ghosts** | Join registered WebRTC listeners *after* `join-voice`, so `room-peers` was missed; ICE `disconnected` deleted peer map entries while PCs stayed alive and later `ontrack` used socketId as userId → phantom participants. | Register WebRTC before `join-voice`; ignore transient `disconnected`; never use socketId as userId; dedupe by userId. |
| **Second PC in voice doesn’t transfer / duplicates self** | Same `userId` could occupy multiple sockets; no session kick. | On `join-voice`, disconnect other sockets for that user (`voice-session-replaced`); client leaves on that event. |
| Call rings forever / doesn't auto-decline | Timeout not firing | Both caller and callee have 30s timeouts. Check browser console for errors in CallContext |
| **Avatar/banner updates in My Account but others still see old photo** | Members API prefers `user_profiles.avatar_url` over `users.avatar_url`. My Account only PATCHed `users`. | **Fix**: `PATCH /users/:id` syncs avatar/banner onto the active `user_profiles` row. Profiles tab auto-persists media on upload. Files: `users.js`, `ProfilesSettingsTab.tsx`, `UserSettingsModal.tsx`. |
| **Server icon upload fails silently** | Icon handler only `console.error`; banner had UI errors. | **Fix**: `iconError` / `iconLoading` in Server Settings Overview (same pattern as banner). |
| **I look Offline in the members list while I'm in the server** | Presence was poll-only (up to 15s); no optimistic self status; `user_presence` not in Realtime. | **Fix**: Patch self in `serverMembers` immediately on presence change; subscribe to `user_presence` Realtime; overlay live voice/status when loading members. Migration `20250211000017_user_presence_realtime.sql`. |
| **Can't see myself under a voice channel / In voice** | (1) Member refreshes called `setServerMembers(api)` without `withLiveSelfPresence`, wiping live voice. (2) Self was skipped from presence map and only re-added when channel `server_id` matched. (3) Presence DELETE races cleared self. | **Fix**: Always wrap member updates with `withLiveSelfPresence` (insert self if missing); inject self into `voiceUsers` from live `voice.voiceChannelId`; DELETE path re-applies overlay. Files: `App.tsx`. |
| **Joined voice after someone started screenshare — no video** | `connectToPeer` / first `handleOffer` only attached mic `currentLocalStream`; camera/screen added only at toggle time via renegotiation. | **Fix**: Track `extraOutbound` in `webrtc.ts`; attach on new peer connect + first offer; set `contentHint = 'detail'` on screen tracks. |
| **Screenshare forces onto everyone's view** | VoiceView auto-picked first local/remote share as primary stage. | **Fix**: Discord click-to-watch via `watchingShareUserId`; LIVE badges; resizable stage only while watching. |
| **Ping bars look wrong / always gray / no ms** | Bars lit from the tall side; alone in voice had no WebRTC RTT so stayed muted gray; only native `title`. | **Fix**: 1 short bar = red (high), 2 = yellow, 3 = green; socket `latency-ping` fallback; hover tooltip shows `Nms`. |
| **Guest tab not highlighted after Use Web App** | Tab-indicator `useLayoutEffect` ran on first LoginPage mount while WelcomeLanding was showing — auth DOM/refs missing, so the accent pill never positioned. | **Fix**: Run indicator + auth enter animation when `phase === 'auth'`; rAF remeasure Guest button. |

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
| **Server banner/icon upload 500 or doesn't display** | (1) Upload fails: bucket missing, secrets wrong, or `servers.banner_url` column missing. (2) Upload succeeds but banner doesn't show: bucket is private — image URLs return 403. | **Fix**: (1) Create `attachments` bucket (public) in Supabase Dashboard. (2) Run migration `20250211000012_storage_attachments_policies.sql` — adds public SELECT on `storage.objects` for attachments bucket so images load. (3) Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in `backend/.env`. |
| **Failed to fetch soundboard** | GET /api/soundboard returns 500. Usually means `soundboard_sounds` table is missing. | **Fix**: Run migration `20250211000009_soundboard_sounds.sql` in Supabase SQL Editor (or `supabase db push`). Table creates `soundboard_sounds` with RLS policies. |
| **Soundboard PATCH 500 / emoji column missing** | `soundboard_sounds` table exists but lacks `emoji` column. | Run migration `20250211000014_soundboard_emoji.sql` (or Migration 15 in `run-all-pending-migrations.sql`). Adds `emoji` column and UPDATE policy. |
| **Server icons bounce back when dragging to reorder** | Reorder fails or `display_order` column missing. | **Fix**: Run migration `20250211000011_server_members_display_order.sql` in Supabase. Adds `display_order` to `server_members`. Optimistic update now shows new order immediately; on API failure it reverts. |
| **Failed to reorder servers: Error: Not found** (404 on `/api/servers/reorder`) | Backend doesn't include the new reorder route. | **Fix**: Restart backend with latest code. The `PUT /api/servers/reorder` endpoint is in the codebase. |

**Files:** `frontend/src/services/realtime.ts`, `frontend/src/App.tsx`, `backend/src/routes/auth.js`, `supabase/migrations/20250211000006_server_members_realtime.sql`

---

## Socket.io / CORS

| Issue | Cause | Solution |
|-------|-------|----------|
| **CORS errors on socket.io polling** — "No 'Access-Control-Allow-Origin' header" | (1) Socket.io CORS config was missing `credentials: true`. (2) Backend restarting — proxy returns 502 with no CORS headers. | **Fixes**: (1) Added `credentials: true` to socket.io CORS config. (2) Added `withCredentials: true` to all socket.io clients. (3) Added `transports: ['websocket', 'polling']` with reconnection settings (10 attempts, exponential backoff). (4) Increased `pingTimeout` (30s) and `pingInterval` (25s) on server. |
| **WebSocket connection closed before established** | Backend latency or restart — socket.io opens WebSocket probe while HTTP transport is still in use. | Socket.io clients configured with proper reconnection (10 attempts, 1s→10s delay). `allowEIO3: true` on server for broader protocol compatibility. |
| **502 Bad Gateway on socket.io requests** | Proxy returns 502 when backend is starting/restarting. | Increased server ping/pong timeouts. Socket.io clients have reconnection enabled. Client reconnects automatically. |
| **Backend crash loop: `io.of is not a function`** in voice.js | `registerVoiceHandlers(voiceNamespace)` passes the `/voice` namespace as `io`, but code called `io.of('/voice')` which doesn't exist on namespaces (only on root Server). The crash killed the entire Node process, causing all API requests to fail with 502/CORS errors. | **Fix**: Changed `io.of('/voice').adapter.rooms.get(room)` → `io.adapter.rooms.get(room)` and `io.of('/voice').sockets.get(sid)` → `io.sockets.get(sid)` since `io` IS already the namespace. File: `backend/src/socket/voice.js`. |

**Files:** `backend/src/index.js`, `frontend/src/services/chatSocket.ts`, `frontend/src/services/socketSignaling.ts`, `frontend/src/contexts/CallContext.tsx`

---

## UI / UX

| Issue | Cause | Solution |
|-------|-------|----------|
| **Emoji picker overlaps top of chat / clips off-screen** | Old EmojiPicker used `position: absolute` with `bottom-full` inside the message list scroll container. When a message was near the top, the picker would render above the viewport. | **Fix**: Complete redesign of `EmojiPicker.tsx`. Now uses `ReactDOM.createPortal` to render at `document.body` with `position: fixed`. Smart positioning calculates placement based on trigger button's `getBoundingClientRect()` — prefers above, flips below if overflowing top, clamps to viewport edges. Callers (`ChatView`, `DMView`, `SoundboardDropdown`) pass `anchorRect` prop captured on button click. |
| **Emoji picker was too small and lacked search** | Old picker was 280×320px with only text category tabs and no search. | **Fix**: New picker is 352×435px with: search bar (matches shortcodes + category names), emoji category icon tabs (horizontal, with active highlight on scroll), scrollable grid with sticky category headers, "Frequently Used" section (persisted in localStorage), hover preview bar showing `:shortcode:` name, Escape key to close, and server emoji support. |
| **Download banner text cramped / poorly spaced on Login** | Banner message used `flex-shrink-0` inside a nested flex row with `justify-between`, so the long copy could not wrap and collided with the Download / dismiss controls. Login page also had no offset for the fixed banner. | **Fix**: Flatten banner layout to `[message] [Download] [X]` with `flex-1 min-w-0` + `leading-snug` on the message so it wraps cleanly. Publish measured height via CSS var `--download-banner-height` (ResizeObserver). LoginPage applies that as `paddingTop` so guest username form clears the banner. |
| **Download banner message not centered on wide monitors** | Message lived in a left-aligned `flex-1` row inside `max-w-5xl`, so it stayed left of the Download button instead of viewport-centered. | **Fix**: Center the message with `justify-center` + `text-center` across the full banner width; pin Download / dismiss with `absolute right-4`. Horizontal padding on the message avoids overlap with the actions. |
| **Download banner too wide / full-bleed** | Banner stretched edge-to-edge as a full-width bar. | **Fix**: Compact centered tab: `flex justify-center` wrapper, content `max-w-[min(92vw,36rem)]`, `rounded-b-2xl` (sharp top, rounded bottom), light `shadow-md`. |
| **Login / banner transitions felt abrupt** | Banner dismissed and LoginPage unmounted instantly when auth succeeded (no exit animation). | **Fix**: Added `gsap`. Banner open/close uses slide+fade; LoginPage mounts with fade/rise; `AppContent` defers switching to main app until login shell GSAP exit completes, then fades app in. |
| **Login fields stayed open while joining** | Submit only flipped button text to “Joining…”; username/password block stayed fully visible. | **Fix**: On Continue / Sign In, GSAP collapses fields **and** the Continue button together (`height` + fade + rise) before auth; reopen on error or signup “check email”. File: `LoginPage.tsx`. |
| **Black footer / bottom gap after login** | Nested `h-screen` inside a GSAP/`will-change-transform` shell left a compositor gap under the app (body `bg-app-darker` showed through). | **Fix**: `html, body, #root { height: 100% }`; app shell uses `fixed inset-0 overflow-hidden`; MainLayout `h-full`. |
| **Black footer flash when leaving login** | Login exit used `scale: 0.98` + `y` on a full-screen shell, exposing body edges; then app mounted from `opacity: 0`, flashing empty darker background. | **Fix**: Crossfade — mount app underneath at full opacity, fade login out with opacity only (no scale/translate). |
| **User Settings box jumps when changing tabs** | Modal used `max-h` only, so shorter tabs (Appearance, etc.) shrank the dialog. | **Fix**: Lock modal to `h-[min(640px,90vh)]`; content pane scrolls; GSAP animates tab content without resizing the shell. |
| **User Settings tabs flash when switching pages** | Content swapped on `activeTab` immediately while a short opacity/y fade ran on the new panel — looked like a hard cut/flash. | **Fix**: Sidebar uses one sliding accent indicator (like login tabs). Content uses directional GSAP horizontal slide (out then in) based on sidebar order. File: `UserSettingsModal.tsx`. |
| **User Settings tab change felt abrupt / only faded** | Tab content used a short opacity+y fade with no travel direction. | **Fix**: Directional GSAP slide (out then in) based on sidebar order — down the list slides left, up slides right. Sidebar highlight updates immediately; content swaps after exit. |
| **Login logo coin does not spin on cursor swipe** | `gsap.quickSetter(coin, 'rotationY')` was called **without the `'deg'` unit**. GSAP’s quickSetter ignores non-zero unit-based values when the unit argument is omitted (only `0` appeared to “work”), so pointer deltas never visibly rotated the coin. | **Fix**: Use `gsap.quickSetter(coin, 'rotationY', 'deg')`. Pointer enter/move/leave + ticker inertia unchanged. |
| **Login logo coin never stops spinning** | After release, low-velocity “face seek” kept advancing the target by another 180° whenever it got close, so inertia never settled. | **Fix**: Coast with stronger friction, then ease to the original front face (`Math.round(rotation / 360) * 360`). File: `LoginPage.tsx`. |
| **UserPanel status / mute / deafen felt instant** | Status menu mounted/unmounted with no motion; mute/deafen only swapped icons via CSS color. | **Fix**: GSAP status menu open (fade+rise+scale) and close before unmount; mute/deafen buttons use back-out scale punch on click; status indicator pops on status change. File: `UserPanel.tsx`. |
| **Profiles / Privacy tabs were placeholders** | UI stubbed; no privacy table; friends had no profile association. | **Fix**: Migration `20250211000015_privacy_profiles_friends.sql` + APIs for privacy, active profile, friend visibility; Profiles/Privacy settings UI; Add/Accept friend under Personal or Work. |
| **Privacy & Safety shows “Failed to fetch”** | Browser cannot reach the backend (`VITE_API_URL`, usually `http://localhost:3000/api`), or backend exited because `SUPABASE_SERVICE_ROLE_KEY` was empty. | **Fix**: (1) Set service role in `backend/.env` (Dashboard → API). Backend can temporarily use anon key if service role is blank. (2) Run `npm run dev` in `backend/`. (3) Confirm frontend `VITE_API_URL` points at that API. Schema `user_privacy_settings` is already migrated. |
| **Appearance / Voice / Notifications were placeholders** | Tabs stubbed with static copy; no prefs store. | **Fix**: `userPrefs.ts` + three settings tabs; theme CSS vars; Voice/Call use saved device constraints; sounds/desktop notifs respect toggles. Prefs are device-local (`localStorage`). |
| **Guests could submit bug reports** | Help tab + `/api/bug-reports` allowed any userId. | **Fix**: Hide report form for guests; backend rejects `is_guest` accounts with 403. |
| **User Settings scrollbar overlaps close (X)** | Thick native scrollbar competed with the absolute close button in the top-right. | **Fix**: Keep the X over the scroll edge (solid `bg-[#313338]` so the track tucks under it) and style the pane with thin `.settings-scroll` (6px, transparent track). File: `UserSettingsModal.tsx`, `index.css`. |
| **Settings used native selects / CSS-only toggles** | Browser `<select>` looked inconsistent; toggles only used Tailwind `transition-transform`. | **Fix**: Shared `SettingsDropdown` (portal + GSAP open/close) and `SettingsToggle` (GSAP knob/track). Wired into Privacy, Voice & Video, Notifications, Profiles. |
| **White hairlines under Explore / Friends / headers** | Appearance prefs switched Tailwind colors to bare `var(--app-*)`. Opacity classes like `border-app-dark/50` stopped generating, so `border-b` fell back to Tailwind’s default `#e5e7eb` (looks white). Started in commit that added CSS-variable themes. | **Fix**: Store theme colors as space-separated RGB channels and use `rgb(var(--app-dark) / <alpha-value>)` in `tailwind.config.js`. Files: `tailwind.config.js`, `index.css`, `userPrefs.ts`. |
| **My Account Work unlocked / names stale after Profiles** | Work selectable with no Work profile; Personal not seeded; `profileLabels` loaded once; switching `active_profile` didn’t sync `users.display_name`. | **Fix**: Auto-seed Personal with signup username; lock Work until Work name saved; Profiles → My Account via `onProfilesChange`; PATCH `active_profile` copies that profile onto `users`. |
| **Settings flashed “Work · locked” on open** | Profile state started empty until `getUserProfiles` returned, so Work looked locked for a frame even when cached/unlocked. | **Fix**: Cache profiles in `localStorage` (`nepsis_settings_profiles_*`); hydrate My Account/Profiles from cache on open; only show locked after `profilesReady`. |
| **Deafen/mute were independent** | Deafen did not mute; unmuting while deafened left headphones off. | **Fix**: Discord-style coupling in `VoiceContext` / `CallContext` — deafen ⇒ mute; unmute ⇒ undeafen. Remembers mute-before-deafen so undeafen unmutes only if you weren’t already muted. |
| **Mute/deafen had no sound feedback** | Join/leave/connected tones existed; self mute/deafen were silent. | **Fix**: `sounds.mute/unmute/deafen/undeafen` (Web Audio ticks). Voice + call toggles play one cue per action (deafen covers mute-from-deafen; unmute covers undeafen). Gated by Notifications → Voice sounds. |
| **Friend search exposed login usernames** | Lookup was by `users.username` and returned that publicly. | **Fix**: Profiles are public identities; `GET /users/profiles/search` finds discoverable display names; login username stays private. Migration `20250211000016_profile_identities.sql` adds bio/discoverable + per-server `profile_type`. |

**Files:** `frontend/src/components/EmojiPicker.tsx`, `frontend/src/components/ChatView.tsx`, `frontend/src/components/DMView.tsx`, `frontend/src/components/SoundboardDropdown.tsx`, `frontend/src/components/DownloadBanner.tsx`, `frontend/src/components/LoginPage.tsx`

---

## Supabase MCP / Cursor

| Error | Cause | Solution |
|-------|-------|----------|
| **`{"message":"Unrecognized client_id"}` when authenticating Supabase MCP** | Cursor cached an old OAuth Dynamic Client Registration. Supabase no longer recognizes that `client_id`, so the browser auth page fails immediately. | **Fix (desktop Cursor):** (1) Settings → Tools & MCP / Plugins → **Disconnect/Logout** Supabase. (2) Remove the Supabase plugin/MCP entry. (3) Fully quit Cursor (all windows). (4) Reinstall/re-add Supabase MCP and authenticate again so a fresh client registers. Scope URL to current project: `https://mcp.supabase.com/mcp?project_ref=qeopqyquskszzgprghiy`. If it still fails, check Output → **Cursor MCP** for `Saving client information` (missing = DCR bug). |
| **App still pointed at old Supabase project** | Env/docs still used `opkatioqcmamnwmvqdtq` after creating a new project. | **Fix**: Project URL is `https://qeopqyquskszzgprghiy.supabase.co`. Migrations + `attachments` bucket applied via MCP. Frontend anon key is in `.env.production` / `.env.local`. Paste **service_role** into `backend/.env` and update Vercel `VITE_SUPABASE_*`. |

---

## Adding New Issues

When a new error occurs:

1. Add it here with cause and solution
2. Update [WIKI.md](WIKI.md) if it affects main flows
