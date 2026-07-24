# Backend

Node.js + Express + Socket.io + Supabase (Postgres). Legacy `src/db/init.js` (SQLite) is unused.

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Guest login with username, returns user |
| POST | `/api/auth/signin-username` | Sign in with username + password (registered users; returns session tokens) |
| DELETE | `/api/auth/account/:userId` | Permanently delete any account (guest or registered): owned servers, DMs, messages, memberships, then `users` row; also `auth.admin.deleteUser` when `auth_id` is set |
| DELETE | `/api/auth/guest/:userId` | Guest-only account purge (same cleanup as `/account`; used on guest Log Out) |
| GET | `/api/servers` | List servers (ordered by user's `display_order` in `server_members`) |
| PUT | `/api/servers/reorder` | Reorder user's server list (`userId`, `updates: [{ serverId, order }]`) |
| GET | `/api/servers/:id/channels` | List channels for server |
| GET | `/api/messages/channel/:channelId` | List messages (query: `limit`, `before`) |
| POST | `/api/messages` | Send message (`channelId`, `userId`, `content`, `replyToId`, `attachments`) |
| PATCH | `/api/messages/:id` | Edit message (`userId`, `content`) — author only |
| DELETE | `/api/messages/:id` | Delete message (`?userId=`) — author or admin/owner |
| POST | `/api/messages/:id/reactions` | Add reaction (`userId`, `emoji`) |
| DELETE | `/api/messages/:id/reactions` | Remove reaction (`?userId=&emoji=`) |
| POST | `/api/uploads` | Upload file (multipart/form-data) — returns `{url}` |
| POST | `/api/servers/:id/join` | Join server (`userId`) |
| GET | `/api/servers/community` | Discoverable servers + `memberCount` / `onlineCount` / `ownerName` |
| GET | `/api/servers/:id/preview` | Public community server details (members, online, channels, owner, rules flag) |
| GET | `/api/servers/:id/members` | List members with roles & presence. Display name: profile → `users.display_name` → `users.username` → Unknown |
| DELETE | `/api/servers/:id/members/:userId?kickerUserId=` | Kick member (owner/admin). Clears presence; they may rejoin via invite. |
| POST | `/api/servers/:id/members/:userId/ban` | Ban member (`adminUserId`, optional `reason`). Removes membership, inserts `server_bans`, blocks invite/community rejoin. |
| DELETE | `/api/servers/:id/members/:userId` | Kick user (`?kickerUserId=`) — owner/admin only |
| POST | `/api/servers/:id/members/:userId/mute-voice` | Mute user in voice (`adminUserId`) — owner/admin only; emits admin-mute to target socket |
| POST | `/api/servers/:id/members/:userId/disconnect-voice` | Disconnect user from voice (`adminUserId`) — owner/admin only; clears presence, emits admin-disconnect-from-voice |
| POST | `/api/servers/:id/members/:userId/move-voice` | Move user to another voice channel (`targetChannelId`, `adminUserId`) — owner/admin only |
| PATCH | `/api/servers/:id/channels/:channelId` | Update channel (`order`, `name`, `categoryId`) |
| PUT | `/api/servers/:id/channels/reorder` | Bulk reorder channels (`updates: [{ id, order }]`) |
| GET | `/api/users/profiles/search` | Search discoverable profiles by display name (`?q=`) — public identity fields only |
| GET | `/api/users/lookup` | Legacy lookup by login username — returns public presentation, not username string |
| GET | `/api/users/:id/account` | Account summary including `active_profile` and private `username` for settings |
| PATCH | `/api/servers/:id/members/:userId/profile` | Set per-server presentation profile (`profileType`, `actorUserId`) |
| PUT | `/api/users/:id/presence` | Update presence (`status`: online, away, dnd, offline, in-voice; `voiceChannelId`) |
| PATCH | `/api/users/:id` | Update profile (`username`, `display_name`, `avatar_url`, `banner_url`, `active_profile`). Setting `active_profile` also copies that profile’s name/avatar/banner onto `users` (Work requires a saved Work display name). |
| GET | `/api/users/:id/profiles` | List user profiles (personal, work) |
| PUT | `/api/users/:id/profiles` | Upsert profile (`profile_type`, `display_name`, `avatar_url`, `banner_url`) |
| GET | `/api/users/:id/privacy` | Get privacy settings (defaults if unset) |
| PUT | `/api/users/:id/privacy` | Upsert privacy settings (DMs, calls, friend requests, voice/online visibility, speaking indicator) |
| POST | `/api/dm/conversations` | Create or get DM between two users (`userId`, `targetUserId`) |
| POST | `/api/dm/messages` | Send DM (`conversationId`, `userId`, `content`, optional `replyToId`) — returns reactions + reply_to |
| POST | `/api/dm/messages/:id/reactions` | Add DM reaction (`userId`, `emoji`) |
| DELETE | `/api/dm/messages/:id/reactions` | Remove DM reaction (`?userId=&emoji=`) |
| GET | `/api/friends/list` | List friends (`?userId=`) — includes `status`, `friendship_profile`, `visible_profiles` |
| GET | `/api/friends/requests` | List pending friend requests (`?userId=`) — includes `requester_profile` |
| POST | `/api/friends/accept` | Accept friend request (`userId`, `requesterId`, `profile?`, `visibleProfiles?`) |
| POST | `/api/friends/decline` | Decline friend request (`userId`, `requesterId`) |
| POST | `/api/friends/request` | Send friend request (`userId`, `targetUserId`, `profile?` personal\|work) — respects target `who_can_add_friend` |
| PATCH | `/api/friends/visibility` | Update per-friend profile visibility (`userId`, `friendId`, `visibleProfiles?`, `friendshipProfile?`) |
| GET | `/api/invites/:code` | Public invite details (server name, icon, inviter, **memberCount**) — for join page |
| POST | `/api/invites/:code/join` | Join server via invite (`userId`) |
| POST | `/api/servers/:id/invites` | Create invite (`createdBy`) — any member |
| GET | `/api/servers/:id/invites` | List server invites |
| DELETE | `/api/servers/:id/invites/:code` | Revoke invite (`?revokedBy=`) |
| GET | `/api/servers/:id/audit-log` | List audit log entries (invite_created, invite_revoked, member_kicked, member_joined) |
| GET | `/api/version` | App version |
| POST | `/api/bug-reports` | Submit bug report (`userId`, `username`, `email`, `title`, `description`, `url`) — public |
| GET | `/api/soundboard` | List user soundboard sounds (`?userId=`) |
| POST | `/api/soundboard` | Upload soundboard sound (multipart: `file`, `userId`, `name`, `emoji`?) — max 10s, MP3/WAV/OGG/WebM/M4A |
| PATCH | `/api/soundboard/:id` | Update soundboard sound (JSON: `userId`, `emoji`) — change emoji |
| DELETE | `/api/soundboard/:id` | Delete soundboard sound (`?userId=`) |
| GET | `/api/servers/:id/rules-acceptance` | Check if user accepted rules (`?userId=`) — for channel lock |
| GET | `/api/webrtc/ice` | Public ICE list (STUN + optional TURN from `TURN_*` env) for voice/calls |

### Static

| Path | Description |
|------|-------------|
| `/updates/` | Update files (installer, latest.yml) for electron-updater |

---

## Database Schema (SQLite)

| Table | Columns |
|-------|---------|
| users | id, username, display_name, avatar_url, banner_url, created_at — display_name shown in UI; migration `20250211000013_user_display_name.sql` |
| servers | id, name, icon_url, owner_id |
| channels | id, server_id, name, type (text/voice/rules), order |
| servers | + rules_channel_id, lock_channels_until_rules_accepted, rules_accept_emoji |
| server_members | + display_order (INTEGER, nullable) — user's preferred server list order; migration `20250211000011_server_members_display_order.sql` |
| rules_acceptances | server_id, user_id, accepted_at — when user reacted with accept emoji |
| messages | id, channel_id, user_id, content, created_at |
| dm_conversations | id, created_at |
| dm_participants | conversation_id, user_id |
| dm_messages | id, conversation_id, user_id, content, created_at |
| friend_requests | requester_id, addressee_id, status (pending/accepted/rejected), requester_profile (personal\|work), created_at — see migrations `20250211000002_friend_requests.sql`, `20250211000015_privacy_profiles_friends.sql` |
| user_privacy_settings | user_id, who_can_dm, who_can_call, who_can_add_friend, show_voice_channel, show_online_status, allow_voice_activity_indicator — migration `20250211000015_privacy_profiles_friends.sql` |
| friend_profile_settings | user_id, friend_id, friendship_profile, visible_profiles (personal\|work\|both) — migration `20250211000015` |
| users | + active_profile (personal\|work) — which profile is used when joining/appearing in servers |
| server_invites | code, server_id, created_by, expires_at, max_uses, use_count, created_at — see migration `20250211000004_server_invites_audit.sql` |
| server_audit_log | id, server_id, user_id, action, details (JSONB), created_at — see migration `20250211000004_server_invites_audit.sql` |
| bug_reports | id, user_id, username, email, title, description, url, user_agent, status (pending/reviewed/resolved/wontfix), created_at — see migration `20250211000008_bug_reports.sql` |
| soundboard_sounds | id, user_id, name, url, duration_seconds, storage_path, emoji, created_at — max 10s audio; emoji shown on each sound; migration `20250211000009_soundboard_sounds.sql`, `20250211000014_soundboard_emoji.sql` |
| dm_conversations | id, created_at, is_group, name, created_by, updated_at — 1:1 and group DM metadata; group fields added by `20260724004517_group_direct_messages.sql`, creator FK index follow-up `20260724005105_group_dm_created_by_index.sql` |
| dm_participants | conversation_id, user_id, joined_at — many-to-many DM membership; groups support up to 10 members through the API |

**File:** `backend/data.sqlite` (legacy) — Supabase Postgres used in production

**Active Supabase:** `qeopqyquskszzgprghiy` — schema applied (19 migrations). Backend needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `backend/.env` (see `.env.example`). Storage uploads use public bucket `attachments`.

---

## Socket.io Namespaces

Handlers are registered with the **Namespace** (`io.of('/voice')`, etc.), not the root Server. On a Namespace, `namespace.sockets` is already `Map<socketId, Socket>`. Do not use `namespace.sockets.sockets` (that double path only exists on the root Server via `server.sockets.sockets`).

**Voice:** `screen-share` `{ active }` → broadcast to room so peers show LIVE / auto-watch even when remote track metadata is missing.

**Calls:** disconnect ends active calls and stuck ringing when the party fully goes offline (refresh mid-ring).

### `/chat`

| Event | Direction | Payload |
|-------|-----------|---------|
| join-channel | Client → Server | channelId |
| leave-channel | Client → Server | channelId |
| message | Client → Server | channelId, userId, username, content |
| message | Server → Client | message object |
| typing | Client → Server | channelId, userId, username |
| typing | Server → Client | userId, username |

### `/voice`

| Event | Direction | Payload |
|-------|-----------|---------|
| join-voice | Client → Server | channelId, userId, username |
| leave-voice | Client → Server | channelId, userId |
| peer-joined | Server → Client | socketId, userId, username |
| peer-left | Server → Client | userId |
| offer | Client → Server | to (socketId), sdp |
| answer | Client → Server | to, sdp |
| ice-candidate | Client → Server | to, candidate |
| offer | Server → Client | from, fromUserId, sdp |
| answer | Server → Client | from, fromUserId, sdp |
| ice-candidate | Server → Client | from, fromUserId, candidate |
| soundboard-play | Client → Server | soundUrl, userId, username — play sound to all peers in room |
| soundboard-play | Server → Client | soundUrl, userId, username — broadcast to room |
| admin-move-to-channel | Server → Client | channelId, channelName — emitted to target user when admin moves them to another voice channel |
| admin-mute | Server → Client | — emitted to target user when admin force-mutes them |
| admin-disconnect-from-voice | Server → Client | — emitted to target user when admin disconnects them from voice |

### `/calls` (DM private calls)

| Event | Direction | Payload |
|-------|-----------|---------|
| register | Client → Server | userId, username — maps socket to user |
| call:initiate | Client → Server | targetUserId, callId |
| call:accept | Client → Server | callId |
| call:decline | Client → Server | callId |
| call:end | Client → Server | callId |
| call:offer | Both | callId, sdp — WebRTC SDP exchange |
| call:answer | Both | callId, sdp |
| call:ice-candidate | Both | callId, candidate |
| call:incoming | Server → Client | callId, callerId, callerUsername |
| call:accepted | Server → Client | callId |
| call:declined | Server → Client | callId |
| call:ended | Server → Client | callId |
| call:unavailable | Server → Client | callId, reason (offline/busy) |

**File:** `backend/src/socket/calls.js`

---

## Soundboard upload contract

`POST /api/soundboard` accepts MP3/MPEG, WAV, OGG, WebM, M4A/MP4, AAC, and FLAC audio up to 10 MB. `music-metadata` must confirm a duration greater than zero and no more than ten seconds. Long source files are clipped in the frontend before this request; the API and Postgres check remain defense in depth.

Storage uses `attachments/soundboard/{userId}/`. Migration `20260723234108_allow_soundboard_audio_formats.sql` extends a configured bucket MIME allowlist while preserving an unrestricted (`NULL`) allowlist.

---

## Group direct messages

The existing `dm_participants` join table supports multiple users. Group metadata is additive, so old two-person conversations remain `is_group=false`.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/dm/conversations/group` | Create a group with the creator plus 2–9 selected friends |
| POST | `/api/dm/conversations/:id/members` | Add people; requester must already participate |
| PATCH | `/api/dm/conversations/:id` | Rename a group; requester must already participate |

Conversation responses include `participants[]`; 1:1 responses retain `other_user` for compatibility. Creating a 1:1 conversation now requires an exact two-member match, preventing a group containing both users from being returned as their private DM. Group calls are intentionally unsupported; the existing `/calls` namespace remains 1:1.

Security note: these endpoints enforce conversation membership, validate target user IDs, and require every invited user to have an accepted friendship with the inviter. Like the pre-existing REST API, identity is still supplied as `userId` rather than bound by auth middleware; replacing that legacy trust model requires a separate API-wide authentication migration.

---

## CORS

Configured for `http://localhost:5173` and `http://127.0.0.1:5173`.
