import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000'

export function createChatSocket() {
  return io(`${SOCKET_URL}/chat`, { autoConnect: true })
}
