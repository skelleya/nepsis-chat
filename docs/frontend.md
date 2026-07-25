# Frontend

React + Vite + TypeScript + Tailwind CSS.

---

## Typography

| Role | Font | How |
|------|------|-----|
| Headers (`h1`–`h6`, `.font-display`, landing wordmark/headline) | **TWK Everett** | Self-hosted `@font-face` from `public/fonts/TWKEverett-*.woff2` (licensed). Falls back to Space Grotesk until files are present. |
| Paragraphs / body / UI (`.font-sans`) | **Poppins** | Google Fonts in `index.html` |

CSS vars: `--font-header`, `--font-body` in `index.css`.

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
| ServerBar | Server list (left sidebar); click-hold-and-drag to reorder servers. **GSAP:** Friends, Community, and **+** (Add Server) bubbles scale-punch on click |
| ChannelList | Text + voice channels in a **Nepsis rail** (rounded rows, chat/wave icons, orange selected accent). **Voice users:** right-click for Profile / Roles / Move to / Message / Call / Server Mute / Server Deafen / Disconnect / Kick / Ban; drag-drop onto the whole voice channel row (highlighted targets + drag overlay chip). **Channels:** hover gear — Rename, Copy ID, Move to Category, Delete. **Create:** chat + / voice + (or server menu) opens centered name-only modal with type locked. Server dropdown portaled with solid background. |
| ChatView | Messages, input; scrolls to bottom on load; shows "New messages" indicator when scrolled up and new messages arrive; click to jump to new messages |
| VoiceView | Voice participants in a responsive gallery (larger camera cards). Click/right-click a remote card for **User volume** (0–200%), **Stream volume** (while sharing), Watch/Maximize, and **Admin** Mute/Deafen/Disconnect. Soundboard + screen stage. Presence merge always includes channel users (even after peer-left). |
| MessageContent | Shared server/DM message renderer: mentions, clickable links, media attachments, and `LinkEmbed` preview cards |
| LinkEmbed | Open Graph preview card; fetches `POST /api/embeds/unfurl` |
| YouTubeEmbed | Playable YouTube player for youtube.com / youtu.be / shorts links (poster → iframe) |
| VoiceFloatingOverlay | Corner PiP of voice cameras (+ live screens) while in text/DM/Friends; window-level drag-snap to TL/TR/BL/BR; stable tile order; click returns to VoiceView |
| PatchNotesPanel | Help & Support → Patch notes grouped as Newer / Current·Installed / Earlier (bundled + GitHub Releases) |
| SupportTicketModal | Title-bar Support control → support ticket form (`category=support` via bug-reports API) |
| NousSubscriptionSettingsTab | Settings → Nous subscription (plan + billing templates) |
| KeybindingsSettingsTab | Settings → Keybindings (remap voice/call shortcuts in local prefs) |
| GlobalKeybindings | Applies remapped shortcuts under VoiceProvider / CallProvider |
| EmailConfirmBanner | Top dropdown when a registered user’s Supabase email is not confirmed yet (Resend + dismiss for session) |
| Server Settings ownership | `isAdminOrOwner` uses `servers.owner_id` **or** members role. Members/servers fetch errors keep prior state so the owner menu and modal do not disappear during polls. |
| DownloadPage | OS-detect primary **Install for Mac/Windows** (Apple/Windows logos); click starts installer download immediately; **Other Installers** reveals the rest + Linux Coming soon. |
| SoundboardDropdown | Server soundboard: custom-named clips with emoji; uploads attach to `serverId` so every member sees the same list; rename (double-click / pencil); share legacy personal sounds; admin/uploader delete; plays to all voice peers. |
| MembersSidebar | Grouped **In Voice / Online / Offline**. Click for profile popout. Minimized: avatar stack + count + CoolIcons chevron. Context menu uses CoolIcons. **Admin:** Kick/Ban / Mute / Disconnect / Move. |
| CoolIcon | Iconify `ci` (CoolIcons Free Iconset from Figma). Use `<CoolIcon name="users" />` instead of inline SVGs. |
| MemberProfilePanel | Floating user card (portal + GSAP); Message/Call/Add Friend; owner/admin Kick & Ban with confirm. |
| DMView | Discord-style DM stream (left-aligned, grouped, date separators). Composer: + inside field, Enter to send, no send button. |
| ChatView | Same Discord chat chrome for server channels — grouped messages, hover actions, integrated + composer. |
| ChatInput | Shared Discord composer bar (`#383a40`): attach +, text, optional emoji; Enter submits. |
| VoiceView | Avatar circles when cam off. **Camera/screen:** watching a share fills the stage (`object-contain`); active cameras stay in the top filmstrip; one live camera PiP sits bottom-right (sharer → self → first cam). No side-by-side dual stage. Camera maximize still uses a focus stage when not watching a share. |
| TypingIndicator | “X is typing…” under channel/DM composers |
| RemoteAudio | Plays remote WebRTC stream |
| CallOverlay | DM call UI: outgoing/incoming/in-call states |
| DMView | Direct message chat; Call + Video Call in header (expand if already in call with them); click a message to reply; reactions persisted + realtime via `dm_message_reactions`; reply preview bar; file/image/video links use `FileAttachment` with Download |
| FileAttachment | Shared chat/DM media card — image/video preview or file chip plus **Download** (blob download, CORS fallback opens tab) |
| ChatView | Channel chat; attachments render via `FileAttachment` with Download on images, videos, and files |
| CallOverlay | Ringing/calling modals; in-call compact green bar (**click to expand** full panel with video stage + local PiP); mute/deafen/end |
| FriendsPage | All / Pending / Online / Add Friend tabs; **+ Add a Friend** button under the All list opens the Add tab |
| FriendsPage | Discord-like Friends home: tabs (All, Pending, Online, Add Friend). **Add Friend** searches discoverable **profile display names** (not login usernames); request targets that profile and is sent from your Personal/Work. Accept under a chosen profile. **GSAP:** fade+slide-in on mount |
| CreateServerModal | Create server: name input, gradient accent bar, loading spinner, error display; used by ServerBar (+ button) and OnboardingPage |
| UserPanel | Bottom bar: avatar/status, mute, deafen, settings. **GSAP:** status menu open/close (fade+rise+scale); mute/deafen buttons punch-scale on click; status dot pops on change. Mute/deafen play Web Audio cues via `VoiceContext` / `CallContext`. |
| UserSettingsModal | User Settings modal: fixed size (`h-[min(640px,90vh)]`) so tab changes don’t resize; GSAP open/close; **sidebar** uses a shared accent pill that slides between nav buttons (compact 15px labels, Log Out pinned at bottom); **content** slides horizontally in travel direction (down the list → left, up → right); close control is a muted circular X (matches Server Settings). **My Account (non-guest):** Personal defaults to signup username until Profiles are set; Work locked until a Work display name is saved; switching Personal/Work updates name/avatar/banner immediately; Profiles saves sync labels via `onProfilesChange`. **My Account Danger Zone:** Delete Account (confirm by typing login username) → `DELETE /api/auth/account/:userId` via `AppContext.deleteAccount`. **Appearance:** theme / accent (default Nepsis orange) / density / font size via `userPrefs`. **Voice & Video / Notifications:** local prefs. Shared **SettingsDropdown** / **SettingsToggle**. |
| AppearanceSettingsTab | Wired to `userPrefs` — theme (**dark / midnight / AMOLED / White**), accent (orange default + blurple/green/teal/rose/gold), density, font size; applies CSS vars live. White uses light surfaces + `--app-glass` black overlays. |
| CreateChannelModal | Create channel dialog with GSAP open/close, Escape, `role="dialog"` (parity with CreateServerModal). |
| ServerSettingsModal | Full-screen settings with GSAP enter/exit; tab content light fade. |
| useGsapMenu | Shared hook for dropdown/menu enter (0.22s) / exit (0.16s) used by ChannelList menus, EmojiPicker, Soundboard. |
| blockedUsers | Device-local block list (`nepsis_blocked_users`); DM Block hides conversations; Privacy settings list + Unblock; Report submits via bug-report API. |
| App mobile layout | Below `lg`: channel/DM rail is a slide-over (hamburger in top bar). Below `xl`: members rail is a slide-over. Desktop keeps three-rail layout. |
| SettingsDropdown | Custom select for settings pages — trigger + portal listbox, checkmark on selected option, open/close fade+scale via GSAP; closes on outside click, Escape, or scroll. |
| SettingsToggle | Shared switch control — GSAP slides the knob and tweens track color with a light scale punch on change. |
| Theme CSS vars | `--app-*` colors are space-separated RGB channels (`30 31 34`) so Tailwind opacity modifiers (`/50`, `/80`) work. Hex is converted in `userPrefs.applyAppearancePrefs`. |
| CreateServerModal | Create-server dialog; GSAP open (overlay fade + panel rise/scale) and close (reverse before unmount); top accent bar is a 200%-wide accent→green gradient looped with GSAP (`xPercent: -50`, seamless). |
| PrivacySettingsTab | Voice-focused privacy toggles/selects; persists via `GET/PUT /api/users/:id/privacy` |
| ProfilesSettingsTab | Edit Personal/Work profiles; set server presentation; manage which friends see which profiles |
| OnboardingPage | Shown when new (non-guest) user has no servers; CTAs: Create first server (opens CreateServerModal), Explore community; persisted via `nepsis_onboarding_completed` |
| CommunityPage | Explore page: invite code entry; community list shows online/member counts; **click a server** opens details panel (members, online, channels, owner, Join/Open). **GSAP:** fade+slide-in on mount |
| InvitePage | Public invite join page — server banner/icon/name, inviter, **member count**, Join Server. **Log In to Join** stores `nepsis_pending_invite` then returns after auth. Successful join sets `joinServerId` + `nepsis_last_view: server` before `navigate('/')`. |
| AppContent auth gate | `showApp` / `showLogin` initialize from current `user` so remounting `/` after `/invite/:code` (session already set) opens the main app instead of a stuck login shell. |
| UpdateButton | Electron: green download control in the title bar; download % then Discord-style **Applying update N of 5** modal |
| UpdateApplyingPanel | Shared stepped apply/finish progress UI for desktop updates |
| TitleBar | Electron chrome; Support (?) then Update, then min/max/close |
| DesktopUpdatesPanel | Settings → Help & Support: version + Check for updates (desktop only) |
| DownloadBanner | Centered top tab: short prompt (“Prefer the desktop app?”) + clear Download button + subtle dismiss; `rounded-b-xl`; dismissible (localStorage); sets `--download-banner-height`; hidden on `/download` and in Electron. **GSAP:** slide/fade in/out |
| WelcomeLanding | Pre-auth home (white split): large Nepsis logo left (`mix-blend-multiply` drops black square), **Use Web App** / **Download App** right. TWK Everett headers + Poppins body; GSAP entrance. |
| LoginPage | After Use Web App: Guest / Sign In / Sign Up. **GSAP:** soft page/card enter; tab glide; fields collapse on submit; logo coin spin. Back returns to WelcomeLanding. |
| AppContent (login transition) | Keeps LoginPage mounted until GSAP exit finishes after auth, then fades main app in (`gsap`) |

