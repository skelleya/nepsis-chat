/**
 * WebRTC client - mesh topology for voice/video.
 * Uses getUserMedia for audio (Opus codec) and video.
 * Supports both BroadcastChannel and Socket.io signaling.
 * Applies high-quality codec prefs + bitrates (see mediaQuality.ts).
 */

import { applyPeerConnectionQuality, applySenderQuality, preferHighQualityCodecs } from './mediaQuality'

export interface WebRTCHandlers {
  onRemoteStream: (peerId: string, userId: string, username: string, stream: MediaStream) => void
  onPeerLeft: (peerId: string) => void
  /** Called when we learn about a peer. playSound: only true when someone joins while we're in (peer-joined), not for room-peers */
  onPeerJoined?: (userId: string, username: string, playSound?: boolean) => void
  /** Presence metadata delivered before media tracks exist. */
  onPeerMetadata?: (
    userId: string,
    metadata: { screenSharing?: boolean; muted?: boolean; deafened?: boolean }
  ) => void
}

export interface SignalingBridge {
  sendOffer: (to: string, sdp: RTCSessionDescriptionInit) => void
  sendAnswer: (to: string, sdp: RTCSessionDescriptionInit) => void
  sendIceCandidate: (to: string, candidate: RTCIceCandidateInit) => void
  onMessage: (handler: (msg: unknown) => void) => () => void
  join: () => void
  leave: () => void
  close: () => void
  getSocketId?: () => string | undefined
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

export function createWebRTCClient(
  localId: string,
  signaling: SignalingBridge,
  handlers: WebRTCHandlers,
  iceServers: RTCIceServer[] = DEFAULT_ICE_SERVERS
) {
  const peers = new Map<string, { pc: RTCPeerConnection; userId?: string; username?: string; remoteStream: MediaStream }>()
  // Reverse map: userId → socketId, so we can look up peers by either key
  const userIdToSocketId = new Map<string, string>()
  // Buffer ICE candidates that arrive before the remote description is set
  const pendingCandidates = new Map<string, RTCIceCandidateInit[]>()
  let currentLocalStream: MediaStream | null = null
  /** Camera/screen tracks that must also be sent to peers who join after share started */
  const extraOutbound: { track: MediaStreamTrack; stream: MediaStream }[] = []
  const resolvedIceServers = iceServers.length > 0 ? iceServers : DEFAULT_ICE_SERVERS

  const attachExtraTracks = (pc: RTCPeerConnection) => {
    for (const { track, stream } of extraOutbound) {
      if (track.readyState === 'ended') continue
      const already = pc.getSenders().some((s) => s.track === track)
      if (!already) {
        const sender = pc.addTrack(track, stream)
        void applySenderQuality(sender)
      }
    }
  }

  const tunePc = (pc: RTCPeerConnection) => {
    preferHighQualityCodecs(pc)
    void applyPeerConnectionQuality(pc)
  }

  /** Drop an old PC for the same user when their socket id changes (session replace). */
  const retireSocketPeer = (socketId: string, notifyLeft: boolean) => {
    const entry = peers.get(socketId)
    if (!entry) return
    try {
      entry.pc.close()
    } catch {
      /* ignore */
    }
    peers.delete(socketId)
    pendingCandidates.delete(socketId)
    if (entry.userId && userIdToSocketId.get(entry.userId) === socketId) {
      userIdToSocketId.delete(entry.userId)
    }
    if (notifyLeft && entry.userId) handlers.onPeerLeft(entry.userId)
  }

  const createPeerConnection = (remotePeerId: string, userId?: string, username?: string): RTCPeerConnection => {
    // Same user reconnecting with a new socket — close the stale PC first
    if (userId) {
      const prevSocket = userIdToSocketId.get(userId)
      if (prevSocket && prevSocket !== remotePeerId) {
        retireSocketPeer(prevSocket, false)
      }
    }

    const pc = new RTCPeerConnection({
      iceServers: resolvedIceServers,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    })

    // Create a single combined remote stream per peer so audio + video tracks coexist
    const remoteStream = new MediaStream()

    pc.ontrack = (e) => {
      const existingTrack = remoteStream.getTrackById(e.track.id)
      if (!existingTrack) {
        remoteStream.addTrack(e.track)
      }

      // Never invent socketId as userId — that created phantom "Connecting..." tiles
      const getDisplayMeta = () => {
        const meta = peers.get(remotePeerId)
        if (!meta?.userId) return null
        return {
          userId: meta.userId,
          username: meta.username || 'User',
        }
      }

      const handleTrackGone = () => {
        if (remoteStream.getTrackById(e.track.id)) {
          remoteStream.removeTrack(e.track)
          const display = getDisplayMeta()
          if (display) {
            handlers.onRemoteStream(remotePeerId, display.userId, display.username, remoteStream)
          }
        }
      }
      // Only ended means the track is gone. Browsers briefly mute video during
      // renegotiation (camera/screen add) — treating mute as remove hid screen share.
      e.track.onended = handleTrackGone
      e.track.onunmute = () => {
        if (!remoteStream.getTrackById(e.track.id)) {
          remoteStream.addTrack(e.track)
        }
        const display = getDisplayMeta()
        if (display) {
          handlers.onRemoteStream(remotePeerId, display.userId, display.username, remoteStream)
        }
      }

      const display = getDisplayMeta()
      if (display) {
        handlers.onRemoteStream(remotePeerId, display.userId, display.username, remoteStream)
      }
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) signaling.sendIceCandidate(remotePeerId, e.candidate.toJSON())
    }

    const markPeerFailed = () => {
      const entry = peers.get(remotePeerId)
      if (!entry || entry.pc !== pc) return
      retireSocketPeer(remotePeerId, true)
    }

    pc.onconnectionstatechange = () => {
      // Ignore transient "disconnected" (ICE restart may recover). Always close PC when removing.
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        markPeerFailed()
      }
    }

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        markPeerFailed()
      }
    }

    peers.set(remotePeerId, { pc, userId, username, remoteStream })
    if (userId) userIdToSocketId.set(userId, remotePeerId)
    return pc
  }

  // Update stored metadata when we learn the real username from signaling
  const updatePeerMeta = (peerId: string, userId?: string, username?: string) => {
    const entry = peers.get(peerId)
    if (!entry) return
    if (userId) {
      entry.userId = userId
      userIdToSocketId.set(userId, peerId)
    }
    if (username) entry.username = username
    // Tracks can arrive before userId is known — flush UI once meta is set
    if (entry.userId && entry.remoteStream.getTracks().length > 0) {
      handlers.onRemoteStream(
        peerId,
        entry.userId,
        entry.username || 'User',
        entry.remoteStream
      )
    }
  }

  const addLocalStream = (stream: MediaStream) => {
    currentLocalStream = stream
    peers.forEach((entry) => {
      entry.pc.getSenders().forEach((s) => entry.pc.removeTrack(s))
      stream.getTracks().forEach((track) => entry.pc.addTrack(track, stream))
      attachExtraTracks(entry.pc)
    })
  }

  const handleOffer = async (from: string, sdp: RTCSessionDescriptionInit, fromUserId?: string, fromUsername?: string) => {
    if (from === localId) return
    let entry = peers.get(from)
    if (!entry) {
      createPeerConnection(from, fromUserId, fromUsername)
      entry = peers.get(from)!
    } else {
      // Update metadata if we now have a username
      updatePeerMeta(from, fromUserId, fromUsername)
    }

    // Add ALL local tracks (audio + camera/screen) so bidirectional media works
    // Only add if not already sending (first connection)
    if (currentLocalStream) {
      const existingSenders = entry.pc.getSenders().filter((s) => s.track !== null)
      if (existingSenders.length === 0) {
        currentLocalStream.getTracks().forEach((track) => {
          const sender = entry!.pc.addTrack(track, currentLocalStream!)
          void applySenderQuality(sender)
        })
        attachExtraTracks(entry.pc)
      }
    }

    try {
      // Perfect negotiation (polite peer): on glare, exactly one side yields.
      // Always-rollback made both peers accept each other's offer, then ignore
      // each other's answers in "stable" — no matched session → silent/blind.
      if (entry.pc.signalingState === 'have-local-offer') {
        const mySocketId = signaling.getSocketId?.() ?? localId
        const isPolite = mySocketId > from // higher id yields to remote offer
        if (isPolite) {
          await entry.pc.setLocalDescription({ type: 'rollback' })
        } else {
          // Impolite: keep our offer; their colliding offer is ignored
          return
        }
      }

      await entry.pc.setRemoteDescription(new RTCSessionDescription(sdp))
      await flushCandidates(from, entry.pc)
      tunePc(entry.pc)
      const answer = await entry.pc.createAnswer()
      await entry.pc.setLocalDescription(answer)
      void applyPeerConnectionQuality(entry.pc)
      if (entry.pc.localDescription) signaling.sendAnswer(from, entry.pc.localDescription)
    } catch (err) {
      console.warn('handleOffer failed for', from, err)
    }
  }

  const handleAnswer = async (from: string, sdp: RTCSessionDescriptionInit, fromUserId?: string, fromUsername?: string) => {
    const entry = peers.get(from)
    if (!entry) return
    updatePeerMeta(from, fromUserId, fromUsername)
    // Only apply the answer if we're actually waiting for one (have-local-offer).
    // Answers arriving in "stable" state are stale/duplicate — ignore them.
    if (entry.pc.signalingState !== 'have-local-offer') return
    try {
      await entry.pc.setRemoteDescription(new RTCSessionDescription(sdp))
      await flushCandidates(from, entry.pc)
    } catch (err) {
      console.warn('setRemoteDescription (answer) failed for', from, err)
    }
  }

  // Flush any ICE candidates that were buffered while waiting for remote description
  const flushCandidates = async (peerId: string, pc: RTCPeerConnection) => {
    const queued = pendingCandidates.get(peerId)
    if (!queued || queued.length === 0) return
    pendingCandidates.delete(peerId)
    for (const c of queued) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch { /* ignore late candidates */ }
    }
  }

  const handleIceCandidate = async (from: string, candidate: RTCIceCandidateInit) => {
    const entry = peers.get(from)
    if (!entry) return
    // Buffer if remote description isn't set yet
    if (!entry.pc.remoteDescription) {
      const buf = pendingCandidates.get(from) || []
      buf.push(candidate)
      pendingCandidates.set(from, buf)
      return
    }
    try {
      await entry.pc.addIceCandidate(new RTCIceCandidate(candidate))
    } catch (err) {
      console.warn('addIceCandidate failed for', from, err)
    }
  }

  const handlePeerJoined = (remotePeerId: string, userId?: string, username?: string) => {
    if (remotePeerId === localId) return
    if (peers.has(remotePeerId)) return

    // Both socket modes fire this: existing peers via peer-joined, joiners via
    // room-peers. Always pick one offerer by socket/local id so we don't glare
    // on every 2-person join (dual offer + always-rollback broke all media).
    const myId = signaling.getSocketId?.() ?? localId
    const shouldInitiate = myId < remotePeerId
    if (currentLocalStream && shouldInitiate) {
      connectToPeer(remotePeerId, currentLocalStream, userId, username)
    }
  }

  const connectToPeer = async (remotePeerId: string, localStream: MediaStream, userId?: string, username?: string) => {
    if (remotePeerId === localId) return
    if (peers.has(remotePeerId)) return

    currentLocalStream = localStream
    const pc = createPeerConnection(remotePeerId, userId, username)
    localStream.getTracks().forEach((track) => {
      const sender = pc.addTrack(track, localStream)
      void applySenderQuality(sender)
    })
    // Late joiners must also receive camera/screen already being shared
    attachExtraTracks(pc)
    tunePc(pc)

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    void applyPeerConnectionQuality(pc)
    if (pc.localDescription) signaling.sendOffer(remotePeerId, pc.localDescription)
  }

  // ─── Video/Screen share: add/remove tracks + renegotiate ───────────

  const addTrackToAllPeers = async (track: MediaStreamTrack, stream: MediaStream) => {
    if (!extraOutbound.some((e) => e.track === track)) {
      extraOutbound.push({ track, stream })
    }
    // Do NOT set contentHint='detail' on all video — that made remote cameras look like
    // screen shares (isScreenShareTrack). Screen tracks set contentHint in VoiceContext.
    for (const [peerId, { pc }] of peers) {
      try {
        if (!pc.getSenders().some((s) => s.track === track)) {
          const sender = pc.addTrack(track, stream)
          void applySenderQuality(sender)
        }
        tunePc(pc)
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        void applyPeerConnectionQuality(pc)
        if (pc.localDescription) signaling.sendOffer(peerId, pc.localDescription)
      } catch (err) {
        console.error('Renegotiation (add track) failed for', peerId, err)
      }
    }
  }

  const removeTrackFromAllPeers = async (track: MediaStreamTrack) => {
    const idx = extraOutbound.findIndex((e) => e.track === track)
    if (idx >= 0) extraOutbound.splice(idx, 1)
    for (const [peerId, { pc }] of peers) {
      const sender = pc.getSenders().find((s) => s.track === track)
      if (sender) {
        try {
          pc.removeTrack(sender)
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          if (pc.localDescription) signaling.sendOffer(peerId, pc.localDescription)
        } catch (err) {
          console.error('Renegotiation (remove track) failed for', peerId, err)
        }
      }
    }
  }

  // ─── Ping measurement via RTCPeerConnection stats ─────────────────

  const getPing = async (): Promise<number | null> => {
    for (const [, { pc }] of peers) {
      try {
        const stats = await pc.getStats()
        for (const report of stats.values()) {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            const rtt = (report as { currentRoundTripTime?: number }).currentRoundTripTime
            if (rtt != null) return Math.round(rtt * 1000)
          }
        }
      } catch { /* ignore */ }
    }
    return null
  }

  // ─── Signaling message handler ────────────────────────────────────

  const resetPeers = () => {
    peers.forEach(({ pc }) => pc.close())
    peers.clear()
    userIdToSocketId.clear()
    pendingCandidates.clear()
  }

  const leave = () => {
    resetPeers()
    extraOutbound.length = 0
    signaling.leave()
    signaling.close()
  }

  const unsubscribe = signaling.onMessage((msg: unknown) => {
    const m = msg as {
      type: string
      from?: string
      fromUserId?: string
      userId?: string
      socketId?: string
      username?: string
      sdp?: RTCSessionDescriptionInit
      candidate?: RTCIceCandidateInit
      peers?: {
        socketId: string
        userId: string
        username: string
        screenSharing?: boolean
        muted?: boolean
        deafened?: boolean
      }[]
      screenSharing?: boolean
      muted?: boolean
      deafened?: boolean
    }

    if (m.type === 'room-peers') {
      // New joiner: add participants and connect to existing peers (no sound — we're the one who joined)
      for (const p of m.peers || []) {
        handlers.onPeerMetadata?.(p.userId, {
          screenSharing: p.screenSharing,
          muted: p.muted,
          deafened: p.deafened,
        })
        handlers.onPeerJoined?.(p.userId, p.username, false)
        handlePeerJoined(p.socketId, p.userId, p.username)
      }
      return
    }

    if (m.type === 'peer-joined' || (m.type === 'join' && m.userId)) {
      const peerId = m.socketId ?? m.userId!
      handlers.onPeerMetadata?.(m.userId ?? peerId, {
        screenSharing: m.screenSharing,
        muted: m.muted,
        deafened: m.deafened,
      })
      handlers.onPeerJoined?.(m.userId ?? peerId, m.username || 'Unknown', true)
      handlePeerJoined(peerId, m.userId, m.username)
      return
    }
    if (m.type === 'leave' && m.userId) {
      const peerId = m.userId
      const entry = peers.get(peerId)
      if (entry) {
        entry.pc.close()
        peers.delete(peerId)
        handlers.onPeerLeft(peerId)
      }
      return
    }
    if (m.type === 'peer-left') {
      const targetUserId = m.userId!
      let removed = false
      // Try reverse map first (userId → socketId)
      const socketId = userIdToSocketId.get(targetUserId)
      if (socketId) {
        const entry = peers.get(socketId)
        if (entry) {
          entry.pc.close()
          peers.delete(socketId)
          userIdToSocketId.delete(targetUserId)
          handlers.onPeerLeft(entry.userId ?? targetUserId)
          removed = true
        }
      }
      if (!removed) {
        for (const [id, e] of peers) {
          if (e.userId === targetUserId || id === targetUserId) {
            e.pc.close()
            peers.delete(id)
            if (e.userId) userIdToSocketId.delete(e.userId)
            handlers.onPeerLeft(e.userId ?? id)
            removed = true
            break
          }
        }
      }
      return
    }
    const from = m.from!
    if (m.type === 'offer') handleOffer(from, m.sdp!, m.fromUserId, m.username)
    if (m.type === 'answer') handleAnswer(from, m.sdp!, m.fromUserId, m.username)
    if (m.type === 'ice-candidate') handleIceCandidate(from, m.candidate!)
  })

  return {
    connectToPeer,
    addLocalStream,
    setLocalStream: (stream: MediaStream) => { currentLocalStream = stream },
    addTrackToAllPeers,
    removeTrackFromAllPeers,
    getPing,
    resetPeers,
    leave: () => {
      leave()
      unsubscribe()
    },
    getPeerIds: () => Array.from(peers.keys()),
  }
}
