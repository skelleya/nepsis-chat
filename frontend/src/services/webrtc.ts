/**
 * WebRTC client - mesh topology for voice/video.
 * Uses getUserMedia for audio (Opus codec) and video.
 * Supports both BroadcastChannel and Socket.io signaling.
 */

export interface WebRTCHandlers {
  onRemoteStream: (peerId: string, userId: string, username: string, stream: MediaStream) => void
  onPeerLeft: (peerId: string) => void
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

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
]

export function createWebRTCClient(
  localId: string,
  signaling: SignalingBridge,
  handlers: WebRTCHandlers
) {
  const peers = new Map<string, { pc: RTCPeerConnection; userId?: string; username?: string }>()
  let currentLocalStream: MediaStream | null = null
  const isSocketMode = !!signaling.getSocketId

  const createPeerConnection = (remotePeerId: string, userId?: string, username?: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    pc.ontrack = (e) => {
      if (e.streams[0]) {
        const meta = peers.get(remotePeerId)
        handlers.onRemoteStream(
          remotePeerId,
          meta?.userId ?? remotePeerId,
          meta?.username ?? remotePeerId,
          e.streams[0]
        )
      }
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) signaling.sendIceCandidate(remotePeerId, e.candidate.toJSON())
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        const entry = peers.get(remotePeerId)
        peers.delete(remotePeerId)
        handlers.onPeerLeft(entry?.userId ?? remotePeerId)
      }
    }

    peers.set(remotePeerId, { pc, userId, username })
    return pc
  }

  // Update stored metadata when we learn the real username from signaling
  const updatePeerMeta = (peerId: string, userId?: string, username?: string) => {
    const entry = peers.get(peerId)
    if (entry) {
      if (userId) entry.userId = userId
      if (username) entry.username = username
    }
  }

  const addLocalStream = (stream: MediaStream) => {
    currentLocalStream = stream
    peers.forEach(({ pc }) => {
      pc.getSenders().forEach((s) => pc.removeTrack(s))
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))
    })
  }

  const handleOffer = async (from: string, sdp: RTCSessionDescriptionInit, fromUserId?: string, fromUsername?: string) => {
    if (from === localId) return
    let entry = peers.get(from)
    if (!entry) {
      const pc = createPeerConnection(from, fromUserId, fromUsername)
      entry = { pc, userId: fromUserId, username: fromUsername }
    } else {
      // Update metadata if we now have a username
      updatePeerMeta(from, fromUserId, fromUsername)
    }

    // Add ALL local tracks (audio + any video) so bidirectional media works
    if (currentLocalStream) {
      const existingSenders = entry.pc.getSenders().filter((s) => s.track !== null)
      if (existingSenders.length === 0) {
        currentLocalStream.getTracks().forEach((track) => {
          entry!.pc.addTrack(track, currentLocalStream!)
        })
      }
    }

    await entry.pc.setRemoteDescription(new RTCSessionDescription(sdp))
    const answer = await entry.pc.createAnswer()
    await entry.pc.setLocalDescription(answer)
    if (entry.pc.localDescription) signaling.sendAnswer(from, entry.pc.localDescription)
  }

  const handleAnswer = async (from: string, sdp: RTCSessionDescriptionInit, fromUserId?: string, fromUsername?: string) => {
    const entry = peers.get(from)
    if (entry) {
      updatePeerMeta(from, fromUserId, fromUsername)
      await entry.pc.setRemoteDescription(new RTCSessionDescription(sdp))
    }
  }

  const handleIceCandidate = async (from: string, candidate: RTCIceCandidateInit) => {
    const entry = peers.get(from)
    if (entry) await entry.pc.addIceCandidate(new RTCIceCandidate(candidate))
  }

  const handlePeerJoined = (remotePeerId: string, userId?: string, username?: string) => {
    if (remotePeerId === localId) return
    if (peers.has(remotePeerId)) return

    if (isSocketMode) {
      // Socket mode: Only existing peers receive 'peer-joined', so no glare risk.
      if (currentLocalStream) {
        connectToPeer(remotePeerId, currentLocalStream, userId, username)
      }
    } else {
      // BroadcastChannel mode: Both tabs see the join, use ID comparison.
      const shouldInitiate = localId < remotePeerId
      if (currentLocalStream && shouldInitiate) {
        connectToPeer(remotePeerId, currentLocalStream, userId, username)
      }
    }
  }

  const connectToPeer = async (remotePeerId: string, localStream: MediaStream, userId?: string, username?: string) => {
    if (remotePeerId === localId) return
    if (peers.has(remotePeerId)) return

    currentLocalStream = localStream
    const pc = createPeerConnection(remotePeerId, userId, username)
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream))

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    if (pc.localDescription) signaling.sendOffer(remotePeerId, pc.localDescription)
  }

  // ─── Video/Screen share: add/remove tracks + renegotiate ───────────

  const addTrackToAllPeers = async (track: MediaStreamTrack, stream: MediaStream) => {
    for (const [peerId, { pc }] of peers) {
      try {
        pc.addTrack(track, stream)
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        if (pc.localDescription) signaling.sendOffer(peerId, pc.localDescription)
      } catch (err) {
        console.error('Renegotiation (add track) failed for', peerId, err)
      }
    }
  }

  const removeTrackFromAllPeers = async (track: MediaStreamTrack) => {
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

  const leave = () => {
    peers.forEach(({ pc }) => pc.close())
    peers.clear()
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
      peers?: { socketId: string; userId: string; username: string }[]
    }

    if (m.type === 'room-peers') {
      // Informational — existing peers will initiate via peer-joined
      return
    }

    if (m.type === 'peer-joined' || (m.type === 'join' && m.userId)) {
      const peerId = m.socketId ?? m.userId!
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
      for (const [id, e] of peers) {
        if (e.userId === targetUserId || id === targetUserId) {
          e.pc.close()
          peers.delete(id)
          handlers.onPeerLeft(e.userId ?? id)
          removed = true
          break
        }
      }
      if (!removed) {
        const entry = peers.get(targetUserId)
        if (entry) {
          entry.pc.close()
          peers.delete(targetUserId)
          handlers.onPeerLeft(entry.userId ?? targetUserId)
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
    leave: () => {
      leave()
      unsubscribe()
    },
    getPeerIds: () => Array.from(peers.keys()),
  }
}
