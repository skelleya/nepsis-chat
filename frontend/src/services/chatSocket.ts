import { io, type Socket } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000'

let socket: Socket | null = null
let joinedRoom: string | null = null

function getSocket(): Socket {
  if (!socket) {
    socket = io(`${SOCKET_URL}/chat`, {
      autoConnect: true,
      withCredentials: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      transports: ['websocket', 'polling'],
    })
    socket.on('connect', () => {
      if (joinedRoom) socket?.emit('join-channel', joinedRoom)
    })
  }
  return socket
}

/** Join a text channel or DM conversation room for typing signals. */
export function joinChatRoom(roomId: string): void {
  const s = getSocket()
  if (joinedRoom && joinedRoom !== roomId) {
    s.emit('leave-channel', joinedRoom)
  }
  joinedRoom = roomId
  if (s.connected) s.emit('join-channel', roomId)
  else s.once('connect', () => s.emit('join-channel', roomId))
}

export function leaveChatRoom(roomId?: string): void {
  const s = socket
  const target = roomId ?? joinedRoom
  if (!s || !target) return
  s.emit('leave-channel', target)
  if (!roomId || joinedRoom === roomId) joinedRoom = null
}

export function emitTyping(roomId: string, userId: string, username: string): void {
  if (!roomId || !userId) return
  getSocket().emit('typing', { channelId: roomId, userId, username })
}

export function emitTypingStop(roomId: string, userId: string): void {
  if (!roomId || !userId) return
  getSocket().emit('typing-stop', { channelId: roomId, userId })
}

export function onTyping(
  cb: (data: { userId: string; username: string }) => void
): () => void {
  const s = getSocket()
  const handler = (data: { userId: string; username: string }) => {
    if (!data?.userId) return
    cb(data)
  }
  s.on('typing', handler)
  return () => {
    s.off('typing', handler)
  }
}

export function onTypingStop(cb: (data: { userId: string }) => void): () => void {
  const s = getSocket()
  const handler = (data: { userId: string }) => {
    if (!data?.userId) return
    cb(data)
  }
  s.on('typing-stop', handler)
  return () => {
    s.off('typing-stop', handler)
  }
}

/** @deprecated use getSocket helpers above */
export function createChatSocket() {
  return getSocket()
}
