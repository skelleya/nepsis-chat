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
| + | Delete Account — User Settings → My Account Danger Zone; `DELETE /api/auth/account/:userId` purges owned servers, DMs, messages, memberships, and Supabase Auth user when linked |
| + | Invite join remount fix — After joining via `/#/invite/:code`, home remounts `AppContent` with session intact (`showApp` from existing user); pending invite survives “Log In to Join” |
| + | Voice focus layouts — Camera auto-maximizes to a large stage + filmstrip; screen + camera dual stage; self PiP; avatar placeholder instead of black tiles; cached MediaStream subsets |
| + | DM polish — Realtime DM reactions; Call/Video Call in DM header; expand in-call panel; click message to reply; Add Friend CTA under All friends. Migration `20250211000021_dm_reactions_reply.sql` |
| + | Chat/DM file download — `FileAttachment` adds Download on images, videos, and files in channel chat and DMs |
| + | Voice audio/camera fix — Stop misclassifying cameras as screens; keep remote audio mounted across focus layouts so peers stay audible/visible |
| + | WebRTC glare fix — Dual offer + always-rollback broke join media for guests and registered users; polite peer + single offerer restores audio/camera |
| + | Discord-like UI overhaul — server creation, channel categories, voice user display, user panel, server settings, camera/screen share |
| + | Messaging v3 — edit/delete messages, reply, emoji reactions, file/image uploads, owner/admin can delete any message |
| + | Roles & members — server members list with roles (owner/admin/member), activity status, kick (owner/admin only) |
| + | Messaging v4 — Supabase Realtime for instant reactions & messages; video upload; reply shows full parent; extended emoji picker (basic + OpenMoji-style); server creation restricted to email users; custom server emojis (owner/admin upload) |
| + | Voice UI v2 — Discord-style square grid for participants filling center; members sidebar minimizable; member profile panel with Message and Add Friend |
| + | Voice fix v3 — Fixed remote video/screen share display; combined remote MediaStream per peer prevents audio loss when video tracks arrive; ParticipantCard shows video when camera/screen active; track.onmute fallback for cross-browser compat |
| + | Voice UI v3 — End-call icon for disconnect; mic/headphone icons for mute/deafen; show users in voice channels before joining; drag channels to reorder; right-click user context menu (Message, Add Friend, Kick, Move to Channel); admin can move users between voice channels via right-click |
| + | Admin voice controls — Owner/admin can mute users in voice (force-mute) and disconnect them from voice. Right-click participant in VoiceView or member in MembersSidebar; backend emits admin-mute and admin-disconnect-from-voice via Socket.io. |
| + | Category & channel management — Server owners can: reorder categories (drag); reorder channels within/between categories (drag); edit/delete categories and channels (3-dot menu); drag voice users from one voice channel to another (admin only) |
| + | Channel rail v2 — Non-Discord layout: rounded channel rows, chat/wave icons, title-case section headers, orange selected accent. Voice users show a side **⋯** menu (Move to… / Server Mute / Disconnect for admins; Watch Live when sharing); drag-drop move kept as secondary. |
| + | White theme — Appearance → Color theme includes **White** (light surfaces). CSS tokens `--app-glass` / `--app-panel` keep overlays and menus readable across dark and light. |
| + | Voice user context menu — Right-click name in channel rail (no ⋯). Options: Profile, Roles, Move to, Message, Call, Watch Live; admins also Server Mute / Server Deafen / Disconnect / Kick / Ban. Move primarily via drag-drop. Channel hover gear for rename/copy ID/move category/delete. Create channel modal centered; type locked from which + was clicked. |
| + | High-quality media — Opus preferred; audio ~128 kbps / 48 kHz; camera 720p–1080p @ ~2.5 Mbps; screen share ~4 Mbps + `contentHint`. `mediaQuality.ts` applies codec prefs + sender bitrates on peer connections. |
| + | CoolIcons — UI icons from CoolIcons Free Iconset (Figma / Iconify `ci`) via `CoolIcon`; voice controls + members rail migrated. |
| + | Members sidebar v2 — Grouped In Voice / Online / Offline; minimized rail shows avatar stack + count (CoolIcons chevrons). |
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
| + | Mic processing presets — Voice settings now use Discord-like `Off / Standard / High` mic cleanup presets; live voice sessions try `applyConstraints()` first and then reacquire/replace the outbound mic track if the browser rejects the change |
| + | Voice clipping fixes — Minimized member status dots and voice speaking rings now live outside clipped avatar/video wrappers so badges and glows are no longer cut off |
| + | DM friend bios — 1:1 DM profile popouts can show a friend's resolved banner/bio/profile presentation, while non-friends still do not receive friend-only bio data |
| + | **Full audit fix pass** — Default accent Nepsis orange; Appearance UI wired; Discord hexes → `--app-*` tokens; GSAP on Create Channel / Server Settings / menus / Friends+Community exits / Call overlays; DM ICE flush; ghost Connecting fix (`leftUserIds`); late-joiner screen-share in `room-peers`; click-to-watch (no remote auto-watch); remote mute via `voice-state`; voice↔call gate; socket reconnect rejoin; video-call rejoin keeps `withVideo`; mobile slide-over rails; Block/Report + Privacy blocked list; docs SQLite→Supabase |
| + | **UI polish** — Friends logo invert when selected; User Settings portaled (was trapped by rail transform); DM name opens profile popout; Friends tabs GSAP pill/slide; compact Add Friend |
| + | **Typography** — Headers: TWK Everett (self-hosted `/fonts`); body/paragraphs: Poppins. Space Grotesk fallback until TWK files are added. |
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
| + | Discord chat layout — DM + server chat use Discord-style message stream and composer (+ inside field, no send button). Selecting a text/voice channel closes any open DM. |
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
| **User Settings** | Gear icon in user panel opens full-screen settings: My Account, Profiles, Appearance, Voice & Video, Notifications, Log Out. **My Account → Danger Zone** deletes the account after username confirmation (servers you own are removed). |
| **One-Click Voice Join** | Clicking a voice channel in the channel list instantly joins voice (no "Join Voice" button needed). |
| **Voice Users in Channels** | Users connected to a voice channel are shown nested under that channel in the channel list. |
| **Voice Connection Bar** | When connected to voice and viewing a different channel, a compact bar shows: green "Voice Connected" indicator, channel name, disconnect button, camera toggle, screen share toggle. |
| **Camera** | Toggle camera on/off in voice view or voice connection bar. Turns on a large focus stage (cover) with a participant filmstrip; click a tile to switch focus. Avatar shows until the first frame. |
| **Screen Share** | Discord-style: sharers get a LIVE badge; others click LIVE (sidebar or tile) to watch. Full stage shows the whole screen (`object-contain`); active cameras sit in the top filmstrip; one camera PiP is bottom-right (sharer → self → first live cam). Clicking a filmstrip camera swaps the PiP. Auto-focus own share. Late joiners still receive the track. |
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

