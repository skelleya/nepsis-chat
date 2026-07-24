# WebRTC & Voice

Voice channels with WebRTC and Opus codec.

---

## Overview

- **Audio:** getUserMedia (audio only)
- **Codec:** Opus (WebRTC default)
- **Topology:** Mesh (P2P) for 2–4 users
- **Signaling:** BroadcastChannel (2-tab) or Socket.io (with backend)

---

## Flow

1. User clicks "Join Voice" → getUserMedia
2. Create signaling (BroadcastChannel or Socket.io)
3. Broadcast/emit "join"
4. Peers connect: lower ID creates offer
5. Offer → Answer → ICE candidates
6. Remote stream → session-owned `RemoteAudio` sinks (mic + optional screen audio) via Web Audio gain

---

## Signaling

### BroadcastChannel (no backend)

- Used when `VITE_API_URL` is not set
- Same-origin tabs share a channel
- Good for 2-tab testing

### Socket.io (with backend)

- Used when `VITE_API_URL` is set
- Server relays SDP/ICE between peers
- Room: `voice:{channelId}`

---

## Service Layout

| Service | Purpose |
|---------|---------|
| signaling.ts | BroadcastChannel adapter |
| socketSignaling.ts | Socket.io adapter |
| webrtc.ts | RTCPeerConnection, offer/answer/ICE |

---

## ICE Servers (STUN + TURN)

Voice channels and DM calls stay **P2P**. STUN finds a public address; **TURN** relays media only when a direct path fails (strict NAT/firewall).

| Source | Priority | Config |
|--------|----------|--------|
| `GET /api/webrtc/ice` | Preferred | Backend `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` |
| Vite env | Fallback | `VITE_TURN_URLS`, `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL` |
| Built-in | Always | Google STUN (`stun.l.google.com`, `stun1.l.google.com`) |

Shared helper: `frontend/src/services/iceConfig.ts` → used by `VoiceContext`, `CallContext`, `useVoiceChannel`, `webrtc.ts`.

### Quick TURN options

1. **Managed** — Metered, Twilio Network Traversal, Cloudflare Calls TURN, etc. Paste URLs + creds into backend `.env`.
2. **Self-host coturn** (e.g. Hetzner monthly) — example:

```bash
# docker run example (replace passwords / realm / external IP)
docker run -d --network=host instrumentisto/coturn \
  -n --log-file=stdout \
  --realm=turn.example.com \
  --external-ip=YOUR_PUBLIC_IP \
  --listening-port=3478 \
  --fingerprint --lt-cred-mech \
  --user=nepsis:CHANGE_ME \
  --no-multicast-peers
```

```env
# backend/.env
TURN_URLS=turn:YOUR_PUBLIC_IP:3478,turns:YOUR_PUBLIC_IP:5349
TURN_USERNAME=nepsis
TURN_CREDENTIAL=CHANGE_ME
```

Open UDP/TCP **3478** (and **5349** if using TLS). Restart the backend after changing env. Clients pick up TURN on the next voice join / call (ICE list is cached per page load).

Without TURN configured, the app still works via STUN + host candidates (same LAN / easy NAT).

---

## Camera & Screen Share

Camera and screen share use WebRTC renegotiation to add/remove video tracks mid-call.

### Flow (camera example)

1. User A toggles camera → `getUserMedia({ video: true })`
2. `addTrackToAllPeers(track, stream)` adds the video track to every peer connection
3. Renegotiation: new SDP offer sent to all peers
4. User B receives the offer → `handleOffer` sets remote description → `ontrack` fires
5. Video track is added to the combined `remoteStream` for that peer
6. `ParticipantCard` detects video tracks and renders a `<video>` element

### Combined Remote Stream

Each peer maintains **one combined `MediaStream`** per remote peer. All incoming tracks (audio, camera video, screen video) are added to it. This prevents the bug where a new video stream overwrites the audio stream.

### Soundboard

Users can play custom audio clips (max 10 seconds) to all peers in a voice channel. Flow:

1. User uploads sounds via Soundboard UI (attachments bucket, `soundboard/{userId}/`)
   - Sources longer than ten seconds open the clip editor; the selected segment is exported as WAV before upload.
2. Each sound has an emoji (default 🔊; pick when adding or click to edit)
3. In voice, user clicks a sound → `emitSoundboardPlay(soundUrl)` via Socket.io
4. Sender plays once immediately; backend relays `soundboard-play` to other room members only
5. Peers receive one event and restart that URL cleanly (unless deafened or soundboard muted)
6. Spam-click restarts the sound from the beginning
7. Per-user soundboard mute (🔊/🔇) in voice bar — lets users stop hearing soundboard without deafening
8. Works only with Socket.io signaling (BroadcastChannel has no soundboard)

### Capture quality

