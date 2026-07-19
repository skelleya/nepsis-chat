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
| [Deployment](deployment.md) | Self-hosted, Docker, GitHub |
| [Errors & Solutions](errors-solutions.md) | Known issues and fixes |

---

## Quick Reference

| Task | Command |
|------|---------|
| Start backend | `npm run dev:backend` |
| Start frontend | `npm run dev:frontend` |
| Run desktop app | `npm run electron` |
| Full release build | `npm run package:full` |
| Full release (Electron) | `npm run release` |
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
| + | Deployment — Self-hosted backend, GitHub, Docker, env-based config |
| + | Supabase migration — Postgres DB + email auth (guest + email login) |
| + | Guest logout — delete guest account + leave all servers on logout |
| + | Discord-like UI overhaul — server creation, channel categories, voice user display, user panel, server settings, camera/screen share |
| + | Messaging v3 — edit/delete messages, reply, emoji reactions, file/image uploads, owner/admin can delete any message |
| + | Roles & members — server members list with roles (owner/admin/member), activity status, kick (owner/admin only) |
| + | Messaging v4 — Supabase Realtime for instant reactions & messages; video upload; reply shows full parent; extended emoji picker (basic + OpenMoji-style); server creation restricted to email users; custom server emojis (owner/admin upload) |
| + | Voice UI v2 — Discord-style square grid for participants filling center; members sidebar minimizable; member profile panel with Message and Add Friend |
| + | Voice fix v3 — Fixed remote video/screen share display; combined remote MediaStream per peer prevents audio loss when video tracks arrive; ParticipantCard shows video when camera/screen active; track.onmute fallback for cross-browser compat |
| + | Voice UI v3 — End-call icon for disconnect; mic/headphone icons for mute/deafen; show users in voice channels before joining; drag channels to reorder; right-click user context menu (Message, Add Friend, Kick, Move to Channel); admin can move users between voice channels via right-click |
| + | Admin voice controls — Owner/admin can mute users in voice (force-mute) and disconnect them from voice. Right-click participant in VoiceView or member in MembersSidebar; backend emits admin-mute and admin-disconnect-from-voice via Socket.io. |
| + | Category & channel management — Server owners can: reorder categories (drag); reorder channels within/between categories (drag); edit/delete categories and channels (3-dot menu); drag voice users from one voice channel to another (admin only) |
| + | Split deployment — Frontend on Vercel (git push, ~1 min), backend self-hosted (API + Socket.io). Download page links to GitHub Releases |
| + | Voice status server-scoped — "In voice" and voice connection bar only show for the server where the user is actually in voice; no cross-server confusion |
| + | Layout cache — Channels and categories cached in localStorage; instant server preview on switch; background refresh when tab becomes visible; preload for other servers |
| + | Voice UI v4 — Green circle glows when speaking (UserPanel); mute/deafen icons next to username (UserPanel + channel list voice users); signal dot + ping on left of "Voice Connected" bar |
| + | Voice UI v5 — Discord-style big square participant tiles in voice channel view; large circular avatars in grid layout; 1 person = prominent single tile, 2–4 = 2-column grid |
| + | Download banner — Web-only banner overlay prompting users to download the desktop app; dismissible with close button; state persisted in localStorage; hidden on /download page |
| + | Download banner spacing fix — Message wraps instead of overflowing; flat `[text] [Download] [X]` row; CSS var `--download-banner-height` offsets LoginPage so guest username form is not cramped under the banner |
| + | Download banner centering — Banner message centered on any viewport width; Download / dismiss pinned to the right |
| + | Download banner compact tab — Small centered top banner (not full-bleed); rounded bottom corners, sharp top edge flush with viewport |
| + | GSAP motion — `gsap` drives download-banner open/close and login enter/exit (card rise in; shell fades out on auth; main app fades in) |
| + | Login tab glide — Guest / Sign In / Sign Up form panel slides horizontally in the travel direction (with the pill) |
| + | Login form height lock — Guest matches Sign In / Sign Up height (fixed panel) so tab switches don’t resize the card |
| + | App height fill fix — html/body/#root 100% height; main shell uses `fixed inset-0` to remove black bottom gap |
| + | User Settings GSAP — Modal opens/closes with GSAP; fixed panel height; sidebar accent pill slides between buttons; content pages slide horizontally in travel direction (like login tabs) |
| + | Settings controls GSAP — Shared `SettingsDropdown` (portal list, fade/scale open-close) and `SettingsToggle` (knob slide + track color) on Privacy / Voice / Notifications / Profiles |
| + | UserPanel GSAP — Status dropdown open/close animates; mute/deafen buttons scale-punch on click; status dot pops when status changes |
| + | ServerBar bubble GSAP — Friends + Community server bubbles scale-punch on click |
| + | Friends / Community page GSAP — Main content fades and slides in when opening via Nepsis or compass bubbles |
| + | Privacy & Safety settings — Voice-focused controls: who can DM/call/add you; voice channel + online visibility; speaking indicator |
| + | Dual profiles (Personal/Work) — Customize presentation; choose active profile for servers; add/accept friends under a profile; per-friend visibility (one or both) |
| + | Profile identities — Public Personal/Work personas (bio, discoverable); search by display name not login; per-server appear-as preset; My Account default profile selector |
| + | My Account profile defaults — Until onboarding: Personal auto-seeds to signup username; Work locked until saved; switching/saving profiles updates My Account name immediately |
| + | Supabase project — Active project `qeopqyquskszzgprghiy` (`https://qeopqyquskszzgprghiy.supabase.co`); MCP connected; 19 migrations applied + public `attachments` bucket; frontend anon key wired; backend prefers `SUPABASE_SERVICE_ROLE_KEY` and falls back to anon for local/dev if blank |
| + | User Settings page slide — Sidebar tabs (My Account → Help) animate content with directional GSAP horizontal slide |
| + | Login logo coin spin — Nepsis logo on LoginPage spins left/right with cursor movement via GSAP `rotationY` (`quickSetter` must pass `'deg'` or non-zero spins are ignored); after swipe it coasts with friction and eases back to the front-facing position |
| + | Login logo coin thickness — 3D coin with front/back faces + rim segments so the edge shows when viewed on its side |
| + | Login tab pill — Shared accent indicator slides between Guest / Sign In / Sign Up via GSAP (no per-button background flash) |
| + | Login credentials close — Username / email+password fields collapse with GSAP when Continue / Sign In is clicked; reopen if auth fails |
| + | Download banner balance — Short prompt + clear Download button + subtle dismiss (not full marketing sentence, not link-only) |
| + | Last channel per server — When switching servers, auto-restore the last selected channel for that server; persisted in localStorage (nepsis_last_channel); cleared on logout |
| + | Emoji picker — Click-outside-to-close; improved styling (rounded-xl, shadow-2xl, better spacing, active scale feedback) |
| + | Chat input — Send button uses up-arrow icon; @mention autocomplete (@everyone, @username); :emoji: shortcode autocomplete (e.g. :smile:) |
| + | User settings — Full settings modal with tabs (My Account, Profiles, Privacy & Safety, Appearance, Voice & Video, Notifications); avatar + banner upload; username change; Personal/Work profile switch (non-guest); status dropdown (Online, Away, DND, Offline) in UserPanel |
| + | Appearance / Voice / Notifications prefs — Workable local settings (`nepsis_user_prefs`): themes + accent + density; device selection + mic processing + volume; sound and desktop notification toggles |
| + | Server invites — Discord-style invite links; create invite from server dropdown or voice channel; public `/invite/:code` page with Join Server; audit log for server actions (invite created/revoked, member joined/kicked) |
| + | Server settings — Members tab (list, kick); Invites tab (create, copy link, revoke); Audit Log tab; modernized Custom Emojis tab (drag-drop upload, grid layout) |
| + | Invite-only join — No auto-join on login; new and temp accounts start with no servers; join via invite link or code; Community page (compass icon) for discoverable servers |
| + | Onboarding & explore — New (non-guest) users with no servers see onboarding screen (create server, explore community); temp/guest users go straight to Explore page; localStorage `nepsis_onboarding_completed` marks onboarding done |
| + | Voice icon fixes — Mic/headphones icons no longer snipped; MicOffIcon (mic+slash) instead of speaker/bell when muted; correct icons in UserPanel, ChannelList, VoiceView |
| + | End-call icon — Removed diagonal slash from end-call button in VoiceView and ChannelList; uses plain phone-down (hang up) icon |
| + | Speaking indicator fix — Green ring around avatar when talking was missing because AudioContext starts suspended in browsers; added `audioCtx.resume()` when suspended; lowered threshold to 8; smoothing for less flicker |
| + | Voice & invite fixes — Main screen shows all participants (room-peers + peer-joined add before stream); sidebar polls every 2s when in voice; invite creation shows actual error (e.g. missing server_invites table) |
| + | Sound effects — Web Audio API notification sounds: message ding, voice join/leave chimes, voice connected/disconnected tones; no external audio files needed |
| + | Mute/deafen SFX — Soft Web Audio ticks on mute, unmute, deafen, undeafen (UserPanel + call overlay); one cue when both states change; respects Voice sounds pref |
| + | P2P + TURN — Server voice and DM calls stay WebRTC mesh (P2P). Optional TURN via `GET /api/webrtc/ice` (`TURN_*` env) or `VITE_TURN_*` so strict NAT still connects; STUN always on |
| + | Blank-screen fix — Login GSAP fade could leave `showLogin`/`showApp` both false after logout; always show login when logged out; ErrorBoundary for render crashes |
| + | Prod “Load failed” — Vercel still pointed at removed Fly.io API; login now maps Safari “Load failed” to a clear API unreachable message; fix is set live `VITE_API_URL` + redeploy |
| + | Railway deploy guide — Backend root `backend`, `npm start`, generate domain, set Supabase + CORS; point Vercel `VITE_API_URL` at `https://…railway.app/api` |
| + | Voice single-session — Joining voice from another device kicks the old socket (`voice-session-replaced`); fixes duplicate “Connecting…” ghosts (listen before join, no socketId userIds) |
| + | Private DM calling — 1-on-1 voice calls via WebRTC; new `/calls` socket namespace; incoming/outgoing call overlays with ringing; in-call bar with mute/deafen/end; auto-decline after 30s timeout; busy/offline detection; Call button in member profile and right-click context menu |
| + | Call notifications — Browser Notification when incoming call received while app is in another tab; permission requested on socket connect |
| + | Friends page — Click Nepsis logo to open Friends page; list friends and pending friend requests; accept/decline requests; Message and Call buttons for friends |
| + | Friends page v2 — Discord-like home: Nepsis logo opens Friends view with tabs (All, Pending, Online, Add Friend). Add Friend by username; Online shows friends with presence. DMs live in Friends view; clicking a DM shows chat while keeping DMs + servers in sidebar. Backend: user lookup by username (GET /users/lookup); friends list includes presence (online/in-voice/away/dnd/offline) |
| + | DM notifications — New DM messages light up the conversation in the sidebar; unread count badge; notification sound; Direct Messages header shows total unread |
| + | DM UI modernized — Gradient header, rounded message bubbles, relative timestamps, improved empty state |
| + | DM chat spacing — Group consecutive messages from same sender; hide avatar/username/timestamp for subsequent messages in group; mb-1.5 between same-sender messages, mb-3 between different senders |
| + | Text channel unread indicators — New messages highlight channel in white in sidebar; ChatView scrolls to bottom on load; "New messages" indicator when scrolled up; click to jump to start of new messages |
| + | Profile pictures everywhere — User avatars display in voice channels (grid + sidebar list), ChatView messages, DM list/header/messages, MembersSidebar, MemberProfilePanel, CallOverlay (outgoing/incoming/in-call). Pass avatar_url through voiceUsers, members, and CallContext. |
| + | Server icon and banner — Server Settings > Overview: upload server profile picture (icon) and banner. Backend PATCH supports icon_url and banner_url; migration adds banner_url to servers table. |
| + | Bug reports — User Settings > Help & Support: Report a Bug form. Submits to `bug_reports` table (Supabase); sends title, description, user info, URL, user-agent to devs. Migration `20250211000008_bug_reports.sql`. |
| + | Soundboard — Voice channel soundboard: play custom audio clips to all peers. Users can upload sounds (max 10 seconds). UI in VoiceView bottom bar (music-note button). Backend: `soundboard_sounds` table, API routes, Socket.io `soundboard-play` event. Migration `20250211000009_soundboard_sounds.sql`. **Revamp:** Emoji per sound (picker when adding/editing); spam-click restarts playback; everyone hears sounds. Soundboard mute control removed from voice bar (deafen still silences soundboard). Migration `20250211000014_soundboard_emoji.sql`. |
| + | Profile media sync — My Account avatar/banner uploads also update the active `user_profiles` row so members list shows the new photo; Profiles tab auto-saves photo/banner on upload; server icon upload shows errors like banner; member profile panel shows banner. |
| + | Pre-login landing — White split screen before auth: large Nepsis logo (left) + Use Web App / Download App (right). Syne + Figtree; GSAP entrance. `WelcomeLanding.tsx`; Use Web App opens existing login form. |
| + | Landing → auth/download GSAP — Use Web App slides landing out + auth in (Guest pill positioned on enter); Download App slides up into DownloadPage; Back/Open web app reverse. |
| + | Desktop Win+Mac — Electron packages Windows NSIS + macOS DMG/ZIP; bundled UI uses `.env.desktop` (live API) so the app matches the browser; top Nepsis update badge with download progress via `electron-updater` + GitHub Releases. |
| + | Presence + ping — Optimistic self-presence + Realtime on `user_presence` so you show Online/In voice immediately; voice session kick + Connecting ghost fixes; ping bars are 3 green / 2 yellow / 1 red with hover tooltip (ms); socket RTT when alone in voice. Migration `20250211000017_user_presence_realtime.sql`. |
| + | Voice UI v6 — Resizable panels: screen share vs participant cameras (drag divider to resize); single participant centered in middle; remote screen shares shown in main area; participant cards (2–4) resizable horizontally; `react-resizable-panels` with `autoSaveId` for layout persistence. |
| + | Discord-style screenshare + self in voice — Click LIVE / participant tile to watch a share (not auto-forced); resizable stage; LIVE badges in channel list; late joiners receive camera/screen via `extraOutbound` tracks; self always injected into voice user list + members overlay. |
| + | OS install CTAs + Desktop Release CI — Download page / landing / banner auto-detect Mac vs Windows, show Apple/Windows logos and “Install for Mac/Windows”; GitHub Action builds both installers and publishes a GitHub Release. |
| + | First public desktop release **v0.1.0** — `NepsisChat-Setup.exe` (Windows) + `NepsisChat-0.1.0.dmg` (macOS arm64) on GitHub Releases; `/releases/latest` resolves for the download page. |
| + | Download UX — Primary Install for Mac/Windows (OS-detected) starts the installer download immediately; **Other Installers** expands alternate platforms; Linux shows Coming soon with logo. Assets in `frontend/public/icons/`. |
| + | Mac “damaged” fix — Ad-hoc codesign (`identity: "-"`) for DMG builds; download page shows `xattr -cr` Gatekeeper workaround; bump desktop to **0.1.1**. |
| + | Desktop shell v0.1.2 — Custom Discord-like title bar (min/max/close); Windows taskbar uses `icon.ico` + AppUserModelId; packaged app skips pre-login landing and Guest (Sign In / Sign Up only); presence upsert retries + 25s heartbeat for instant cross-device visibility. |
| + | Voice UI v7 + update restart — Call participants are circle frames only (no boxed tiles); mute badge sits outside the avatar clip; mic control uses Mic/MicOff icons. Members API falls back to `users.username` (and signup seeds `display_name` + personal profile) so new accounts no longer show as “Unknown”. Presence merge no longer drops peers after session-replace `peer-left`. Desktop **0.1.3**: Restart to update raises z-index above the title-bar drag region, sets `no-drag`, and hardens `quitAndInstall` (detach close-to-tray, fallback `app.exit`). |
| + | Server Settings ownership fix — `servers.owner_id` keeps owner admin UI even when members poll fails/clears; do not wipe members/servers on transient API errors; modal uses a server snapshot so it is not unmounted mid-edit; create-server fails closed if owner membership cannot be inserted. |
| + | Community Explore details — Click a community server to open a details panel (members, online, channels, owner, rules note) with Join/Open. `GET /servers/community` includes counts; `GET /servers/:id/preview` for full preview. Invite links (`GET /invites/:code`) include `memberCount` on the invite page. |
| + | Voice namespace Map fix — `socketsForUser` crashed on join (`io.sockets.sockets is not iterable`) because handlers get the `/voice` Namespace (`.sockets` is already the Map). Railway restart loop hid other members. Iterate `io.sockets.values()`. |
| + | Member profile popout — Clicking a member opens a Discord-style floating card to the left of their name (GSAP), not a right rail. Owner/admin get Kick + Ban with confirm; ban uses `server_bans` and blocks rejoin. Migration `20250211000019_server_bans.sql`. |
| + | Update badge false positive — After installing an update, “Update available” stayed because check IPC treated any feed `version` as available. Now requires `isUpdateAvailable` + newer-than-installed; `update-not-available` clears the overlay. |
| + | DM realtime + call/media polish — DM RLS policies so Realtime delivers instantly; DM spacing cleanup; voice/call leave+auto-rejoin on refresh; camera square tiles + click maximize; screen share signaling + renegotiation fixes. Migration `20250211000020_dm_rls_policies.sql`. |
| + | Rules channel — Owner/admin can create a Rules channel (read-only; members react only). Server Settings > Rules Channel: set rules channel, lock all channels until members accept, choose accept emoji (any emoji). Migration `20250211000010_rules_channel.sql`. |
| + | Server list reorder — Click-hold-and-drag server icons in the left sidebar to reorder; order persisted in `server_members.display_order`. Migration `20250211000011_server_members_display_order.sql`. |
| + | Create server UI modernized — CreateServerModal: gradient accent bar, refined layout, loading spinner, improved error styling, accessibility; OnboardingPage uses modal instead of `prompt()` for server name. |
| + | Display name — User Settings > My Account: editable display name (separate from username). Others see display name in chat, voice, DMs, member lists. Username stays for login. Migration `20250211000013_user_display_name.sql`. |
| + | Sign in via username — Registered users can sign in with username + password (not just email). Sign In form accepts "Email or username"; backend looks up email by username and authenticates via Supabase Auth. |
| + | **Fly.io removed** — Backend now self-hosted only. Removed fly.toml, scripts/deploy.js, npm run deploy. Updated docs (deployment.md, commands.md, errors-solutions.md). Frontend .env.production defaults to localhost:3000. See deployment.md for Node.js and Docker options. |