---

## Voice, Media, Profiles, and Settings Reliability (2026-07-23)

### Features

| Area | Behavior |
|------|----------|
| Speaking indicator | Remote audio is analysed in `VoiceContext`; the left voice-channel rail now receives live `isSpeaking` state and lights the avatar ring. |
| Camera off | Video tiles clear their last frame on mute/end/removal and return to the avatar instead of freezing. |
| Media quality | Voice & Video settings offer 1080p/1440p camera and 1080p/1440p/4K screen capture. WebRTC sender limits scale up to 8 Mbps camera and 16 Mbps screen. Browser/device/network fallback is expected. |
| Soundboard clipper | Audio over 10 seconds opens a start-time editor; preview and export create a server-valid WAV clip of at most 10 seconds. MP3, WAV, OGG, WebM, M4A/MP4, AAC, and FLAC are accepted. |
| Quick profile | The User Panel status menu also switches Personal/Work profile and immediately refreshes display name, avatar, and banner. |
| Server media | Server icon/banner updates paint optimistically and survive a failed follow-up list refresh. |
| Settings dropdowns | Portaled lists sit above settings dialogs and stay aligned while scrolling. |
| Members rail | The right rail fills the viewport and shows a useful empty state rather than black/blank space. |
| Icons | Muting uses a microphone-with-slash glyph; text channels use a padded hash glyph. |

### Database and storage

- Migration `20260723234108_allow_soundboard_audio_formats.sql` extends any existing `attachments` MIME allowlist with audio formats. A `NULL` allowlist remains unrestricted.
- `soundboard_sounds.duration_seconds` remains constrained to `0 < duration <= 10`; clipping happens before upload.
- Storage is still the public `attachments` bucket under `soundboard/{userId}/`.

### Manual test study

1. Join one voice room with two accounts; speak remotely and confirm the left rail ring lights.
2. Toggle the remote camera off and confirm the last frame immediately becomes the avatar.
3. Select each media quality preset, restart capture, and inspect `MediaStreamTrack.getSettings()`.
4. Upload a 15-second MP3, move the clip start, preview, save, and verify the stored duration is at most 10 seconds.
5. Switch Personal/Work from the User Panel and verify name/avatar/banner; upload server icon/banner and refresh.
6. Open every settings dropdown while scrolling; test the members rail with zero and many members.

### Verification study

