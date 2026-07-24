/** ID prefixes used by ChannelList DnD. */
export const CHANNEL_PREFIX = 'ch-'
export const CATEGORY_PREFIX = 'cat-'
export const USER_PREFIX = 'user-'
export const VOICE_DROP_PREFIX = 'voice-drop-'

export type DroppableLike = { id: string | number }

/**
 * Restrict droppable candidates by drag type so user→voice moves
 * don't fight channel/category sortables (and vice versa).
 */
export function filterDroppablesForActive(
  activeId: string | number,
  containers: DroppableLike[]
): DroppableLike[] {
  const activeStr = String(activeId)

  if (activeStr.startsWith(CATEGORY_PREFIX)) {
    return containers.filter((c) => {
      const idStr = String(c.id)
      return idStr.startsWith(CATEGORY_PREFIX) && idStr !== activeStr
    })
  }

  if (activeStr.startsWith(CHANNEL_PREFIX)) {
    return containers.filter((c) => {
      const id = String(c.id)
      return id.startsWith(CHANNEL_PREFIX) || id.startsWith(CATEGORY_PREFIX)
    })
  }

  if (activeStr.startsWith(USER_PREFIX)) {
    return containers.filter((c) => String(c.id).startsWith(VOICE_DROP_PREFIX))
  }

  return containers
}

/** Resolve a user-drag drop target into a voice channel id (or null). */
export function resolveVoiceMoveTarget(
  overId: string | number,
  channels: { id: string; type: string }[]
): string | null {
  const overStr = String(overId)
  if (overStr.startsWith(VOICE_DROP_PREFIX)) {
    return overStr.slice(VOICE_DROP_PREFIX.length)
  }
  if (overStr.startsWith(CHANNEL_PREFIX)) {
    const channelId = overStr.slice(CHANNEL_PREFIX.length)
    const ch = channels.find((c) => c.id === channelId)
    return ch?.type === 'voice' ? channelId : null
  }
  return null
}