---

## Guest Account Logout

Guest accounts are temporary. When a guest user clicks **Logout**:

1. A confirmation dialog warns that the account will be **permanently deleted**
2. On confirm, the backend endpoint `DELETE /api/auth/guest/:userId`:
   - Verifies the user is a guest (`is_guest: true`)
   - Removes the user from **all** `server_members` entries (leaves every server)
   - Deletes the user row from the `users` table
3. The frontend clears local state and `localStorage`, returning to the login screen

**Email users** log out normally (Supabase Auth sign-out) — their account is preserved.

### Files involved

| File | What |
|------|------|
| `backend/src/routes/auth.js` | `DELETE /auth/guest/:userId` endpoint |
| `frontend/src/services/api.ts` | `deleteGuestAccount()` API call |
| `frontend/src/contexts/AppContext.tsx` | `logout()` — calls delete for guests, signOut for email |
| `frontend/src/components/ChannelList.tsx` | User panel + logout button + confirmation dialog |

---

## Messaging v3 (Edit, Reply, Reactions, Attachments)

### Features

| Feature | Description |
|---------|-------------|
| **Edit message** | Authors can edit their own messages. Inline edit with Save/Cancel. |
| **Delete message** | Authors can delete their own; owner/admin can delete any message in the server. |
| **Reply** | Click "Reply" on a message to quote it. Reply shows "Reply to X: content..." above the new message. |
| **Reactions** | Add emoji reactions (+ button or click existing). Quick emojis: 👍 ❤️ 😂 😮 😢 🔥. Toggle on/off. |
| **File upload** | 📎 button: upload images, GIFs, videos (mp4/webm), PDFs, text. Stored in Supabase Storage bucket `attachments`. |
| **Attachments display** | Images render inline; videos show with controls; files show as links. |
| **Realtime** | Supabase Realtime for messages and reactions — instant updates. |
| **Reply** | Click Reply shows full parent message preview; reply in chat is clickable to scroll to original. |
| **Emoji picker** | Extended emoji picker (8 categories, 300+ emojis); 😀 button for inserting emojis in messages. |
| **Custom emojis** | Server owners/admins can upload custom emojis (server settings → Custom Emojis). |