- `frontend`: `npm ci`, then `npm run build` — passed TypeScript and Vite production build.
- `backend`: `npm test --if-present` — passed (no test script is currently defined).
- `backend`: `node --check src/routes/soundboard.js` — passed.
- Supabase: migration recorded as `allow_soundboard_audio_formats`; `attachments` is public, 50 MiB, and has `allowed_mime_types = NULL` (unrestricted, therefore MP3 and all supported audio are allowed).
- Supabase advisors reported pre-existing project-wide RLS/index notices; this bucket metadata migration introduced no table, policy, or index changes.
- `npm ci` audit reported 11 existing dependency advisories (2 low, 1 moderate, 8 high); dependency upgrades were not mixed into this feature pass.
- Build warnings remain for optional Everett font files, large bundle size, stale Browserslist data, and modules that are both static/dynamic imports. They do not fail the build and are outside this fix set.

### Soundboard duration parser correction (2026-07-24)

`music-metadata` v11 defaults to a fast metadata pass. Valid MP3/AAC files without a duration header could therefore return `format.duration = undefined`, and the API incorrectly reported `0.0s`. The soundboard route now supplies the uploaded buffer size and enables full duration scanning with `{ duration: true }`. Unknown duration and over-ten-second files have separate error messages.

Verification: generated a three-second constant-bitrate MP3 without a Xing header (`ffmpeg -write_xing 0`) and parsed it with the production options; detected duration was `3.030s`. `node --check src/routes/soundboard.js` also passed.

### Remote camera startup correction (2026-07-24)

The camera-freeze guard initially excluded `MediaStreamTrack.muted` tracks from the remote video count. Browsers may keep a newly negotiated receiver muted until RTP begins and a video element is attached, creating a deadlock where the tile never mounted. Remote camera tiles now mount for every live track. `TileVideo` continues to hide its frame on mute/end/removal and shows the avatar until `playing`, so camera-off still cannot leave a frozen frame.

Verification: `frontend npm run build` passed TypeScript and the Vite production build. Existing font, bundle-size, Browserslist, and mixed-import warnings remain non-fatal.

### Camera orientation (2026-07-24)

Camera self-previews now default to natural/unmirrored orientation. Voice & Video settings includes “Mirror my camera preview” for users who prefer a mirror. The preference updates local voice tiles, maximized self camera, self PiP, and DM call PiP immediately. It is intentionally display-only: remote viewers continue to see the natural camera orientation, and screen shares are never mirrored.

Verification: `frontend npm run build` passed TypeScript and the Vite production build.

### Group direct messages (2026-07-24)

Users can create a group from the **+** beside Direct Messages and add more friends from the open group header. Groups require the creator plus at least two friends and support at most 10 participants.

Architecture:

- Migration `20260724004517_group_direct_messages.sql` adds `is_group`, optional `name`, `created_by`, `updated_at`, participant `joined_at`, and lookup indexes.
- Backend conversation responses now contain `participants[]`; `other_user` remains for 1:1 compatibility.
- New APIs create groups, add validated users, and rename groups after participant checks.
- `GroupDMModal` loads the existing friends list and supports multi-select creation/add flows.
- `DMView` uses participant-specific avatars and mention data. Group calls, Block, and Report are intentionally not presented as group-wide actions.

Manual test study:

1. Click Direct Messages **+**, select two friends, optionally name the group, and create it.
2. Verify all three users see the group, sender names/avatars are correct, mentions list all other participants, and unread notifications identify the actual sender.
3. Click **Add people**, confirm existing members are excluded, add another friend, and verify the header/sidebar update.
4. Confirm a normal 1:1 DM still opens separately and Call/Video remains available only there.
5. Attempt creation with fewer than two friends, duplicate IDs, missing users, or more than 10 total members; the API must reject invalid input.

Verification study:

- `frontend npm run build` passed TypeScript and the Vite production build after normalizing nullable participant avatars.
- `backend node --check src/routes/dm.js` passed; no backend test script is currently defined.
- Supabase migrations `group_direct_messages` and `group_dm_created_by_index` were applied successfully.
- Remote schema verification confirmed all group columns and three new indexes (`participant user`, `group updated`, and `created_by`).
- Supabase advisors were rerun. The new creator foreign key warning was resolved with the follow-up index; remaining security/performance notices predate this feature and are documented project-wide issues.

### Multi-tab voice, soundboard, screen audio, and modern media/chat UI (2026-07-24)

Features and fixes:

- One browser tab remains the voice-media owner; same-account tabs observe its channel through a heartbeat and show the account in the correct room without replacing the live mic session.
- Soundboard MP3 uploads accept desktop `application/octet-stream` when the extension is a supported audio format; metadata remains mandatory.
- Sound clips play once: local sender playback plus peer-only socket relay, with shared restart/dedup behavior.
- Voice & Video settings can request tab/system audio during screen sharing.
- Camera galleries use responsive modern cards; screen/camera dual focus stacks on mobile and uses a wide stage split on desktop; self PiP sits at the lower right.
- DMs and server channels share cleaner translucent headers, lighter dividers, lower-noise hover states, compact-density row spacing, 15px message typography, and a bordered modern composer.

