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
| PUT | `/api/users/:id/presence` | Update presence (`status`, `voiceChannelId`) |
| POST | `/api/dm/conversations` | Create or get DM between two users (`userId`, `targetUserId`) |
| POST | `/api/friends/request` | Send friend request (`userId`, `targetUserId`) — requires `friend_requests` migration |
| GET | `/api/version` | App version |

### Static

| Path | Description |
|------|-------------|
| `/updates/` | Update files (installer, latest.yml) for electron-updater |

---

## Database Schema (SQLite)

| Table | Columns |
|-------|---------|
| users | id, username, avatar_url, created_at |
| servers | id, name, icon_url, owner_id |
| channels | id, server_id, name, type (text/voice), order |
| messages | id, channel_id, user_id, content, created_at |
| dm_conversations | id, created_at |
| dm_participants | conversation_id, user_id |
| dm_messages | id, conversation_id, user_id, content, created_at |
| friend_requests | requester_id, addressee_id, status (pending/accepted/rejected), created_at — see migration `20250211000002_friend_requests.sql` |

**File:** `backend/data.sqlite`

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

---

## CORS

Configured for `http://localhost:5173` and `http://127.0.0.1:5173`.
