const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

// Guest login (username only)
export async function login(username: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  })
  if (!res.ok) throw new Error('Login failed')
  return res.json()
}

// Email auth callback — links Supabase Auth user to app user
export async function authCallback(authId: string, email: string, username?: string) {
  const res = await fetch(`${API_BASE}/auth/auth/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ auth_id: authId, email, username }),
  })
  if (!res.ok) throw new Error('Auth callback failed')
  return res.json()
}

// Delete guest account (leaves all servers + deletes user)
export async function deleteGuestAccount(userId: string) {
  const res = await fetch(`${API_BASE}/auth/guest/${userId}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete guest account')
  return res.json()
}

// ─── Servers ───────────────────────────────────────────

export async function getServers(userId: string) {
  const res = await fetch(`${API_BASE}/servers?userId=${encodeURIComponent(userId)}`)
  if (!res.ok) throw new Error('Failed to fetch servers')
  return res.json()
}

export async function getCommunityServers() {
  const res = await fetch(`${API_BASE}/servers/community`)
  if (!res.ok) throw new Error('Failed to fetch community servers')
  return res.json()
}

export async function createServer(name: string, ownerId: string) {
  const res = await fetch(`${API_BASE}/servers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, ownerId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error || 'Failed to create server')
  }
  return res.json()
}

export async function updateServer(serverId: string, data: { name?: string; icon_url?: string }) {
  const res = await fetch(`${API_BASE}/servers/${serverId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update server')
  return res.json()
}

export async function deleteServer(serverId: string) {
  const res = await fetch(`${API_BASE}/servers/${serverId}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete server')
  return res.json()
}

// ─── Channels ──────────────────────────────────────────

export async function getChannels(serverId: string) {
  const res = await fetch(`${API_BASE}/servers/${serverId}/channels`)
  if (!res.ok) throw new Error('Failed to fetch channels')
  return res.json()
}

export async function createChannel(serverId: string, name: string, type: 'text' | 'voice', categoryId?: string) {
  const res = await fetch(`${API_BASE}/servers/${serverId}/channels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, type, categoryId }),
  })
  if (!res.ok) throw new Error('Failed to create channel')
  return res.json()
}

export async function updateChannel(
  serverId: string,
  channelId: string,
  data: { order?: number; name?: string; categoryId?: string }
) {
  const body: Record<string, unknown> = {}
  if (data.order !== undefined) body.order = data.order
  if (data.name !== undefined) body.name = data.name
  if (data.categoryId !== undefined) body.categoryId = data.categoryId
  const res = await fetch(`${API_BASE}/servers/${serverId}/channels/${channelId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Failed to update channel')
  return res.json()
}

export async function reorderChannels(
  serverId: string,
  updates: { id: string; order: number }[]
): Promise<unknown[]> {
  const res = await fetch(`${API_BASE}/servers/${serverId}/channels/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates }),
  })
  if (!res.ok) throw new Error('Failed to reorder channels')
  return res.json()
}

export async function deleteChannel(serverId: string, channelId: string) {
  const res = await fetch(`${API_BASE}/servers/${serverId}/channels/${channelId}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete channel')
  return res.json()
}

// ─── Categories ────────────────────────────────────────

export async function getCategories(serverId: string) {
  const res = await fetch(`${API_BASE}/servers/${serverId}/categories`)
  if (!res.ok) throw new Error('Failed to fetch categories')
  return res.json()
}

export async function createCategory(serverId: string, name: string) {
  const res = await fetch(`${API_BASE}/servers/${serverId}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error('Failed to create category')
  return res.json()
}

export async function deleteCategory(serverId: string, catId: string) {
  const res = await fetch(`${API_BASE}/servers/${serverId}/categories/${catId}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete category')
  return res.json()
}

// ─── Messages ──────────────────────────────────────────

export async function getMessage(messageId: string) {
  const res = await fetch(`${API_BASE}/messages/single/${messageId}`)
  if (!res.ok) throw new Error('Failed to fetch message')
  return res.json()
}

export async function getMessages(channelId: string, limit = 50, before?: string) {
  const params = new URLSearchParams({ limit: String(limit) })
  if (before) params.set('before', before)
  const res = await fetch(`${API_BASE}/messages/channel/${channelId}?${params}`)
  if (!res.ok) throw new Error('Failed to fetch messages')
  return res.json()
}

export async function sendMessage(
  channelId: string,
  userId: string,
  content: string,
  options?: { replyToId?: string; attachments?: { url: string; type: string; filename?: string }[] }
) {
  const res = await fetch(`${API_BASE}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channelId,
      userId,
      content,
      replyToId: options?.replyToId,
      attachments: options?.attachments,
    }),
  })
  if (!res.ok) throw new Error('Failed to send message')
  return res.json()
}