Test study:

1. Join voice in tab A, open the same account in tab B, and verify both tabs show self in the same channel while tab A keeps its microphone.
2. Close tab B and verify tab A stays `in-voice`; open the room in tab B and verify it remains observer-only.
3. Upload MP3 as both `audio/mpeg` and `application/octet-stream`; play from A and verify A/B each hear exactly one instance.
4. Enable/disable screen audio, share a browser tab that supports audio, and confirm peers hear audio only when enabled and selected in the native picker.
5. Exercise voice layouts with 1, 2, 4, and 8 participants, camera-only, screen-only, dual camera/screen, mobile width, and desktop width.
6. Verify DM/server messages, replies, reactions, uploads, editing, compact density, white theme, mobile hover actions, and new-message scrolling after the visual revamp.

Verification results:

- `frontend npm run build` passed TypeScript and the Vite production build (181 modules).
- Backend syntax checks passed for `soundboard.js`, `voice.js`, and `dm.js`; no backend test script is currently defined.
- Existing non-fatal build notices remain: optional Everett font assets, stale Browserslist data, mixed static/dynamic imports, and the large main bundle.

### Accurate ping, GIF picker, and desktop 0.1.4 (2026-07-24)

Ping:

- `connectionStats.ts` prefers selected/nominated ICE candidate-pair RTT, falls back to RTCP media RTT, and only then a succeeded pair.
- Voice mesh displays the slowest active peer path so one poor connection is not hidden. It never substitutes signaling-server latency while a peer exists.
- Alone-in-channel latency is labeled server RTT. DM calls now sample the same WebRTC stats locally on both parties and display ping beside call duration.
- Different values on each party are expected and accurate for asymmetric network routes.

GIFs:

- Server and DM composers have a GIF button backed by `GifPicker`.
- Search is proxied through `/api/gifs/search`, keeping `TENOR_API_KEY` server-side.
- Selected GIFs are downloaded only from Tenor media hosts, validated as GIF bytes with an 8 MiB cap, and copied to public Supabase storage before sending.
- Direct `.gif` upload remains available when Tenor is not configured.

Release:

- Electron source version is `0.1.4`.
- Release notes: [release-0.1.4.md](release-0.1.4.md).
- Pushing tag `v0.1.4` triggers the Desktop Release workflow to build Windows/macOS artifacts and publish the GitHub Release.

Test study:

1. Two voice users compare local ping values and tooltips; verify selected WebRTC RTT, no server fallback during ICE, smoothing, clearing after disconnect, and slowest-path behavior with 3+ users.
2. Start a DM audio/video call; verify both parties independently show ping and clear it after hanging up.
3. Search/select GIFs in a server and DM; verify Tenor key stays backend-only, imported URLs use Supabase, animation renders, and invalid/non-Tenor/oversized inputs are rejected.
4. Remove `TENOR_API_KEY`; verify the picker explains configuration and direct GIF upload still works.

Verification results:

- Frontend TypeScript and Vite production build passed (183 modules) after active ICE-pair selection and source-aware smoothing.
- Backend syntax checks passed for GIF routes, app mounting, voice, calls, soundboard, and group DMs.
- Electron dependencies installed successfully for version 0.1.4; the repository has no separate Electron build script outside the packaging workflow.
- GIF import review added manual redirect validation, streamed byte limits, known-user checks, and per-user/IP rate limits before release.
- Existing dependency audit reports remain documented and are not silently auto-fixed because forced upgrades would change Electron/build compatibility.

### Ping path visibility + OS mic “permission denied by system” (2026-07-24)

Architecture reminder:

- Voice/DM audio is **WebRTC mesh P2P**. The backend is **signaling only** (Socket.io). Optional **TURN** relays media when direct ICE fails — that improves connectivity, not best-case ping.
- Best ping: direct path (`host` / `srflx`), same region, wired, avoid VPN. Hover voice ping bars to see path type; `relay` means TURN (usually higher RTT). Mesh UI shows the slowest peer.

Fixes:

- Voice join / camera / call / screen errors map `Permission denied by system` and related DOMExceptions to OS privacy guidance (`formatMediaPermissionError`).
- `connectionStats` reports ICE path type; ChannelList tooltip shows it beside RTT.
- Electron grants media permission requests so the desktop app does not silently deny `getUserMedia`.

Test study:

1. Deny mic in Windows Privacy → join voice → see clear OS guidance (not a vague browser string).
2. Allow mic → three users join the same voice channel → each hears others; ping tooltip shows path (`host`/`srflx`/`relay`).
3. With TURN configured and a strict-NAT peer, confirm `relay` appears and audio still works.
4. Desktop: fresh install prompts/allows mic; macOS Privacy list includes Nepsis Chat.

### Theme-complete shell, collapsible channels, adaptive cameras, and stable member profiles (2026-07-24)

