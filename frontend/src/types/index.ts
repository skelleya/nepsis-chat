export interface User {
  id: string
  username: string
  avatarUrl?: string
  status: 'online' | 'offline' | 'in-voice'
}

export interface Channel {
  id: string
  name: string
  type: 'text' | 'voice' | 'rules'
  serverId: string
  order: number
  categoryId?: string | null
}

export interface Category {
  id: string
  name: string
  serverId: string
  order: number
}

export interface Server {
  id: string
  name: string
  iconUrl?: string
  bannerUrl?: string
  ownerId: string
  rules_channel_id?: string | null
  lock_channels_until_rules_accepted?: boolean
  rules_accept_emoji?: string
}

export interface Message {
  id: string
  channelId: string
  userId: string
  content: string
  createdAt: string
  editedAt?: string
  username?: string
  replyToId?: string
  replyTo?: { username?: string; content?: string }
  attachments?: { url: string; type: string; filename?: string }[]
  reactions?: { userId: string; emoji: string }[]
}

export interface VoiceParticipant {
  userId: string
  username: string
  channelId: string
  stream?: MediaStream | null
  isMuted?: boolean
}
