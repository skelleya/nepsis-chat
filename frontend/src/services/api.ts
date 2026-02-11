const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export async function login(username: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  })
  if (!res.ok) throw new Error('Login failed')
  return res.json()
}

export async function getServers() {
  const res = await fetch(`${API_BASE}/servers`)
  if (!res.ok) throw new Error('Failed to fetch servers')
  return res.json()
}

export async function getChannels(serverId: string) {
  const res = await fetch(`${API_BASE}/servers/${serverId}/channels`)
  if (!res.ok) throw new Error('Failed to fetch channels')
  return res.json()
}

export async function getMessages(channelId: string, limit = 50, before?: string) {
  const params = new URLSearchParams({ limit: String(limit) })
  if (before) params.set('before', before)
  const res = await fetch(`${API_BASE}/messages/channel/${channelId}?${params}`)
  if (!res.ok) throw new Error('Failed to fetch messages')
  return res.json()
}

export async function sendMessage(channelId: string, userId: string, content: string) {
  const res = await fetch(`${API_BASE}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channelId, userId, content }),
  })
  if (!res.ok) throw new Error('Failed to send message')
  return res.json()
}