Changes:

- UserPanel, status border, EmojiPicker footer, server tooltips/active pills, update banner, profile panel, and settings scrollbars now use appearance tokens across Dark, Midnight, AMOLED, and White.
- Desktop channel sidebar collapses to a persistent 56px icon rail. Mobile remains a full 288px drawer.
- The compact rail retains DMs/unreads, channel icons, selected channel, active voice indicator, and compact user controls.
- Voice gallery uses container-width tiers and dual-stage container queries, so cameras adapt when channel/member rails expand or collapse.
- Video playback is retried after resize with stable stream objects and participant keys, protecting remote viewers from black/frozen remount glitches.
- Channel drag collision filtering and cross-category moves allow text/voice channels and whole categories to be arranged naturally. Admins and owners can use rename/delete controls.
- Member profile popouts exclude their clicked anchor from outside-click handling and reset GSAP close state, removing right-rail flicker.

Test study:

1. Switch every theme/accent and inspect ServerBar, ChannelList, UserPanel, chats, VoiceView, MembersSidebar, profile popout, settings, emoji picker, update banner, and white-theme contrast.
2. Collapse/expand the channel rail, refresh to verify persistence, then test mobile drawer behavior.
3. With both sidebars in every state, test 1/2/4/8 cameras, screen share, dual stage, self PiP, camera on/off, and remote viewer playback.
4. Drag categories above/below one another; move channels within/across categories by row and header; rename/delete channels and categories as owner/admin.
5. Repeatedly click the same/different member rows, scroll, open/close with Escape/outside click, and verify the profile panel never flickers or becomes stuck.

Verification results:

- Frontend TypeScript and Vite production build passed after the focused regression pass (183 modules).
- White-theme audit corrected inactive server initials, emoji category/grid states, profile surfaces, user controls, update banner, and theme-aware scrollbars.
- Profile anchors are wired for MembersSidebar, DM headers, and voice-user rows.
- Resize playback RAFs are canceled on cleanup; cross-category reorder waits for the category update to succeed.
- Existing optional font, Browserslist, mixed-import, and bundle-size warnings remain non-fatal and documented.

### Stable right-sidebar member interaction (2026-07-24)

Issue:

- Hovering a member row flickered, and a click could fail to open the member profile.
- `Section` was declared inside `MembersSidebar`. Presence/status updates therefore produced a new React component type, remounting every section and member button. A refresh between mouse-down and click replaced the target DOM node.

Solution:

- `MemberSection` now lives at module scope, giving React a stable component identity across sidebar renders.
- Member rows update in place instead of unmounting, preserving hover and click state while live presence changes.

Test study:

1. Continuously hover each In Voice / Online / Offline member while presence refreshes.
2. Click repeatedly at different points within avatar, username, status, and row padding.
3. Keep a profile open while members move between status sections; close it by outside click and Escape.
4. Verify context menus and minimized member rail still work.

### Desktop 0.1.5 release (2026-07-24)

- Electron source version: `0.1.5`.
- Release notes: [release-0.1.5.md](release-0.1.5.md).
- Includes appearance/sidebar/layout work, stable member interaction, ICE path visibility, and actionable OS media-permission handling.
- Tag `v0.1.5` triggers `.github/workflows/desktop-release.yml`, which builds Windows and macOS installers and publishes their updater metadata on one GitHub Release.

Release verification study:

1. Confirm `electron/package.json` and lockfile root both report `0.1.5`.
2. Run the frontend production build and validate the workflow YAML.
3. Merge the release commit into `master`, then tag that exact commit `v0.1.5`.
4. Confirm the Desktop Release workflow starts from the tag and its version job reports `0.1.5`.

### Stable settings menus, persistent voice navigation, and account cleanup (2026-07-24)

Settings:

- Dropdown position updates no longer replay their GSAP enter animation while the settings pane or menu scrolls.
- Redundant position state updates are skipped, menu-internal scroll is ignored, and outside-click registration is deferred past the opening event.
- Voice & Video’s `DeviceSelect` is module-scoped and memoized; the mic meter lives in `MicTestPanel` so RAF ticks cannot remount or re-animate open dropdowns.

Voice while adding friends:

- The voice session already survived Friends navigation, but the hidden `RemoteAudio` elements were inside `VoiceView` and disappeared.
- Remote playback now lives in `VoiceProvider`, alongside the WebRTC session. Users can continue hearing and transmitting while using Friends → Add Friend, DMs, Community, or settings.
- `VoiceView` no longer renders duplicate audio sinks.

Supabase data operation:

- Inspected 14 users, including 12 guests; protected `Test` and `antilink`.
- Transactionally removed the other 10 guest accounts and dependent references.
- Transferred all four existing servers to the registered `arrogamer` account and synchronized owner membership roles.
- Verified two guests remain and every server has `arrogamer` as both `owner_id` and its owner-role member.