---

## Hooks

| Hook | Purpose |
|------|---------|
| useVoiceChannel | WebRTC voice state, join/leave |
| useDesktopUpdate | Desktop update state + on-demand check (Electron) |

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

### Persistent voice playback

`VoiceProvider` owns the WebRTC session, microphone, and hidden `RemoteAudio` sinks. Playback therefore survives navigation away from `VoiceView` to Friends/Add Friend, DMs, Community, or settings. `VoiceView` renders the visual voice layout only and must not create duplicate remote-audio elements.

### Settings dropdown stability

`SettingsDropdown` is portaled above the settings modal and memoized. Scroll/resize updates only its fixed position and do not replay the GSAP entrance. Reusable selector wrappers such as `DeviceSelect` must remain at module scope and stay memoized; defining them inside a frequently rendering tab remounts and closes their menus. Voice & Video keeps the live mic meter in `MicTestPanel` so RAF level ticks cannot re-render open device/quality menus.

### Voice audio while navigating away from VoiceView

Remote playback sinks live in `VoiceProvider` and are portaled to `document.body` (`#nepsis-voice-audio-root`). Camera/stage `<video>` elements stay muted so they never become the only audio path. Opening Friends (Nepsis logo), DMs, or text chats unmounts `VoiceView` but must not stop hearing or transmitting; `App` dispatches `nepsis-voice-audio-nudge` on main-view changes so sinks retry `play()`.

