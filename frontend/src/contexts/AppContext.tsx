import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import * as api from '../services/api'

interface User {
  id: string
  username: string
  avatar_url?: string
}

interface Server {
  id: string
  name: string
  icon_url?: string
  owner_id: string
}

interface Channel {
  id: string
  server_id: string
  name: string
  type: 'text' | 'voice'
  order: number
}

interface Message {
  id: string
  channel_id: string
  user_id: string
  content: string
  created_at: string
  username?: string
}

interface AppContextValue {
  user: User | null
  servers: Server[]
  channels: Channel[]
  messages: Record<string, Message[]>
  currentServerId: string | null
  currentChannelId: string | null
  login: (username: string) => Promise<void>
  setCurrentServer: (id: string) => void
  setCurrentChannel: (id: string) => void
  loadChannels: (serverId: string) => Promise<void>
  loadMessages: (channelId: string) => Promise<void>
  sendMessage: (channelId: string, content: string) => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [servers, setServers] = useState<Server[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [messages, setMessages] = useState<Record<string, Message[]>>({})
  const [currentServerId, setCurrentServerId] = useState<string | null>(null)
  const [currentChannelId, setCurrentChannelId] = useState<string | null>(null)

  const login = useCallback(async (username: string) => {
    try {
      const u = await api.login(username)
      setUser(u)
      const s = await api.getServers()
      setServers(s)
      if (s.length > 0) {
        setCurrentServerId((prev) => prev || s[0].id)
      }
    } catch {
      setUser({ id: 'u1', username })
      setServers([{ id: '1', name: 'Nepsis Chat', owner_id: 'u1' }])
      setCurrentServerId('1')
    }
  }, [])

  const loadChannels = useCallback(async (serverId: string) => {
    try {
      const c = await api.getChannels(serverId)
      setChannels(c)
    } catch {
      const mock: Channel[] = [
        { id: 'c1', server_id: '1', name: 'general', type: 'text', order: 0 },
        { id: 'c2', server_id: '1', name: 'voice-chat', type: 'voice', order: 1 },
      ]
      setChannels(mock.filter((ch) => ch.server_id === serverId))
    }
  }, [])

  const loadMessages = useCallback(async (channelId: string) => {
    try {
      const m = await api.getMessages(channelId)
      setMessages((prev) => ({ ...prev, [channelId]: m }))
    } catch {
      setMessages((prev) => ({ ...prev, [channelId]: [] }))
    }
  }, [])

  const sendMessage = useCallback(async (channelId: string, content: string) => {
    if (!user) return
    try {
      const msg = await api.sendMessage(channelId, user.id, content)
      setMessages((prev) => ({
        ...prev,
        [channelId]: [...(prev[channelId] || []), msg],
      }))
    } catch {
      const tempMsg = {
        id: 'temp-' + Date.now(),
        channel_id: channelId,
        user_id: user.id,
        content,
        created_at: new Date().toISOString(),
        username: user.username,
      }
      setMessages((prev) => ({
        ...prev,
        [channelId]: [...(prev[channelId] || []), tempMsg],
      }))
    }
  }, [user])

  const setCurrentServer = useCallback((id: string) => {
    setCurrentServerId(id)
    setCurrentChannelId(null)
  }, [])

  const setCurrentChannel = useCallback((id: string) => {
    setCurrentChannelId(id)
  }, [])

  useEffect(() => {
    if (currentServerId) loadChannels(currentServerId)
  }, [currentServerId, loadChannels])

  useEffect(() => {
    if (currentChannelId) loadMessages(currentChannelId)
  }, [currentChannelId, loadMessages])

  return (
    <AppContext.Provider
      value={{
        user,
        servers,
        channels,
        messages,
        currentServerId,
        currentChannelId,
        login,
        setCurrentServer,
        setCurrentChannel,
        loadChannels,
        loadMessages,
        sendMessage,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