### Database (migration v3)

| Table/Column | Purpose |
|--------------|---------|
| `messages.edited_at` | When message was last edited |
| `messages.reply_to_id` | FK to parent message |
| `messages.attachments` | JSONB array of `{url, type, filename}` |
| `message_reactions` | (message_id, user_id, emoji) — composite PK |
| `user_presence` | (user_id, status, voice_channel_id) — online/offline/in-voice |
| `server_bans` | (server_id, user_id, banned_by, reason) — blocks invite/community rejoin after ban |
| `dm_messages` | Realtime + RLS SELECT policies required for live DMs (anon client) |

### Storage

Create a bucket **`attachments`** in Supabase Dashboard → Storage (public) for file uploads.
Use subfolder `emojis/{serverId}/` for custom server emojis.

### Server creation & emojis (email users only)

- **Guest users** cannot create servers. The + button is hidden.
- **Email users** can create servers and upload custom emojis.
- Custom emojis: Server Settings → Custom Emojis. Upload PNG/GIF/JPG/WebP (max 256KB).

### Supabase CLI migrations

Project includes `supabase/` folder for CLI:

```bash
supabase init    # if not already done
supabase link    # link to your project
supabase db push # apply migrations
```

Migrations are in `supabase/migrations/`. Also run `backend/supabase-migration.sql` in Supabase SQL Editor for full schema.

