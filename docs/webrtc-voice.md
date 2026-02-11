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
