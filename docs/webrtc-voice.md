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
6. Remote stream → RemoteAudio component

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

## ICE Servers

- `stun:stun.l.google.com:19302`
- TURN can be added later for NAT traversal

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
2. Each sound has an emoji (default 🔊; pick when adding or click to edit)
3. In voice, user clicks a sound → `emitSoundboardPlay(soundUrl)` via Socket.io
4. Backend broadcasts `soundboard-play` to room (including sender)
5. All peers receive event → play audio locally (unless deafened or soundboard muted)
6. Spam-click restarts the sound from the beginning
7. Per-user soundboard mute (🔊/🔇) in voice bar — lets users stop hearing soundboard without deafening
8. Works only with Socket.io signaling (BroadcastChannel has no soundboard)

### Resizable Voice Layout (Voice UI v6)

- **Single participant:** Centered in the middle of the view (vertically and horizontally).
- **Screen share:** When anyone shares a screen (local or remote), the layout becomes a vertical split: screen share on top, participant cameras below. Drag the divider to resize — make the screen bigger and cameras smaller or vice versa.
- **2–4 participants:** Participant cards are in a horizontal resizable panel group. Drag dividers between cards to resize.
- **5+ participants:** Grid layout (no per-card resizing).
- Layout is persisted via `autoSaveId` (localStorage).

### Track Removal

When a user stops camera/screen share:
1. `removeTrackFromAllPeers(track)` removes the sender and sends a renegotiation offer
2. Remote side processes the new SDP; `track.onended` or `track.onmute` fires
3. Track is removed from the combined stream; `useVideoTrackCount` hook updates the UI
4. `ParticipantCard` switches back to avatar mode

---

## Troubleshooting

### Cannot see/hear other users in voice

- **Different machines/browsers:** BroadcastChannel only works for same-origin tabs on the same machine. For 2+ users on different devices, you must:
  1. Run the backend (`npm run dev:backend`)
  2. Set `VITE_API_URL` (e.g. `http://localhost:3000/api` in `.env.development`)
  3. Both users connect to the same backend URL
- **Same machine, 2 tabs:** BroadcastChannel works; ensure both tabs join the same voice channel
- **Microphone permissions:** Both users must allow microphone access

### Cannot see friend's camera/screen share

- Ensure both users are on the same backend (Socket.io signaling)
- Check browser console for renegotiation errors
- STUN server must be reachable (stun.l.google.com:19302)
- If behind strict NAT/firewall, you may need a TURN server
