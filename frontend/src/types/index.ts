export interface User {
  id: string
  username: string
  avatarUrl?: string
  status: 'online' | 'offline' | 'in-voice'
}

export interface Channel {
  id: string
  name: string
  type: 'text' | 'voice'
  serverId: string
  order: number
}

export interface Server {
  id: string
  name: string
  iconUrl?: string
  ownerId: string
}

export interface Message {
  id: string
  channelId: string
  userId: string
  content: string
  createdAt: string
}