Test study:

1. Open every settings dropdown, scroll the settings pane and menu, run the live mic meter, and select options without flicker or lost clicks.
2. Join server voice with another member, navigate to Friends → Add Friend, search/send a request, and confirm two-way audio throughout.
3. Navigate through DMs, Community, and settings while connected; verify one copy of remote audio and working mute/deafen/output-device controls.
4. Re-query guests and server owner/member roles; verify only `Test`/`antilink` guests and four `arrogamer`-owned servers.

### Silent updates, mic processing, bios, and moderation reverse actions (2026-07-24)

Desktop updates:

- Background download + restart-only modal; applying modal shows an indeterminate loading bar.
- Silent NSIS install preserves the original per-user/all-users scope (`quitAndInstall(true, true)`).

Voice & Video settings:

- Dropdown enter animation plays once per open; device options are memoized; mic meter updates are throttled to stop flicker.

Mic processing:

- Off / Standard / High preset applies immediately in voice when possible (`applyConstraints`, with replaceTrack fallback).
- High uses browser `voiceIsolation` only when supported.

Moderation:

- Server Mute/Unmute and Server Deafen/Undeafen toggle from live voice state across ChannelList, MembersSidebar, and VoiceView.

Visual / profile:

- Camera speaking rings and minimized member status dots no longer clip.
- Profile bios render in member popouts; friend DMs receive friendship-resolved bio/banner.

Test study:

1. Open Voice & Video dropdowns while the mic meter runs; scroll the settings pane; confirm no flicker.
2. Join voice, switch Off/Standard/High, and verify capture settings change without leaving the channel.
3. Admin-mute then unmute, admin-deafen then undeafen a peer; labels and target state reverse correctly.
4. Inspect filmstrip/gallery rings and minimized member dots for full borders.
5. Save a bio in Profiles, then open that member/DM profile and confirm About Me appears for friends.

### Desktop 0.1.6 release (2026-07-24)

- Electron source version: `0.1.6`.
- Release notes: [release-0.1.6.md](release-0.1.6.md).
- Includes silent auto-update UX, Voice & Video dropdown hardening, mic noise presets, unmute/undeafen, bios, and camera/status border fixes.
- Tag `v0.1.6` triggers `.github/workflows/desktop-release.yml`, which builds Windows and macOS installers and publishes their updater metadata on one GitHub Release.

Release verification study:

1. Confirm `electron/package.json` and lockfile root both report `0.1.6`.
2. Run the frontend production build and validate the workflow YAML.
3. Merge the release commit into `master`, then tag that exact commit `v0.1.6`.
4. Confirm the Desktop Release workflow starts from the tag and its version job reports `0.1.6`.

### Voice audio away from VoiceView, filmstrip rings, Windows icon (2026-07-24)

Voice audio:

- Remote sinks are portaled to `document.body` from `VoiceProvider`.
- Camera tiles stay muted; `RemoteAudio` is the only playback path.
- Main-view changes dispatch `nepsis-voice-audio-nudge` so sinks retry `play()` after Friends/DM/chat swaps.

Filmstrip:

- Speaking/focus chrome uses `ring-inset`; filmstrip scroller has inner padding so top/left edges are not clipped.

Windows desktop icon:

- `signAndEditExecutable: true` embeds `build/icon.ico` into the exe; NSIS installer/uninstaller icons use the same ICO.

Test study:

1. Join voice with cameras on; confirm filmstrip tiles show full inset rings on top/left.
2. Stay connected, open Nepsis logo (Friends), a DM, and a text channel; confirm two-way audio throughout.
3. After installing the new Windows build, confirm the desktop/Start Menu shortcut uses the Nepsis icon (reinstall if an old shortcut cached Electron’s icon).

### Server soundboard with custom names (2026-07-24)

- `soundboard_sounds.server_id` scopes clips to a server; every member sees the same list in voice.
- Upload flow asks for a **custom name** (+ emoji) before saving; rename via pencil or double-click.
- Legacy personal sounds (no `server_id`) stay owner-only until **Share** (or rename) claims them onto the current server.
- Migration: `20260724023843_soundboard_server_scope.sql` (applied).

Test study:

1. User A uploads “Airhorn” on a server voice channel; User B opens the soundboard on the same server and sees “Airhorn”.
2. Rename and emoji-edit as uploader; confirm admin can delete another member’s sound.
3. Play a sound; all voice peers still hear it.
4. Legacy personal sound shows Share; after Share it appears for other members.

### Single instance and silent desktop updates (2026-07-24)

- Only one desktop session: second launches focus the existing window.
- Update UX: download progress modal → restart prompt → applying loader; NSIS runs silent (`oneClick` + `/S --updated`).
- User Settings → Help & Support → **Check for updates**.
- **Update later** leaves a neon top-right download badge; click it to apply the staged update.

