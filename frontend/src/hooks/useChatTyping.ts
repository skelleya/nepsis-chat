import { useCallback, useEffect, useRef, useState } from 'react'
import {
  emitTyping,
  emitTypingStop,
  joinChatRoom,
  leaveChatRoom,
  onTyping,
  onTypingStop,
} from '../services/chatSocket'

const TYPING_IDLE_MS = 4000
const TYPING_EMIT_THROTTLE_MS = 1200
const REMOTE_TYPING_TTL_MS = 5000

export type TypingUser = { userId: string; username: string }

/**
 * Join a channel/DM room, emit local typing, and track remote typers.
 */
export function useChatTyping(
  roomId: string | null | undefined,
  self: { userId: string; username: string } | null
) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([])
  const lastEmitRef = useRef(0)
  const idleTimerRef = useRef<number | null>(null)
  const remoteTimersRef = useRef<Map<string, number>>(new Map())
  const selfRef = useRef(self)
  selfRef.current = self

  useEffect(() => {
    if (!roomId || !self?.userId) {
      setTypingUsers([])
      return
    }

    joinChatRoom(roomId)
    setTypingUsers([])

    const clearRemote = (userId: string) => {
      const t = remoteTimersRef.current.get(userId)
      if (t) window.clearTimeout(t)
      remoteTimersRef.current.delete(userId)
      setTypingUsers((prev) => prev.filter((u) => u.userId !== userId))
    }

    const unsubTyping = onTyping(({ userId, username }) => {
      if (userId === selfRef.current?.userId) return
      setTypingUsers((prev) => {
        const existing = prev.find((u) => u.userId === userId)
        if (existing) {
          return prev.map((u) => (u.userId === userId ? { userId, username: username || u.username } : u))
        }
        return [...prev, { userId, username: username || 'Someone' }]
      })
      const prevTimer = remoteTimersRef.current.get(userId)
      if (prevTimer) window.clearTimeout(prevTimer)
      remoteTimersRef.current.set(
        userId,
        window.setTimeout(() => clearRemote(userId), REMOTE_TYPING_TTL_MS)
      )
    })

    const unsubStop = onTypingStop(({ userId }) => {
      clearRemote(userId)
    })

    return () => {
      unsubTyping()
      unsubStop()
      for (const t of remoteTimersRef.current.values()) window.clearTimeout(t)
      remoteTimersRef.current.clear()
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current)
      emitTypingStop(roomId, self.userId)
      leaveChatRoom(roomId)
      setTypingUsers([])
    }
  }, [roomId, self?.userId])

  const notifyTyping = useCallback(() => {
    if (!roomId || !selfRef.current?.userId) return
    const now = Date.now()
    if (now - lastEmitRef.current >= TYPING_EMIT_THROTTLE_MS) {
      lastEmitRef.current = now
      emitTyping(roomId, selfRef.current.userId, selfRef.current.username)
    }
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current)
    idleTimerRef.current = window.setTimeout(() => {
      if (!roomId || !selfRef.current?.userId) return
      emitTypingStop(roomId, selfRef.current.userId)
    }, TYPING_IDLE_MS)
  }, [roomId])

  const stopTyping = useCallback(() => {
    if (!roomId || !selfRef.current?.userId) return
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
    emitTypingStop(roomId, selfRef.current.userId)
  }, [roomId])

  return { typingUsers, notifyTyping, stopTyping }
}

export function formatTypingLabel(users: TypingUser[]): string {
  if (users.length === 0) return ''
  if (users.length === 1) return `${users[0].username} is typing…`
  if (users.length === 2) return `${users[0].username} and ${users[1].username} are typing…`
  return 'Several people are typing…'
}