**Privacy / dual profiles:** run these in the Supabase SQL Editor:
1. `supabase/migrations/20250211000015_privacy_profiles_friends.sql` — privacy settings, friend visibility, `users.active_profile`
2. `supabase/migrations/20250211000016_profile_identities.sql` — profile bio/discoverable, `friend_requests.addressee_profile`, `server_members.profile_type`

**Identity model:** Login username is private. Personal and Work are separate public identities (display name, bio, avatar, banner). Friend search finds discoverable **profiles** by display name. Default profile (My Account) is used on first server join; each server can override via ChannelList → “Appear as on this server”.

---

## Roles & Server Members

| Role | Permissions |
|------|-------------|
| **owner** | Full control; can kick admins and members; cannot be kicked |
| **admin** | Can kick members; cannot kick owner or other admins |
| **member** | Standard access; can edit/delete own messages |

### Activity Status

- **Online** — User is in the app
- **Offline** — No recent presence
- **In voice** — User is in a voice channel

Presence is updated via `PUT /api/users/:id/presence`. App calls it when user connects and when joining/leaving voice.

### Members Sidebar

Shows all server members with: avatar, username, role badge, status indicator, kick button (for owner/admin only).

- **Minimizable** — Click the arrow in the header to collapse to a narrow bar; click again to expand
- **Member profile** — Click a member to open a profile panel on the side with:
  - Avatar, username, role, status
  - **Message** — Opens DM (creates conversation; full DM UI)
  - **Add Friend** — Sends friend request (requires `friend_requests` migration)