Test study:

1. Launch Nepsis Chat, click the desktop shortcut again — one session, window focuses; Task Manager shows a single app group.
2. Trigger an update (or Check for updates) — progress modal, then Restart; no install-scope wizard.
3. Confirm Settings shows the installed version and check status.
4. Choose **Update later** on the ready modal; confirm the top-right badge appears and applying from it restarts into the new version.

### Voice UI + camera restore after refresh (2026-07-24)

- Rejoin payload includes `serverId` and `cameraOn`.
- After refresh, the app reopens the voice channel view and re-enables the camera when it was on.
- Clicking back into that server while still in voice selects the live voice channel.

Test study:

1. Join voice, turn camera on, hard refresh — land in that voice UI with camera on.
2. Join voice, open Friends, refresh — still restore into the voice channel (not Friends).
3. Leave voice intentionally — no auto-rejoin / no camera restore.
4. While in voice, switch to another server then back — voice channel UI opens again.

### Desktop 0.1.7 release (2026-07-24)

- Electron source version: `0.1.7`.
- Release notes: [release-0.1.7.md](release-0.1.7.md).
- Includes voice audio while away from VoiceView, filmstrip ring clipping fix, and Windows Nepsis desktop icon embedding.
- Tag `v0.1.7` triggers `.github/workflows/desktop-release.yml`.

Release verification study:

1. Confirm `electron/package.json` and lockfile root both report `0.1.7`.
2. Merge into `master`, tag `v0.1.7`, confirm Desktop Release version job reports `0.1.7`.
3. After Windows install, confirm desktop/Start Menu shortcut uses the Nepsis icon.

### Desktop 0.1.8 release (2026-07-24)

- Electron source version: `0.1.8`.
- Release notes: [release-0.1.8.md](release-0.1.8.md).
- Includes single-instance lock, silent update modals, Settings → Check for updates, one-click NSIS.
- Tag `v0.1.8` triggers Desktop Release.

Release verification study:

1. Confirm `electron/package.json` and lockfile root report `0.1.8`.
2. Merge into `master`, tag `v0.1.8`, confirm Desktop Release version job reports `0.1.8`.
3. After install: second shortcut click focuses one session; update path shows loader not the NSIS wizard.

### Voice card volume + gallery + manual updates (2026-07-24)

- Click / right-click another user’s voice card → **User volume** (0–200%, default 100), optional **Stream volume**, Watch/Maximize, and Admin Mute/Deafen/Disconnect.
- `RemoteAudio` uses Web Audio gain so users can be made louder than 100%.
- Gallery mode camera cards use larger `--voice-grid-min` values.
- Desktop updates: **no auto-download**; green arrow when available; badge click downloads then Discord-style **Updating your software** restart modal.

Test study:

1. Join voice with two clients → open remote card menu → set User volume to 200% and 20%; confirm loudness changes.
2. Share screen with audio → watcher adjusts Stream volume independently of User volume.
3. As admin, confirm Mute / Disconnect still appear under Admin in the same menu.
4. Gallery with several cameras → cards are visibly larger than 0.1.9.
5. Publish a newer desktop build → older client shows green arrow only (no download) until clicked; then download + updating modal + silent install.

### Desktop 0.1.10 release (2026-07-24)

- Electron source version: `0.1.10`.
- Release notes: [release-0.1.10.md](release-0.1.10.md).
- Includes per-user/stream volume menus, larger gallery cards, manual update UX.
- Tag `v0.1.10` triggers Desktop Release.

### Link embeds + patch notes (0.2.0) (2026-07-24)

- Server chat and DMs render clickable links plus Open Graph embed cards (`MessageContent` / `LinkEmbed` → `POST /api/embeds/unfurl`).
- Settings → Help & Support → **Patch notes** (Newer releases / Current·Installed / Earlier; subtitle keeps “you’re on v…”).
- Electron source version: `0.2.0`. Release notes: [release-0.2.0.md](release-0.2.0.md).
- Tag `v0.2.0` triggers Desktop Release.

Test study:

1. Send `https://example.com` in a server channel and a DM — link is clickable and a preview card appears.
2. Send an image URL — still shows as media attachment (no OG card).
3. Open Settings → Help & Support — Patch notes panel lists v0.2.0 (and earlier).
4. After desktop install of 0.2.0, Help shows “you’re on v0.2.0”.

### Voice audio + menu + email confirm banner (0.2.1) (2026-07-24)

- Restore remote voice hearing after volume GainNode change (HTML audio + MediaElementSource gain).
- Voice card user menu portals to `document.body` and closes on outside click / Escape.
- Unconfirmed email accounts see a dropdown **Confirm your email** banner with Resend.
- Electron source version: `0.2.1`. Tag `v0.2.1` triggers Desktop Release.

### Voice audio/menu hotfix (0.2.2) (2026-07-24)

