/**
 * WebRTC client - mesh topology for voice/video.
 * Uses getUserMedia for audio (Opus codec) and video.
 * Supports both BroadcastChannel and Socket.io signaling.
 */

export interface WebRTCHandlers {
  onRemoteStream: (peerId: string, userId: string, username: string, stream: MediaStream) => void
  onPeerLeft: (peerId: string) => void
  /** Called when we learn about a peer (e.g. from room-peers) before we have their stream */
  onPeerJoined?: (userId: string, username: string) => void
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
  const peers = new Map<string, { pc: RTCPeerConnection; userId?: string; username?: string; remoteStream: MediaStream }>()
  let currentLocalStream: MediaStream | null = null
  const isSocketMode = !!signaling.getSocketId

  const createPeerConnection = (remotePeerId: string, userId?: string, username?: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    // Create a single combined remote stream per peer so audio + video tracks coexist
    const remoteStream = new MediaStream()

    pc.ontrack = (e) => {
      // Add the incoming track to our combined stream
      // Remove duplicate tracks first
      const existingTrack = remoteStream.getTrackById(e.track.id)
      if (!existingTrack) {
        remoteStream.addTrack(e.track)
      }

      // Clean up when track ends (e.g. remote stops camera/screen share)
      const handleTrackGone = () => {
        if (remoteStream.getTrackById(e.track.id)) {
          remoteStream.removeTrack(e.track)
          const meta = peers.get(remotePeerId)
          handlers.onRemoteStream(
            remotePeerId,
            meta?.userId ?? remotePeerId,
            meta?.username ?? remotePeerId,
            remoteStream
          )
        }
      }
      e.track.onended = handleTrackGone
      // Some browsers fire 'mute' instead of 'ended' for remote track removal
      e.track.onmute = () => {
        // Only remove video tracks on mute (audio tracks get muted normally)
        if (e.track.kind === 'video') {
          handleTrackGone()
        }
      }

      const meta = peers.get(remotePeerId)
      handlers.onRemoteStream(
        remotePeerId,
        meta?.userId ?? remotePeerId,
        meta?.username ?? remotePeerId,
        remoteStream
      )
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

    peers.set(remotePeerId, { pc, userId, username, remoteStream })
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
    peers.forEach((entry) => {
      entry.pc.getSenders().forEach((s) => entry.pc.removeTrack(s))
      stream.getTracks().forEach((track) => entry.pc.addTrack(track, stream))
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

    // Add ALL local tracks (audio + any video) so bidirectional media works
    // Only add if not already sending (first connection)
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
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream)
    })

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
      // New joiner: add participants so main screen shows correct count before streams arrive
      for (const p of m.peers || []) {
        handlers.onPeerJoined?.(p.userId, p.username)
      }
      return
    }

    if (m.type === 'peer-joined' || (m.type === 'join' && m.userId)) {
      const peerId = m.socketId ?? m.userId!
      handlers.onPeerJoined?.(m.userId ?? peerId, m.username ?? peerId)
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
