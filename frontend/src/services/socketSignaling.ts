/**
 * Socket.io-based signaling for WebRTC voice.
 * Replaces BroadcastChannel when backend is available.
 */

import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000'

interface PeerInfo {
  socketId: string
  userId: string
  username: string
  screenSharing?: boolean
  muted?: boolean
  deafened?: boolean
}

export function createSocketSignaling(
  channelId: string,
  userId: string,
  username: string
) {
  const socket = io(`${SOCKET_URL}/voice`, {
    autoConnect: true,
    withCredentials: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    transports: ['websocket', 'polling'],
  })
  const reconnectCallbacks = new Set<() => void>()
  let hasConnected = false

  socket.on('connect', () => {
    if (hasConnected) {
      reconnectCallbacks.forEach((cb) => cb())
      return
    }
    hasConnected = true
  })

  const waitForConnect = () =>
    new Promise<void>((resolve) => {
      if (socket.connected) resolve()
      else socket.once('connect', () => resolve())
    })

  /** Wait until the socket has an id (needed before creating the WebRTC client). */
  const ready = () => waitForConnect()

  const sendOffer = (to: string, sdp: RTCSessionDescriptionInit) => {
    socket.emit('offer', { to, sdp })
  }

  const sendAnswer = (to: string, sdp: RTCSessionDescriptionInit) => {
    socket.emit('answer', { to, sdp })
  }

  const sendIceCandidate = (to: string, candidate: RTCIceCandidateInit) => {
    socket.emit('ice-candidate', { to, candidate })
  }

  const onMessage = (handler: (msg: {
    type: string
    from?: string
    fromUserId?: string
    username?: string
    sdp?: RTCSessionDescriptionInit
    candidate?: RTCIceCandidateInit
    userId?: string
    socketId?: string
    peers?: PeerInfo[]
    screenSharing?: boolean
    muted?: boolean
    deafened?: boolean
  }) => void) => {
    socket.on('peer-joined', (data: PeerInfo) => {
      handler({
        type: 'peer-joined',
        socketId: data.socketId,
        userId: data.userId,
        username: data.username,
        screenSharing: data.screenSharing,
        muted: data.muted,
        deafened: data.deafened,
      })
    })
    socket.on('peer-left', (data: { userId: string }) => {
      handler({ type: 'peer-left', userId: data.userId })
    })
    socket.on('room-peers', (data: { peers: PeerInfo[] }) => {
      handler({ type: 'room-peers', peers: data.peers })
    })
    // FIX: Forward fromUsername as 'username' so webrtc.ts can use it for display
    socket.on('offer', (data: { from: string; fromUserId?: string; fromUsername?: string; sdp: RTCSessionDescriptionInit }) => {
      handler({ type: 'offer', from: data.from, fromUserId: data.fromUserId, username: data.fromUsername, sdp: data.sdp })
    })
    socket.on('answer', (data: { from: string; fromUserId?: string; fromUsername?: string; sdp: RTCSessionDescriptionInit }) => {
      handler({ type: 'answer', from: data.from, fromUserId: data.fromUserId, username: data.fromUsername, sdp: data.sdp })
    })
    socket.on('ice-candidate', (data: { from: string; fromUserId?: string; fromUsername?: string; candidate: RTCIceCandidateInit }) => {
      handler({ type: 'ice-candidate', from: data.from, fromUserId: data.fromUserId, username: data.fromUsername, candidate: data.candidate })
    })
    return () => {
      socket.off('peer-joined')
      socket.off('peer-left')
      socket.off('room-peers')
      socket.off('offer')
      socket.off('answer')
      socket.off('ice-candidate')
    }
  }

  const join = async () => {
    await waitForConnect()
    socket.emit('join-voice', { channelId, userId, username })
  }

  const leave = () => {
    socket.emit('leave-voice', { channelId, userId })
    socket.disconnect()
  }

  const close = () => {
    socket.disconnect()
  }

  const getSocketId = () => socket.id

  const onAdminMove = (callback: (data: { channelId: string; channelName: string }) => void) => {
    socket.on('admin-move-to-channel', callback)
    return () => socket.off('admin-move-to-channel', callback)
  }

  const onAdminMute = (callback: () => void) => {
    socket.on('admin-mute', callback)
    return () => socket.off('admin-mute', callback)
  }

  const onAdminDisconnect = (callback: () => void) => {
    socket.on('admin-disconnect-from-voice', callback)
    return () => socket.off('admin-disconnect-from-voice', callback)
  }

  /** Another device of this user joined voice — leave quietly on this client. */
  const onVoiceSessionReplaced = (callback: (data: { reason?: string; channelId?: string }) => void) => {
    socket.on('voice-session-replaced', callback)
    return () => socket.off('voice-session-replaced', callback)
  }

  const emitSoundboardPlay = (soundUrl: string) => {
    socket.emit('soundboard-play', { soundUrl, userId, username })
  }

  const onSoundboardPlay = (callback: (data: { soundUrl: string; userId: string; username: string }) => void) => {
    socket.on('soundboard-play', callback)
    return () => socket.off('soundboard-play', callback)
  }

  const emitScreenShare = (active: boolean) => {
    socket.emit('screen-share', { active: !!active })
  }

  const onScreenShare = (callback: (data: { userId: string; active: boolean }) => void) => {
    socket.on('screen-share', callback)
    return () => socket.off('screen-share', callback)
  }

  const emitVoiceState = (state: { muted: boolean; deafened: boolean }) => {
    socket.emit('voice-state', {
      muted: !!state.muted,
      deafened: !!state.deafened,
    })
  }

  const onVoiceState = (callback: (data: { userId: string; muted: boolean; deafened: boolean }) => void) => {
    socket.on('voice-state', callback)
    return () => socket.off('voice-state', callback)
  }

  const onReconnect = (callback: () => void) => {
    reconnectCallbacks.add(callback)
    return () => reconnectCallbacks.delete(callback)
  }

  /** Round-trip ms to the signaling server (fallback when no WebRTC peers). */
  const measureLatency = () =>
    new Promise<number | null>((resolve) => {
      if (!socket.connected) {
        resolve(null)
        return
      }
      const t0 = Date.now()
      const timer = setTimeout(() => {
        socket.off('latency-pong', onPong)
        resolve(null)
      }, 2500)
      const onPong = () => {
        clearTimeout(timer)
        resolve(Math.max(0, Date.now() - t0))
      }
      socket.once('latency-pong', onPong)
      socket.emit('latency-ping', t0)
    })

  return {
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    onMessage,
    ready,
    join,
    leave,
    close,
    getSocketId,
    onAdminMove,
    onAdminMute,
    onAdminDisconnect,
    onVoiceSessionReplaced,
    emitSoundboardPlay,
    onSoundboardPlay,
    emitScreenShare,
    onScreenShare,
    emitVoiceState,
    onVoiceState,
    onReconnect,
    measureLatency,
  }
}
