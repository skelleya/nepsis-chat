import type { Server, Channel, User, Message } from '../types'

export const mockServers: Server[] = [
  { id: '1', name: 'Nepsis Chat', ownerId: 'u1' },
  { id: '2', name: 'Gaming Hub', ownerId: 'u1' },
]

export const mockChannels: Channel[] = [
  { id: 'c1', name: 'general', type: 'text', serverId: '1', order: 0 },
  { id: 'c2', name: 'voice-chat', type: 'voice', serverId: '1', order: 1 },
  { id: 'c3', name: 'announcements', type: 'text', serverId: '1', order: 2 },
  { id: 'c4', name: 'lobby', type: 'voice', serverId: '2', order: 0 },
]

export const mockUsers: User[] = [
  { id: 'u1', username: 'You', status: 'online' },
  { id: 'u2', username: 'Alice', status: 'online' },
  { id: 'u3', username: 'Bob', status: 'offline' },
]

export const mockMessages: Message[] = [
  { id: 'm1', channelId: 'c1', userId: 'u1', content: 'Welcome to Nepsis Chat!', createdAt: new Date().toISOString() },
  { id: 'm2', channelId: 'c1', userId: 'u2', content: 'Hi everyone!', createdAt: new Date().toISOString() },
]