export async function editMessage(messageId: string, userId: string, content: string) {
  const res = await fetch(`${API_BASE}/messages/${messageId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, content }),
  })
  if (!res.ok) throw new Error('Failed to edit message')
  return res.json()
}

export async function deleteMessage(messageId: string, userId: string) {
  const res = await fetch(`${API_BASE}/messages/${messageId}?userId=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete message')
  return res.json()
}

export async function addReaction(messageId: string, userId: string, emoji: string) {
  const res = await fetch(`${API_BASE}/messages/${messageId}/reactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, emoji }),
  })
  if (!res.ok) throw new Error('Failed to add reaction')
  return res.json()
}

export async function removeReaction(messageId: string, userId: string, emoji: string) {
  const res = await fetch(
    `${API_BASE}/messages/${messageId}/reactions?userId=${encodeURIComponent(userId)}&emoji=${encodeURIComponent(emoji)}`,
    { method: 'DELETE' }
  )
  if (!res.ok) throw new Error('Failed to remove reaction')
  return res.json()
}

export async function uploadFile(file: File): Promise<{ url: string; path: string }> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(`${API_BASE}/uploads`, {
    method: 'POST',
    body: fd,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error || 'Failed to upload file')
  }
  return res.json()
}

// ─── Server members ────────────────────────────────────

export async function joinServer(serverId: string, userId: string) {
  const res = await fetch(`${API_BASE}/servers/${serverId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })
  if (!res.ok) throw new Error('Failed to join server')
  return res.json()
}

export async function getServerMembers(serverId: string) {
  const res = await fetch(`${API_BASE}/servers/${serverId}/members`)
  if (!res.ok) throw new Error('Failed to fetch members')
  return res.json()
}

export async function getServerEmojis(serverId: string) {
  const res = await fetch(`${API_BASE}/emojis/servers/${serverId}`)
  if (!res.ok) throw new Error('Failed to fetch emojis')
  return res.json()
}

export async function uploadServerEmoji(serverId: string, userId: string, name: string, file: File) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('userId', userId)
  fd.append('name', name)
  const res = await fetch(`${API_BASE}/emojis/servers/${serverId}`, {
    method: 'POST',
    body: fd,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error || 'Failed to upload emoji')
  }
  return res.json()
}

export async function moveMemberToVoiceChannel(
  serverId: string,
  targetUserId: string,
  targetChannelId: string,
  adminUserId: string
): Promise<{ success: boolean; channelId: string; channelName: string }> {
  const res = await fetch(
    `${API_BASE}/servers/${serverId}/members/${targetUserId}/move-voice`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetChannelId, adminUserId }),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error || 'Failed to move user')
  }
  return res.json()
}

export async function kickMember(serverId: string, targetUserId: string, kickerUserId: string) {
  const res = await fetch(
    `${API_BASE}/servers/${serverId}/members/${targetUserId}?kickerUserId=${encodeURIComponent(kickerUserId)}`,
    { method: 'DELETE' }
  )
  if (!res.ok) throw new Error('Failed to kick user')
  return res.json()
}

// ─── Invites ───────────────────────────────────────────

export async function getInviteByCode(code: string): Promise<{
  code: string
  server: { id: string; name: string; iconUrl?: string }
  inviter: string
  expiresAt?: string
  maxUses?: number
  useCount?: number
}> {
  const res = await fetch(`${API_BASE}/invites/${code}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error || 'Invite not found or expired')
  }
  return res.json()
}

export async function joinViaInvite(code: string, userId: string): Promise<{ success: boolean; serverId: string }> {
  const res = await fetch(`${API_BASE}/invites/${code}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error || 'Failed to join server')
  }
  return res.json()
}

export async function createInvite(serverId: string, createdBy: string): Promise<{ code: string }> {
  const res = await fetch(`${API_BASE}/servers/${serverId}/invites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ createdBy }),
  })
  if (!res.ok) throw new Error('Failed to create invite')
  return res.json()
}

export async function getServerInvites(serverId: string): Promise<{
  code: string
  created_by: string
  expires_at?: string
  max_uses?: number
  use_count: number
  created_at: string
}[]> {
  const res = await fetch(`${API_BASE}/servers/${serverId}/invites`)
  if (!res.ok) throw new Error('Failed to fetch invites')
  return res.json()
}

export async function revokeInvite(serverId: string, code: string, revokedBy: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/servers/${serverId}/invites/${code}?revokedBy=${encodeURIComponent(revokedBy)}`,
    { method: 'DELETE' }
  )
  if (!res.ok) throw new Error('Failed to revoke invite')
}

export async function getServerAuditLog(serverId: string): Promise<{
  id: string
  userId: string
  username: string
  action: string
  details: Record<string, unknown>
  createdAt: string
}[]> {
  const res = await fetch(`${API_BASE}/servers/${serverId}/audit-log`)
  if (!res.ok) throw new Error('Failed to fetch audit log')
  return res.json()
}

// ─── DM ───────────────────────────────────────────────

export async function createOrGetDMConversation(userId: string, targetUserId: string): Promise<{ id: string }> {
  const res = await fetch(`${API_BASE}/dm/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, targetUserId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error || 'Failed to create DM')
  }
  return res.json()
}

// ─── Friends ───────────────────────────────────────────

export async function sendFriendRequest(userId: string, targetUserId: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/friends/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, targetUserId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error || 'Failed to send friend request')
  }
  return res.json()
}

// ─── Presence ──────────────────────────────────────────

export async function updatePresence(
  userId: string,
  status: 'online' | 'offline' | 'in-voice' | 'away' | 'dnd',
  voiceChannelId?: string | null
) {
  const res = await fetch(`${API_BASE}/users/${userId}/presence`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, voiceChannelId }),
  })
  if (!res.ok) throw new Error('Failed to update presence')
  return res.json()
}

// ─── User profile ──────────────────────────────────────

export async function updateUserProfile(
  userId: string,
  data: { username?: string; avatar_url?: string; banner_url?: string }
) {
  const res = await fetch(`${API_BASE}/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error || 'Failed to update profile')
  }
  return res.json()
}

export async function getUserProfiles(userId: string) {
  const res = await fetch(`${API_BASE}/users/${userId}/profiles`)
  if (!res.ok) throw new Error('Failed to fetch profiles')
  return res.json()
}

export async function saveUserProfile(
  userId: string,
  profileType: 'personal' | 'work',
  data: { display_name?: string; avatar_url?: string; banner_url?: string }
) {
  const res = await fetch(`${API_BASE}/users/${userId}/profiles`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile_type: profileType, ...data }),
  })
  if (!res.ok) throw new Error('Failed to save profile')
  return res.json()
}