- Camera presets: 1920×1080 or 2560×1440, up to 60 capture fps.
- Screen presets: 1920×1080, 2560×1440, or 3840×2160, up to 60 capture fps.
- Sender ceilings adapt to the captured track: up to 8 Mbps camera and 16 Mbps screen.
- Constraints are ideals/maximums, not a guarantee. The browser can return a lower resolution or bitrate for unsupported cameras, displays, encoders, or network conditions.
- **Include screen audio** is device-local under Voice & Video. When enabled, `getDisplayMedia` requests tab/system audio without voice processing. Browser/OS picker support still determines availability. Screen audio is included for viewers watching that share; microphone audio remains available to the whole voice channel.
- **Per-user volume:** Click/right-click a remote participant card → **User volume** (0–200%, default 100%). Persisted in `peerVolumes`. Applied with Web Audio `GainNode` (supports boost above 100%).
- **Stream volume:** Same menu while they share → **Stream volume** for their screen-share audio tracks (while you watch). Persisted in `streamVolumes`.
- **Gallery size:** `--voice-grid-min` ~320/260/200px so camera cards stay larger in gallery mode.

### Same-account tabs

Only one tab owns microphone/WebRTC media. The owner publishes a short-lived heartbeat in `localStorage` and `BroadcastChannel`; other tabs become observers:

- They preserve the owner’s `in-voice` database presence.
- They display the account under the correct channel and can browse its gallery.
- Opening that same channel does not emit `join-voice`, so it cannot trigger session replacement.
- Starting/joining a different voice session remains an explicit transfer and the backend single-session guard still prevents duplicate microphones and echo.

### Resizable Voice Layout (Voice UI v6 / Discord watch)

- **Single participant:** Centered in the middle of the view (vertically and horizontally).
- **Screen share (click to watch):** Shares do **not** auto-fill the stage for viewers. Click a LIVE badge (channel list or participant tile) to watch. Your own share auto-focuses when you start sharing. Close (X) or click again to stop watching. Layout: focus stage + filmstrip (not auto-watch for remotes).
- **Late joiners:** `room-peers` includes `screenSharing` / `muted` / `deafened` so new peers seed share + mute badges immediately. `webrtc.ts` also keeps `extraOutbound` camera/screen tracks for renegotiation attach.
- **Mute badges:** Local mute/deafen emits `voice-state` on `/voice`; peers show remote mute icons.
- **Ghost tiles:** `leftUserIds` excludes presence-stale leavers from the “Connecting…” merge for ~10s.
- **Reconnect:** Voice socket `onReconnect` re-emits join and resets peer connections.
- **DM call gate:** Joining voice while a DM call is active is blocked via `mediaSessionGate`.
- Helpers: `frontend/src/utils/mediaTracks.ts` (`isScreenShareTrack`, `getScreenShareStream`, …).

### Track Removal

When a user stops camera/screen share:
1. `removeTrackFromAllPeers(track)` removes the sender and sends a renegotiation offer
2. Remote side processes the new SDP; ended/removal means the track is gone, while mute/unmute controls temporary tile visibility
3. `useVideoTrackCount` listens for stream and track lifecycle changes; `TileVideo` clears stale frames
4. `ParticipantCard` switches back to avatar mode

---

## Best ping (what the “server” actually does)

Voice/DM media is **mesh P2P**. The backend Socket.io server only does **signaling** (SDP/ICE/join). It does **not** relay audio/video unless a peer falls back to **TURN**.

| Goal | What to do |
|------|------------|
| Lowest ping | Prefer a **direct** ICE path (`host` on LAN, or `srflx` via STUN). Hover the voice ping bars — tooltip shows path type. |
| Connectivity when NAT fails | Configure **TURN** (`TURN_*` on backend). Relay works but usually **raises** ping. |
| Avoid high ping | Same region / wired Ethernet; disable VPN when possible; don’t force all media through a far TURN. |
| Read the UI | Mesh shows the **slowest peer** RTT. Alone in channel = signaling-server RTT (not voice quality). |

There is no SFU media server today. For large rooms you’d need an SFU later; for 2–4 users, mesh + optional TURN is intentional.

---

## Troubleshooting

### “Permission denied by system” when joining voice

This is **not** a Nepsis server membership / ACL error. Chromium/Electron throws it when the **OS blocks the microphone** (common on Windows Privacy settings). The third person joining hits `getUserMedia` on their own machine.

- **Windows:** Settings → Privacy & security → Microphone → allow desktop apps + allow Nepsis Chat / browser → retry.
- **macOS:** System Settings → Privacy & Security → Microphone → enable Nepsis Chat.
- **Desktop app:** Electron now grants `media` / `display-capture` permission requests in `electron/main.js`.
- App UI maps this string to a clearer message via `formatMediaPermissionError`.

### Cannot see/hear other users in voice

- **Different machines/browsers:** BroadcastChannel only works for same-origin tabs on the same machine. For 2+ users on different devices, you must:
  1. Run the backend (`npm run dev:backend`)
  2. Set `VITE_API_URL` (e.g. `http://localhost:3000/api` in `.env.development`)
  3. Both users connect to the same backend URL
- **Same machine, 2 tabs:** BroadcastChannel works; ensure both tabs join the same voice channel
- **Microphone permissions:** Both users must allow microphone access (see above)

### Cannot see friend's camera/screen share

- Ensure both users are on the same backend (Socket.io signaling)
- Check browser console for renegotiation errors
- STUN server must be reachable (stun.l.google.com:19302)
- If behind strict NAT/firewall, you may need a TURN server
