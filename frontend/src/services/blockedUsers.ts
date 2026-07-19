/**
 * Device-local blocked users list (Privacy / DM Block).
 * Persisted in localStorage; used to hide DMs and reject opens.
 */

export interface BlockedUser {
  userId: string
  username: string
  blockedAt: string
}

const STORAGE_KEY = 'nepsis_blocked_users'

type Listener = (list: BlockedUser[]) => void
const listeners = new Set<Listener>()

function read(): BlockedUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as BlockedUser[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function write(list: BlockedUser[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  for (const cb of listeners) cb(list)
}

export function getBlockedUsers(): BlockedUser[] {
  return read()
}

export function isUserBlocked(userId: string): boolean {
  return read().some((u) => u.userId === userId)
}

export function blockUser(userId: string, username: string): BlockedUser[] {
  const list = read().filter((u) => u.userId !== userId)
  list.unshift({
    userId,
    username: username || 'User',
    blockedAt: new Date().toISOString(),
  })
  write(list)
  return list
}

export function unblockUser(userId: string): BlockedUser[] {
  const list = read().filter((u) => u.userId !== userId)
  write(list)
  return list
}

export function subscribeBlockedUsers(cb: Listener): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