- 0.2.1 Web Audio path still silenced peers — fully revert to HTML `<audio>` for remote playback.
- Right-click-only user menus with a true full-screen dismiss backdrop (no left-click reopen race).
- Electron `0.2.2`. Tag `v0.2.2`.

### YouTube playback embeds (0.2.3) (2026-07-24)

- Server chat and DMs show a playable YouTube embed (poster + in-place player) for youtube.com / youtu.be / Shorts links.
- Other links still use the Open Graph card.
- Electron `0.2.3`. Tag `v0.2.3`.

### Voice floating cameras in text/DM (0.2.4) (2026-07-24)

- While in voice but viewing text/DM/Friends, a movable corner PiP shows live cameras (speaking highlighted).
- Drag snaps to any corner; click returns to the voice channel.
- Electron `0.2.4`. Tag `v0.2.4`.

Test study:

1. Join voice with cameras on → open a text channel → PiP appears with camera tiles.
2. Drag PiP to each corner; reload — corner preference persists.
3. Click Open / a tile → VoiceView returns.
4. Full VoiceView open → PiP hidden.

### Voice PiP drag + screen stage (0.2.5) (2026-07-24)

- **Screen share stage larger**: denser filmstrip while watching; dual-focus gives screen ~4× camera width; tighter stage padding.
- **PiP drag release**: pointer listeners attach to `window` on drag start so release always ends the drag (no stuck-on-hold).
- **Stable PiP tile order**: cameras stay in join order; speaking only updates the green ring (no reshuffle).
- Floating PiP also shows live screen shares (wider panel, `object-contain`) so shared screens stay readable in text/DM.
- Speaking avatar `scale-105` removed so gallery tiles do not jump when someone talks.
- Electron `0.2.5`. Tag `v0.2.5`.

Test study:

1. Watch a screen share → stage fills most of the pane; filmstrip stays compact.
2. Dual focus (screen + camera) → screen dominates; camera is a side/secondary pane.
3. Open text while in voice → drag PiP, release mouse anywhere → snaps to a corner (not stuck).
4. Multiple cameras on → speaking changes ring only; tile order does not reshuffle.
5. Someone shares screen while you are in text → PiP shows a larger Live screen tile.

### Screen share full stage + title-bar update (0.2.6) (2026-07-24)

- Watching a screenshare always uses a **full stage** (no side camera pane that squeezed/glitched the screen).
- Active cameras stay in the **top filmstrip**; one live camera shows as **bottom-right PiP** (default: sharer’s cam, else yours).
- Desktop **Update** control moved into the title bar, immediately left of minimize.
- Electron `0.2.6`. Tag `v0.2.6`.

Test study:

1. Click LIVE on a share → whole screen visible; no camera strip on the right of the stage.
2. Sharer has camera on → their cam appears bottom-right; other cams remain on top.
3. Click another filmstrip camera → BR PiP swaps; screen stays full-bleed.
4. Update available → green download icon appears left of minimize (not floating over content).

### Voice user drag + patch notes grouping (0.2.7) (2026-07-24)

- Dragging users between voice channels uses the **whole channel row** as a drop target, larger empty pads, accent highlights, and a drag overlay chip.
- User-drag collision only hits `voice-drop-*` (`pointerWithin` preferred).
- Patch notes: versions **above** installed → **Newer releases**; exact match → **Current / installed**; only older → **Earlier releases**. Subtitle still: “What’s new in Nepsis Chat (you’re on v…)”.
- Unit checks: `cd frontend && npm run test:unit`.
- Electron `0.2.7`. Tag `v0.2.7`.

Test study:

1. As admin, drag a voice user onto another voice channel name (not just the tiny user list) → they move.
2. Drag over an empty voice channel → “Drop user here” pad appears; release moves them.
3. On an older desktop build, open Patch notes → newer versions appear under **Newer releases**, not Earlier; installed card says **Installed**.

### Support, Nous subscription & keybindings (0.2.8) (2026-07-24)

- Desktop title bar **Support** (?) left of Update / minimize → support ticket modal (`bug_reports.category = support`).
- Settings → **Nous subscription**: plan cards, payment method, billing history templates (no live billing yet).
- Settings → **Keybindings**: remap mute/deafen/camera/screen/disconnect/answer/decline; persisted in `userPrefs.keybindings`; applied by `GlobalKeybindings`.
- Migration `20250211000021_bug_reports_category.sql`.
- Electron `0.2.8`. Tag `v0.2.8`.

Test study:

1. Desktop: click title-bar Support → submit a ticket while signed in → success message.
2. Settings → Nous subscription → Free + Nous cards and billing placeholders visible; upgrade buttons disabled.
3. Settings → Keybindings → rebind Toggle mute → combo saves; in voice, new combo toggles mute.
4. Guest account → Support form explains sign-in is required.

