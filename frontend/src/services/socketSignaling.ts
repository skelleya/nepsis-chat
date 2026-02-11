/**
 * Socket.io-based signaling for WebRTC voice.
 * Replaces BroadcastChannel when backend is available.
 */

import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000'

export function createSocketSignaling(
  channelId: string,
  userId: string,
  username: string
) {
  const socket = io(`${SOCKET_URL}/voice`, { autoConnect: true })

  const waitForConnect = () =>
    new Promise<void>((resolve) => {
      if (socket.connected) resolve()
      else socket.once('connect', () => resolve())
    })

  const sendOffer = (to: string, sdp: RTCSessionDescriptionInit) => {
    socket.emit('offer', { to, sdp })
  }

  const sendAnswer = (to: string, sdp: RTCSessionDescriptionInit) => {
    socket.emit('answer', { to, sdp })
  }

  const sendIceCandidate = (to: string, candidate: RTCIceCandidateInit) => {
    socket.emit('ice-candidate', { to, candidate })
  }

  const onMessage = (handler: (msg: { type: string; from?: string; fromUserId?: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit; userId?: string; socketId?: string; username?: string }) => void) => {
    socket.on('peer-joined', (data: { socketId: string; userId: string; username: string }) => {
      handler({ type: 'peer-joined', socketId: data.socketId, userId: data.userId, username: data.username })
    })
    socket.on('peer-left', (data: { userId: string }) => {
      handler({ type: 'peer-left', userId: data.userId })
    })
    socket.on('offer', (data: { from: string; fromUserId?: string; sdp: RTCSessionDescriptionInit }) => {
      handler({ type: 'offer', from: data.from, fromUserId: data.fromUserId, sdp: data.sdp })
    })
    socket.on('answer', (data: { from: string; fromUserId?: string; sdp: RTCSessionDescriptionInit }) => {
      handler({ type: 'answer', from: data.from, fromUserId: data.fromUserId, sdp: data.sdp })
    })
    socket.on('ice-candidate', (data: { from: string; fromUserId?: string; candidate: RTCIceCandidateInit }) => {
      handler({ type: 'ice-candidate', from: data.from, fromUserId: data.fromUserId, candidate: data.candidate })
    })
    return () => {
      socket.off('peer-joined')
      socket.off('peer-left')
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

  return { sendOffer, sendAnswer, sendIceCandidate, onMessage, join, leave, close, getSocketId }
}
