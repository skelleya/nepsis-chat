# Backend

Node.js + Express + Socket.io + SQLite.

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login with username, returns user |
| GET | `/api/servers` | List servers |
| GET | `/api/servers/:id/channels` | List channels for server |
| GET | `/api/messages/channel/:channelId` | List messages (query: `limit`, `before`) |
| POST | `/api/messages` | Send message (`channelId`, `userId`, `content`, `replyToId`, `attachments`) |
| PATCH | `/api/messages/:id` | Edit message (`userId`, `content`) — author only |
| DELETE | `/api/messages/:id` | Delete message (`?userId=`) — author or admin/owner |
| POST | `/api/messages/:id/reactions` | Add reaction (`userId`, `emoji`) |
| DELETE | `/api/messages/:id/reactions` | Remove reaction (`?userId=&emoji=`) |
| POST | `/api/uploads` | Upload file (multipart/form-data) — returns `{url}` |
| POST | `/api/servers/:id/join` | Join server (`userId`) |
| GET | `/api/servers/:id/members` | List members with roles & presence |
| DELETE | `/api/servers/:id/members/:userId` | Kick user (`?kickerUserId=`) — owner/admin only |
| POST | `/api/servers/:id/members/:userId/move-voice` | Move user to another voice channel (`targetChannelId`, `adminUserId`) — owner/admin only |
| PATCH | `/api/servers/:id/channels/:channelId` | Update channel (`order`, `name`, `categoryId`) |
| PUT | `/api/servers/:id/channels/reorder` | Bulk reorder channels (`updates: [{ id, order }]`) |
| PUT | `/api/users/:id/presence` | Update presence (`status`: online, away, dnd, offline, in-voice; `voiceChannelId`) |
| PATCH | `/api/users/:id` | Update profile (`username`, `avatar_url`, `banner_url`) |
| GET | `/api/users/:id/profiles` | List user profiles (personal, work) |
| PUT | `/api/users/:id/profiles` | Upsert profile (`profile_type`, `display_name`, `avatar_url`, `banner_url`) |
| POST | `/api/dm/conversations` | Create or get DM between two users (`userId`, `targetUserId`) |
| GET | `/api/friends/list` | List friends (`?userId=`) |
| GET | `/api/friends/requests` | List pending friend requests (`?userId=`) |
| POST | `/api/friends/accept` | Accept friend request (`userId`, `requesterId`) |
| POST | `/api/friends/decline` | Decline friend request (`userId`, `requesterId`) |
| POST | `/api/friends/request` | Send friend request (`userId`, `targetUserId`) — requires `friend_requests` migration |
| GET | `/api/invites/:code` | Public invite details (server name, icon, inviter) — for join page |
| POST | `/api/invites/:code/join` | Join server via invite (`userId`) |
| POST | `/api/servers/:id/invites` | Create invite (`createdBy`) — any member |
| GET | `/api/servers/:id/invites` | List server invites |
| DELETE | `/api/servers/:id/invites/:code` | Revoke invite (`?revokedBy=`) |
| GET | `/api/servers/:id/audit-log` | List audit log entries (invite_created, invite_revoked, member_kicked, member_joined) |
| GET | `/api/version` | App version |

### Static

| Path | Description |
|------|-------------|
| `/updates/` | Update files (installer, latest.yml) for electron-updater |

---

## Database Schema (SQLite)

| Table | Columns |
|-------|---------|
| users | id, username, avatar_url, banner_url, created_at |
| servers | id, name, icon_url, owner_id |
| channels | id, server_id, name, type (text/voice), order |
| messages | id, channel_id, user_id, content, created_at |
| dm_conversations | id, created_at |
| dm_participants | conversation_id, user_id |
| dm_messages | id, conversation_id, user_id, content, created_at |
| friend_requests | requester_id, addressee_id, status (pending/accepted/rejected), created_at — see migration `20250211000002_friend_requests.sql` |
| server_invites | code, server_id, created_by, expires_at, max_uses, use_count, created_at — see migration `20250211000004_server_invites_audit.sql` |
| server_audit_log | id, server_id, user_id, action, details (JSONB), created_at — see migration `20250211000004_server_invites_audit.sql` |

**File:** `backend/data.sqlite` (legacy) — Supabase Postgres used in production

---

## Socket.io Namespaces

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
| admin-move-to-channel | Server → Client | channelId, channelName — emitted to target user when admin moves them to another voice channel |

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

## CORS

Configured for `http://localhost:5173` and `http://127.0.0.1:5173`.
