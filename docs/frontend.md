# Frontend

React + Vite + TypeScript + Tailwind CSS.

---

## Branding — Logo

The Nepsis logo is used everywhere:

| File | Used in |
|------|---------|
| public/logo.png | ServerBar, ChannelList, LoginPage, DownloadPage; ServerBar logo opens Friends page |
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
├── pages/                LoginPage, DownloadPage, FriendsPage, CommunityPage, OnboardingPage, InvitePage
├── data/                 mockData
└── types/                TypeScript
```

---

## Components

| Component | Purpose |
|-----------|---------|
| VoiceIcons | Shared mic/mic-off/headphones/headphones-off SVGs (prevents clipping/snipping) |
| ServerBar | Server list (left sidebar); click-hold-and-drag to reorder servers |
| ChannelList | Text + voice channels; server banner shown above header when `serverBannerUrl` set; highlights text channels with new messages (white) when user isn't viewing them. **Friends view** (`isFriendsView`): shows "Friends" header, DMs list, hides server channels. **Owner/Admin:** Server Settings (Overview: icon + banner upload); **Owner:** drag categories to reorder; drag channels to reorder or move between categories; 3-dot menu on category/channel for Edit/Delete. **Admin:** drag voice users onto another voice channel to move them |
| ChatView | Messages, input; scrolls to bottom on load; shows "New messages" indicator when scrolled up and new messages arrive; click to jump to new messages |
| VoiceView | Voice participants, join/leave; soundboard button (custom sounds, max 10s); **soundboard mute** (🔊/🔇) — toggle to stop hearing soundboard from others. **Resizable layout:** screen share vs participant cameras (drag divider); single participant centered; 2–4 participants in resizable horizontal panels; remote screen shares in main area. Uses `react-resizable-panels`. **Admin:** right-click participant for Mute or Disconnect. |
| SoundboardDropdown | Soundboard UI: list sounds with emoji; add (pick emoji for new sound); edit emoji per sound; delete; plays to all peers. Spam-click restarts playback. |
| MembersSidebar | Online members. **Admin:** right-click member in voice for Mute in Voice, Disconnect from Voice, Move to Channel. |
| RemoteAudio | Plays remote WebRTC stream |
| CallOverlay | DM call UI: outgoing/incoming/in-call states |
| DMView | Direct message chat; modern UI with gradient header, rounded bubbles, relative timestamps; groups consecutive messages from same sender (avatar/name shown only on first in group); spacing: 1.5 between same-sender, 5 between different senders |
| FriendsPage | Discord-like Friends home: tabs (All, Pending, Online, Add Friend). Add Friend by username; Online shows friends with presence. Opened by clicking Nepsis logo. When viewing a DM, stays in Friends view—sidebar shows DMs + servers |
| CreateServerModal | Create server: name input, gradient accent bar, loading spinner, error display; used by ServerBar (+ button) and OnboardingPage |
| UserSettingsModal | User Settings > My Account: Display name (optional, shown to others), Username (login identifier). Display name shown in UserPanel, voice, chat, DMs. |
| OnboardingPage | Shown when new (non-guest) user has no servers; CTAs: Create first server (opens CreateServerModal), Explore community; persisted via `nepsis_onboarding_completed` |
| CommunityPage | Explore page: invite code entry, community servers list; shown when guest has no servers or when user completes onboarding |
| UpdateButton | Green update (Electron only) |
| LoginPage | Guest (username only), Sign In (email or username + password), Sign Up (email + password) |

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
| layoutCache.ts | localStorage cache for channels + categories per server; instant preview on switch |
| realtime.ts | Supabase Realtime: subscribeToChannelMessages, subscribeToDMMessages, subscribeToAllDMMessages, subscribeToAllChannelMessages (for text channel unread indicators) |
| signaling.ts | BroadcastChannel (2-tab test) |
| socketSignaling.ts | Socket.io (with backend) |
| webrtc.ts | WebRTC peer connections |
| sounds.ts | Web Audio API notification/call sounds (no external files) |

---

## Direct Messages (DM)

| Feature | Implementation |
|---------|----------------|
| **DM list** | ChannelList shows Direct Messages section with conversations |
| **Unread indicators** | `dmUnreadCounts` (conversationId → count) in AppContext |
| **New message detection** | `subscribeToAllDMMessages` in realtime.ts listens to all dm_messages |
| **Notification** | `sounds.messageNotification()` when message arrives in non-current DM |
| **Clear unread** | `setCurrentDM(id)` clears unread when user opens a DM |
| **DMView** | Modern header (gradient avatar), rounded bubbles, relative timestamps (Today, Yesterday); spacing: mb-1.5 between same-sender messages, mb-3 between different senders |

### Files

| File | Purpose |
|------|---------|
| `AppContext.tsx` | dmUnreadCounts, setCurrentDM, subscribeToAllDMMessages |
| `ChannelList.tsx` | DM items with unread badge, glow animation, header count |
| `DMView.tsx` | Chat UI for 1-on-1 conversations |
| `realtime.ts` | subscribeToDMMessages (current), subscribeToAllDMMessages (all) |

---

## Text Channel Unread

| Feature | Implementation |
|---------|----------------|
| **Channel highlight** | Text channels with new messages (when user isn't viewing) show white highlight in sidebar |
| **Unread tracking** | `channelUnreadCounts` (channelId → count) in AppContext |
| **New message detection** | `subscribeToAllChannelMessages` in realtime.ts listens to all messages table INSERTs |
| **Clear unread** | `setCurrentChannel(id)` clears unread when user selects a channel |
| **ChatView scroll** | On load: scrolls to bottom. When scrolled up and new messages arrive: shows "New messages" button; click jumps to first new message |

### Files

| File | Purpose |
|------|---------|
| `AppContext.tsx` | channelUnreadCounts, subscribeToAllChannelMessages (filtered by server text channels) |
| `ChannelList.tsx` | Text channel items with hasUnread styling (white highlight) |
| `ChatView.tsx` | Scroll container, scroll-to-bottom, new message indicator, jumpToNewMessages |
| `realtime.ts` | subscribeToAllChannelMessages (no filter, INSERT only) |

---

## Channel & Category Management (Owner/Admin)

| Feature | Implementation |
|---------|----------------|
| **Reorder categories** | Drag category header (grip icon on hover); `onReorderCategories` → `api.reorderCategories` |
| **Reorder channels** | Drag channel within category; drop on channel reorders; drop on category header moves channel to that category |
| **Move channel to uncategorized** | Drag channel onto "Channels" header (uncategorized section) |
| **Edit category** | 3-dot menu on category header → Edit Category → inline input |
| **Delete category** | 3-dot menu → Delete; channels become uncategorized |
| **Edit channel** | 3-dot menu on channel → Edit Channel → inline input |
| **Delete channel** | 3-dot menu → Delete (with confirm) |
| **Move user to voice channel** | Admin: drag voice user (in channel list) onto another voice channel |

All features use `@dnd-kit/core` and `@dnd-kit/sortable`. Single DndContext with ID prefixes: `cat-`, `ch-`, `user-`, `voice-drop-`.

---

## Layout Cache

Channels and categories are cached in `localStorage` (`nepsis_layout_cache`) so:

1. **Instant preview** — When switching servers, cached layout shows immediately.
2. **Background refresh** — When the tab becomes visible, all servers' layouts refresh in background.
3. **Preload** — Other servers' layouts are fetched in background when viewing one server.
4. **Mutations** — Create/reorder/delete channel or category updates cache.

Cache is cleared on logout. See `frontend/src/services/layoutCache.ts`.

---

## State

- **AppContext** — user, servers, channels, messages, DM conversations, DM unread counts, channel unread counts
- **VoiceContext** — voice channel state, WebRTC, participants, speaking detection
- **CallContext** — private DM calls, WebRTC 1-on-1, call state machine
- No Redux/Zustand; useState in components

---

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| VITE_API_URL | — | API base (e.g. `http://localhost:3000/api`) |

When `VITE_API_URL` is set, voice uses Socket.io instead of BroadcastChannel.