### Voice rejoin after refresh

`sessionStorage` key `nepsis_voice_rejoin` stores `{ channelId, channelName, serverId, cameraOn, muted, deafened, restoreUi }`. On reload the client re-joins voice, opens that server’s voice channel UI when `restoreUi` is set, and turns the camera back on when `cameraOn` was true. Returning to the same server while still connected also selects the live voice channel.

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
| `DMView.tsx` | Chat UI for 1-on-1 and group conversations; group member management |
| `GroupDMModal.tsx` | Friend multi-select for creating groups and adding participants |
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
| **Move user to voice channel** | Admin: drag voice user onto another voice channel row (header + user list). User drags only collide with `voice-drop-*`; empty channels enlarge while dragging; DragOverlay shows a move chip. Helpers in `utils/channelDragCollision.ts`. |

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

## Recent Notes

- **Mic processing presets** live in `userPrefs.voice.micProcessing` with `off`, `standard`, and `high`. Legacy booleans still exist for compatibility but are derived from the preset. `VoiceContext.setMicProcessing()` updates saved prefs and tries `applyConstraints()` on the current mic before falling back to reacquiring and replacing the outbound audio track.
- **Voice settings UI** replaces the three mic-processing toggles with a `SettingsDropdown`. The mic test meter lives in `MicTestPanel` and only updates its own state when the sampled level moves by at least `0.02`, so open dropdowns never re-render from meter ticks.
- **Voice/member clipping fixes** keep rings and speaking glows on outer wrappers while `overflow-hidden` stays on the inner media/avatar element only. This prevents minimized member status dots, mute badges, and video glows from being clipped.
- **DM profile popouts** can now show friend-resolved banner/bio data from `conversation.other_user`; non-friends still render without friend-only bio data.