### Auto-join

When a user selects a server they're not a member of, they are auto-joined as `member`.

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

---

## Discord-like UI Features (v2)

A major UI overhaul to match Discord's layout and interaction patterns.

### Features Implemented

| Feature | Description |
|---------|-------------|
| **Server Creation** | + button in ServerBar opens CreateServerModal. Creates server with default "Text Channels" and "Voice Channels" categories, plus a #general text channel and a General voice channel. |
| **Channel Categories** | Collapsible sections that organize channels. Categories have a name and order. Click the arrow to collapse/expand. |
| **Create Channel** | + button next to each category header, or via server dropdown menu. Choose text or voice type. |
| **Create Category** | Via server dropdown menu. Adds a new collapsible section to organize channels. |
| **Server Settings** | Click the server name header to open dropdown → "Server Settings". Full-screen modal with rename and delete. Only visible to server owner. |
| **User Panel** | Bottom-left panel showing: avatar, username, online status, mute button, deafen button, settings gear. Exactly like Discord. |
| **User Settings** | Gear icon in user panel opens full-screen settings: My Account, Profiles, Appearance, Voice & Video, Notifications, Log Out. |
| **One-Click Voice Join** | Clicking a voice channel in the channel list instantly joins voice (no "Join Voice" button needed). |
| **Voice Users in Channels** | Users connected to a voice channel are shown nested under that channel in the channel list. |
| **Voice Connection Bar** | When connected to voice and viewing a different channel, a compact bar shows: green "Voice Connected" indicator, channel name, disconnect button, camera toggle, screen share toggle. |
| **Camera** | Toggle camera on/off in voice view or voice connection bar. Video shows in a grid. |
| **Screen Share** | Discord-style: sharers get a LIVE badge; others click LIVE (sidebar or tile) to watch. Watching opens a resizable stage (drag divider). Auto-focus only for your own share. Late joiners still receive the track. Auto-stops when user cancels via browser UI. |
| **Voice participant grid** | Participants in a voice call appear in a Discord-style square grid that fills the center of the screen. Avatar tiles with speaking indicator ring. |
| **Server Tooltips** | Hover over server icons to see server name tooltip (like Discord). Active indicator pill on left side. |

