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
| ServerBar | Server list (left sidebar); click-hold-and-drag to reorder servers. **GSAP:** Friends + Community bubbles scale-punch on click |
| ChannelList | Text + voice channels; server banner shown above header when `serverBannerUrl` set; highlights text channels with new messages (white) when user isn't viewing them. **Friends view** (`isFriendsView`): shows "Friends" header, DMs list, hides server channels. **Owner/Admin:** Server Settings (Overview: icon + banner upload); **Owner:** drag categories to reorder; drag channels to reorder or move between categories; 3-dot menu on category/channel for Edit/Delete. **Admin:** drag voice users onto another voice channel to move them |
| ChatView | Messages, input; scrolls to bottom on load; shows "New messages" indicator when scrolled up and new messages arrive; click to jump to new messages |
| VoiceView | Voice participants, join/leave; soundboard button (custom sounds, max 10s); **soundboard mute** (🔊/🔇) — toggle to stop hearing soundboard from others. **Resizable layout:** screen share vs participant cameras (drag divider); single participant centered; 2–4 participants in resizable horizontal panels; remote screen shares in main area. Uses `react-resizable-panels`. **Admin:** right-click participant for Mute or Disconnect. |
| SoundboardDropdown | Soundboard UI: list sounds with emoji; add (pick emoji for new sound); edit emoji per sound; delete; plays to all peers. Spam-click restarts playback. |
| MembersSidebar | Online members. **Admin:** right-click member in voice for Mute in Voice, Disconnect from Voice, Move to Channel. |
| RemoteAudio | Plays remote WebRTC stream |
| CallOverlay | DM call UI: outgoing/incoming/in-call states |
| DMView | Direct message chat; modern UI with gradient header, rounded bubbles, relative timestamps; groups consecutive messages from same sender (avatar/name shown only on first in group); spacing: 1.5 between same-sender, 5 between different senders |
| FriendsPage | Discord-like Friends home: tabs (All, Pending, Online, Add Friend). **Add Friend** searches discoverable **profile display names** (not login usernames); request targets that profile and is sent from your Personal/Work. Accept under a chosen profile. **GSAP:** fade+slide-in on mount |
| CreateServerModal | Create server: name input, gradient accent bar, loading spinner, error display; used by ServerBar (+ button) and OnboardingPage |
| UserPanel | Bottom bar: avatar/status, mute, deafen, settings. **GSAP:** status menu open/close (fade+rise+scale); mute/deafen buttons punch-scale on click; status dot pops on change. Mute/deafen play Web Audio cues via `VoiceContext` / `CallContext`. |
| UserSettingsModal | User Settings modal: fixed size (`h-[min(640px,90vh)]`) so tab changes don’t resize; GSAP open/close; **sidebar** uses a shared accent pill that slides between nav buttons (compact 15px labels, Log Out pinned at bottom); **content** slides horizontally in travel direction (down the list → left, up → right); close (X) overlays the top-right over a thin `.settings-scroll` scrollbar. **My Account (non-guest):** Personal defaults to signup username until Profiles are set; Work locked until a Work display name is saved; switching Personal/Work updates name/avatar/banner immediately; Profiles saves sync labels via `onProfilesChange`. **Appearance:** Coming soon. **Voice & Video / Notifications:** local prefs. Shared **SettingsDropdown** / **SettingsToggle**. |
| SettingsDropdown | Custom select for settings pages — trigger + portal listbox, checkmark on selected option, open/close fade+scale via GSAP; closes on outside click, Escape, or scroll. |
| SettingsToggle | Shared switch control — GSAP slides the knob and tweens track color with a light scale punch on change. |
| Theme CSS vars | `--app-*` colors are space-separated RGB channels (`30 31 34`) so Tailwind opacity modifiers (`/50`, `/80`) work. Hex is converted in `userPrefs.applyAppearancePrefs`. |
| CreateServerModal | Create-server dialog; GSAP open (overlay fade + panel rise/scale) and close (reverse before unmount); top accent bar is a 200%-wide accent→green gradient looped with GSAP (`xPercent: -50`, seamless). |
| PrivacySettingsTab | Voice-focused privacy toggles/selects; persists via `GET/PUT /api/users/:id/privacy` |
| ProfilesSettingsTab | Edit Personal/Work profiles; set server presentation; manage which friends see which profiles |
| OnboardingPage | Shown when new (non-guest) user has no servers; CTAs: Create first server (opens CreateServerModal), Explore community; persisted via `nepsis_onboarding_completed` |
| CommunityPage | Explore page: invite code entry, community servers list; shown when guest has no servers or when user completes onboarding. **GSAP:** fade+slide-in on mount (compass bubble) |
| UpdateButton | Green update (Electron only) |
| DownloadBanner | Centered top tab: short prompt (“Prefer the desktop app?”) + clear Download button + subtle dismiss; `rounded-b-xl`; dismissible (localStorage); sets `--download-banner-height`; hidden on `/download` and in Electron. **GSAP:** slide/fade in/out |
| LoginPage | Guest (username only), Sign In (email or username + password), Sign Up (email + password). **GSAP:** soft page/card enter; sliding accent pill on tabs; form panel slides with tab direction; credential fields + Continue/Sign In button collapse upward together on submit (reopen on error); logo coin uses `quickSetter(..., 'rotationY', 'deg')` so horizontal cursor swipe spins the 3D coin with inertia + face settle |
| AppContent (login transition) | Keeps LoginPage mounted until GSAP exit finishes after auth, then fades main app in (`gsap`) |

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
| sounds.ts | Web Audio API notification/call/voice sounds (no external files). Includes mute/unmute/deafen/undeafen cues gated by Notifications → Voice sounds. |
| iceConfig.ts | STUN + optional TURN for P2P voice/calls (`ensureIceServers`) |

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
| VITE_TURN_URLS | — | Optional comma-separated TURN URLs (fallback if API has no TURN) |
| VITE_TURN_USERNAME | — | TURN username (with `VITE_TURN_URLS`) |
| VITE_TURN_CREDENTIAL | — | TURN password (with `VITE_TURN_URLS`) |

When `VITE_API_URL` is set, voice uses Socket.io instead of BroadcastChannel. ICE/TURN: see [webrtc-voice.md](webrtc-voice.md). Preferred: backend `GET /api/webrtc/ice`.