---

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| VITE_API_URL | — | API base (e.g. `http://localhost:3000/api`) |
| VITE_TURN_URLS | — | Optional comma-separated TURN URLs (fallback if API has no TURN) |
| VITE_TURN_USERNAME | — | TURN username (with `VITE_TURN_URLS`) |
| VITE_TURN_CREDENTIAL | — | TURN password (with `VITE_TURN_URLS`) |

When `VITE_API_URL` is set, voice uses Socket.io instead of BroadcastChannel. ICE/TURN: see [webrtc-voice.md](webrtc-voice.md). Preferred: backend `GET /api/webrtc/ice`.

---

## Media and soundboard controls

- `userPrefs.ts` persists `cameraQuality` (`1080p`/`1440p`) and `screenQuality` (`1080p`/`1440p`/`4k`).
- `VoiceVideoSettingsTab.tsx` edits those device-local preferences; capture reads them the next time media starts.
- `audioClip.ts` uses Web Audio to decode a long sound and writes the selected, at-most-10-second segment as PCM WAV.
- `SoundboardDropdown.tsx` owns clip selection and preview; the backend remains the final duration/type validator.
- `UserPanel.tsx` combines presence and quick Personal/Work switching. The full profile editor remains under User Settings → Profiles.
- Same-account voice tabs coordinate through an owner heartbeat in `VoiceContext`; observer tabs render presence without creating duplicate WebRTC sessions.
- Screen-share audio is optional in Voice & Video settings and is captured only when supported/selected by the browser.

### Modern chat and voice surfaces

- `chat-shell`, `chat-header-modern`, `chat-message-modern`, and `chat-composer-wrap` provide a shared minimal visual language for server channels and DMs.
- Message density now flows through `.chat-msg-row` and the Appearance density preference.
- Voice gallery cards use an auto-fit grid (`--voice-grid-min` ~320/260/200) rather than fixed wrapped sizes.
- Per-user / stream volumes live in `userPrefs.peerVolumes` / `streamVolumes` (0–2); `RemoteAudio` applies them via HTML `audio.volume` (capped at 100% — Web Audio gain was reverted after it silenced peers).
- Screen share uses a full stage with cameras in the top filmstrip and a single bottom-right camera PiP (no side camera pane).
- Self camera PiP is consistently placed at the lower right so it does not obscure screen-share labels.
- Voice ping shows the slowest selected WebRTC peer path; the tooltip distinguishes local voice RTT from signaling-server RTT when alone.
- DM call overlays show each party’s own locally measured WebRTC RTT.
- `GifPicker.tsx` provides debounced Tenor search; selected GIFs are imported by the backend before being attached to a server or DM message.

### Collapsible rails and adaptive video

- The desktop channel rail persists `nepsis_channel_rail_minimized` and switches between 288px and 56px. Mobile continues to use the full-width slide-over.
- Minimized mode keeps channel type icons, selection, voice connection state, DM unread count, and compact avatar/mute/deafen/settings controls available.
- `VoiceView` is an inline-size container. Gallery columns and dual camera/screen stages respond to actual content width after either sidebar changes—not only viewport breakpoints.
- Video elements keep stable participant keys/streams; a `ResizeObserver` retries playback after rail transitions without remounting media.

### Channel organization

- Category headers can be dragged above/below Text/Voice sections.
- Channels can be dropped directly onto another category header or a channel in another category.
- Voice-user drop zones are ignored while dragging channels, preventing snap-back over voice rows.
- While dragging a voice user, only `voice-drop-*` targets are considered (`pointerWithin` then `closestCenter`); voice rows highlight and empty rooms show a drop pad.
- Owner/admin gear menus expose rename/delete; deleting a category keeps its channels under uncategorized Channels.

---

## Group direct messages

- The plus button beside **Direct Messages** opens the group creator.
- Creation requires at least two friends in addition to the current user; groups are capped at 10 members.
- An open group header exposes **Add people**, filtering out existing participants.
- `DMConversation.participants` drives group titles, mentions, and per-sender message avatars.
- Group rows use their configured name or participant names. Calls and user-specific Block/Report actions stay hidden because those flows remain 1:1.
- `AppContext.createGroupDM` and `addGroupDMMembers` update conversation state immediately after backend validation.