### Database Changes (v2 migration)

| Table | Purpose |
|-------|---------|
| `categories` | Channel categories (id, server_id, name, order) |
| `server_members` | Tracks server membership (server_id, user_id, role, joined_at) |
| `channels.category_id` | New column linking channels to categories |

### Backend Endpoints (new)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/servers` | Create a new server |
| PATCH | `/api/servers/:id` | Update server (name, icon) |
| DELETE | `/api/servers/:id` | Delete server (cascades) |
| POST | `/api/servers/:id/channels` | Create a channel |
| DELETE | `/api/servers/:serverId/channels/:channelId` | Delete a channel |
| GET | `/api/servers/:id/categories` | Get server categories |
| POST | `/api/servers/:id/categories` | Create a category |
| DELETE | `/api/servers/:serverId/categories/:catId` | Delete a category |

### Architecture Notes

- **VoiceContext** is separate from AppContext for clean separation of concerns
- Voice state is global — user can be in a voice channel while viewing a text channel
- VoiceProvider wraps the main layout (requires userId/username, so it's inside the auth check)
- One-click voice join: clicking a voice channel in ChannelList calls `voice.joinVoice()` + `setCurrentChannel()`
- Camera and screen share use `getUserMedia` and `getDisplayMedia` respectively
- Server creation auto-generates default categories and channels on the backend

### Files Modified

| File | Changes |
|------|---------|
| `backend/supabase-migration.sql` | Added categories, server_members tables, new RLS policies |
| `backend/src/routes/servers.js` | Full CRUD for servers, channels, categories |
| `frontend/src/types/index.ts` | Added Category, VoiceParticipant types, categoryId on Channel |
| `frontend/src/services/api.ts` | Added createServer, createChannel, createCategory, delete functions |
| `frontend/src/contexts/AppContext.tsx` | Added categories state, CRUD functions for servers/channels/categories |
| `frontend/src/contexts/VoiceContext.tsx` | **NEW** — Global voice state management |
| `frontend/src/components/ServerBar.tsx` | Rewritten with create server modal, tooltips, active indicators |
| `frontend/src/components/ChannelList.tsx` | Rewritten with categories, voice users, server dropdown, voice connection bar |
| `frontend/src/components/VoiceView.tsx` | Added camera, screen share, uses VoiceContext |
| `frontend/src/components/UserPanel.tsx` | **NEW** — User avatar, mute, deafen, settings gear |
| `frontend/src/components/CreateServerModal.tsx` | **NEW** — Server creation modal |
| `frontend/src/components/CreateChannelModal.tsx` | **NEW** — Channel creation modal (text/voice type picker) |
| `frontend/src/components/ServerSettingsModal.tsx` | **NEW** — Full-screen server settings |
| `frontend/src/components/UserSettingsModal.tsx` | **NEW** — Full-screen user settings |
| `frontend/src/App.tsx` | Rewired with VoiceProvider, UserPanel, voice users, one-click join |
