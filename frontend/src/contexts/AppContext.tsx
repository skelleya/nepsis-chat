import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import * as api from '../services/api'
import { supabase } from '../services/supabase'
import {
  getCachedLayout,
  saveLayoutToCache,
  invalidateLayoutCache,
  clearLayoutCache,
} from '../services/layoutCache'
import {
  subscribeToChannelMessages,
  subscribeToReactions,
  subscribeToDMMessages,
  subscribeToAllDMMessages,
  subscribeToAllChannelMessages,
  unsubscribe,
} from '../services/realtime'
import { sounds } from '../services/sounds'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface User {
  id: string
  username: string
  email?: string
  avatar_url?: string
  banner_url?: string
  is_guest?: boolean
}

interface Server {
  id: string
  name: string
  icon_url?: string
  banner_url?: string
  owner_id: string
  rules_channel_id?: string | null
  lock_channels_until_rules_accepted?: boolean
  rules_accept_emoji?: string
}

interface Channel {
  id: string
  server_id: string
  name: string
  type: 'text' | 'voice'
  order: number
  category_id?: string | null
}

interface Category {
  id: string
  server_id: string
  name: string
  order: number
}

interface Message {
  id: string
  channel_id: string
  user_id: string
  content: string
  created_at: string
  edited_at?: string
  username?: string
  reply_to_id?: string
  reply_to?: { username?: string; content?: string }
  attachments?: { url: string; type: string; filename?: string }[]
  reactions?: { user_id: string; emoji: string }[]
}

export type UserStatus = 'online' | 'away' | 'dnd' | 'offline'

interface AppContextValue {
  user: User | null
  userStatus: UserStatus
  setUserStatus: (status: UserStatus) => void
  updateUser: (data: Partial<User>) => void
  servers: Server[]
  channels: Channel[]
  categories: Category[]
  messages: Record<string, Message[]>
  currentServerId: string | null
  currentChannelId: string | null
  login: (username: string) => Promise<void>
  loginWithEmail: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  setCurrentServer: (id: string) => void
  setCurrentChannel: (id: string) => void
  loadChannels: (serverId: string) => Promise<void>
  loadMessages: (channelId: string) => Promise<void>
  sendMessage: (channelId: string, content: string, options?: { replyToId?: string; attachments?: { url: string; type: string; filename?: string }[] }) => Promise<void>
  editMessage: (messageId: string, content: string) => Promise<void>
  deleteMessage: (messageId: string) => Promise<void>
  toggleReaction: (messageId: string, emoji: string) => Promise<void>
  createServer: (name: string) => Promise<Server | null>
  updateServer: (serverId: string, data: { name?: string; icon_url?: string; banner_url?: string; rules_channel_id?: string | null; lock_channels_until_rules_accepted?: boolean; rules_accept_emoji?: string; updatedBy?: string }) => Promise<void>
  deleteServer: (serverId: string) => Promise<void>
  createChannel: (name: string, type: 'text' | 'voice' | 'rules', categoryId?: string) => Promise<Channel | null>
  reorderChannels: (updates: { id: string; order: number }[]) => Promise<void>
  updateChannel: (channelId: string, data: { name?: string; order?: number; categoryId?: string | null }) => Promise<void>
  deleteChannel: (channelId: string) => Promise<void>
  createCategory: (name: string) => Promise<Category | null>
  updateCategory: (catId: string, data: { name?: string; order?: number }) => Promise<void>
  reorderCategories: (updates: { id: string; order: number }[]) => Promise<void>
  deleteCategory: (catId: string) => Promise<void>
  loadServers: (userIdOverride?: string) => Promise<void>
  reorderServers: (updates: { serverId: string; order: number }[]) => Promise<void>
  // DM
  dmConversations: api.DMConversation[]
  dmMessages: Record<string, api.DMMessage[]>
  currentDMId: string | null
  setCurrentDM: (id: string | null) => void
  dmUnreadCounts: Record<string, number>
  channelUnreadCounts: Record<string, number>
  loadDMConversations: () => Promise<void>
  openDM: (targetUserId: string, targetUsername: string) => Promise<string | undefined>
  sendDMMessage: (conversationId: string, content: string) => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

const LAST_CHANNEL_KEY = 'nepsis_last_channel'
const USER_STATUS_KEY = 'nepsis_user_status'

function getLastChannelStorage(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LAST_CHANNEL_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveLastChannel(serverId: string, channelId: string) {
  try {
    const store = getLastChannelStorage()
    store[serverId] = channelId
    localStorage.setItem(LAST_CHANNEL_KEY, JSON.stringify(store))
  } catch {
    /* ignore */
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userStatus, setUserStatusState] = useState<UserStatus>(() => {
    try {
      const s = localStorage.getItem(USER_STATUS_KEY)
      return (s as UserStatus) || 'online'
    } catch {
      return 'online'
    }
  })
  const setUserStatus = useCallback((status: UserStatus) => {
    setUserStatusState(status)
    localStorage.setItem(USER_STATUS_KEY, status)
  }, [])
  const updateUser = useCallback((data: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null
      const next = { ...prev, ...data }
      localStorage.setItem('nepsis_user', JSON.stringify(next))
      return next
    })
  }, [])
  const [servers, setServers] = useState<Server[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [messages, setMessages] = useState<Record<string, Message[]>>({})
  const [currentServerId, setCurrentServerId] = useState<string | null>(null)
  const [currentChannelId, setCurrentChannelId] = useState<string | null>(null)
  const [dmConversations, setDMConversations] = useState<api.DMConversation[]>([])
  const [dmMessages, setDMMessages] = useState<Record<string, api.DMMessage[]>>({})
  const [currentDMId, setCurrentDMId] = useState<string | null>(null)
  const [dmUnreadCounts, setDMUnreadCounts] = useState<Record<string, number>>({})
  const [channelUnreadCounts, setChannelUnreadCounts] = useState<Record<string, number>>({})
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null)
  const realtimeAllChannelRef = useRef<RealtimeChannel | null>(null)
  const realtimeAllDMRef = useRef<RealtimeChannel | null>(null)
  const currentDMIdRef = useRef<string | null>(null)
  const currentChannelIdRef = useRef<string | null>(null)
  currentChannelIdRef.current = currentChannelId
  currentDMIdRef.current = currentDMId
  const realtimeReactionsRef = useRef<RealtimeChannel | null>(null)
  const realtimeDMRef = useRef<RealtimeChannel | null>(null)
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  // Load servers the user is a member of. Pass userId when user was just set (React may not have updated yet).
  const loadServers = useCallback(async (userIdOverride?: string) => {
    const uid = userIdOverride ?? user?.id
    if (!uid) {
      setServers([])
      setCurrentServerId(null)
      return
    }
    try {
      const s = await api.getServers(uid)
      setServers(s)
      const joinId = sessionStorage.getItem('joinServerId')
      sessionStorage.removeItem('joinServerId')
      if (s.length > 0) {
        const targetId = joinId && s.some((sv: Server) => sv.id === joinId) ? joinId : s[0].id
        setCurrentServerId((prev) => prev || targetId)
      } else {
        setCurrentServerId(null)
      }
    } catch {
      setServers([])
      setCurrentServerId(null)
    }
  }, [user?.id])

  // Restore session on mount
  useEffect(() => {
    const restoreSession = async () => {
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          try {
            const u = await api.authCallback(session.user.id, session.user.email || '')
            setUser(u)
            localStorage.setItem('nepsis_user', JSON.stringify(u))
            await loadServers(u.id)
            return
          } catch {
            // Fall through
          }
        }
      }
      const saved = localStorage.getItem('nepsis_user')
      if (!saved) return
      try {
        const savedUser: User = JSON.parse(saved)
        setUser(savedUser)
        await loadServers(savedUser.id)
      } catch {
        localStorage.removeItem('nepsis_user')
      }
    }
    restoreSession()
  }, [loadServers])

  // Listen for Supabase Auth state changes
  useEffect(() => {
    if (!supabase) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          try {
            const u = await api.authCallback(session.user.id, session.user.email || '')
            setUser(u)
            localStorage.setItem('nepsis_user', JSON.stringify(u))
            await loadServers(u.id)
          } catch (err) {
            console.error('Auth state change error:', err)
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          localStorage.removeItem('nepsis_user')
          localStorage.removeItem(LAST_CHANNEL_KEY)
          clearLayoutCache()
          setServers([])
          setChannels([])
          setCategories([])
          setMessages({})
          setCurrentServerId(null)
          setDMConversations([])
          setDMMessages({})
          setCurrentDMId(null)
          setDMUnreadCounts({})
          setCurrentChannelId(null)
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [loadServers])

  // Guest login
  const login = useCallback(async (username: string) => {
    try {
      const u = await api.login(username)
      setUser(u)
      localStorage.setItem('nepsis_user', JSON.stringify(u))
      await loadServers(u.id)
    } catch {
      const fallbackUser: User = { id: 'u1', username, is_guest: true }
      setUser(fallbackUser)
      localStorage.setItem('nepsis_user', JSON.stringify(fallbackUser))
      setServers([])
      setCurrentServerId(null)
    }
  }, [loadServers])

  // Email login
  const loginWithEmail = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Email auth not configured')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    if (!data.session?.user) throw new Error('No session returned')
  }, [])

  const logout = useCallback(async () => {
    const wasGuest = user?.is_guest
    const guestId = user?.id

    // Clear state FIRST so polling/realtime stops before the backend delete runs.
    // This prevents race conditions where loadServers auto-re-joins community servers
    // between server_members deletion and users deletion.
    setUser(null)
    localStorage.removeItem('nepsis_user')
    localStorage.removeItem(LAST_CHANNEL_KEY)
    localStorage.removeItem('nepsis_last_view')
    clearLayoutCache()
    setServers([])
    setChannels([])
    setCategories([])
    setMessages({})
    setCurrentServerId(null)
    setCurrentChannelId(null)
    setDMConversations([])
    setDMMessages({})
    setCurrentDMId(null)
    setDMUnreadCounts({})
    setChannelUnreadCounts({})

    // Now safely delete on the backend (no frontend polling can race)
    if (wasGuest && guestId) {
      try {
        await api.deleteGuestAccount(guestId)
      } catch (err) {
        console.error('Failed to delete guest account:', err)
      }
    } else {
      supabase?.auth.signOut()
    }
  }, [user])

  const loadChannels = useCallback(async (serverId: string) => {
    try {
      const [c, cats] = await Promise.all([
        api.getChannels(serverId),
        api.getCategories(serverId).catch(() => []),
      ])
      setChannels(c)
      setCategories(cats)
      saveLayoutToCache(serverId, c, cats)
    } catch {
      const mock: Channel[] = [
        { id: 'c1', server_id: '1', name: 'general', type: 'text', order: 0 },
        { id: 'c2', server_id: '1', name: 'voice-chat', type: 'voice', order: 1 },
      ]
      setChannels(mock.filter((ch) => ch.server_id === serverId))
      setCategories([])
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

  const loadDMConversations = useCallback(async () => {
    if (!user) return
    try {
      const convs = await api.listDMConversations(user.id)
      setDMConversations(convs)
    } catch {
      setDMConversations([])
    }
  }, [user?.id])

  const loadDMMessages = useCallback(async (conversationId: string) => {
    if (!user) return
    try {
      const m = await api.getDMMessages(conversationId, user.id)
      setDMMessages((prev) => ({ ...prev, [conversationId]: m }))
    } catch {
      setDMMessages((prev) => ({ ...prev, [conversationId]: [] }))
    }
  }, [user?.id])

  const openDM = useCallback(
    async (targetUserId: string, _targetUsername: string): Promise<string | undefined> => {
      if (!user) return
      const conv = await api.createOrGetDMConversation(user.id, targetUserId)
      setDMConversations((prev) => {
        const exists = prev.some((c) => c.id === conv.id)
        if (exists) return prev
        return [conv, ...prev]
      })
      setCurrentDM(conv.id)
      await loadDMMessages(conv.id)
      return conv.id
    },
    [user?.id, loadDMMessages]
  )

  const sendDMMessage = useCallback(
    async (conversationId: string, content: string) => {
      if (!user) return
      try {
        const msg = await api.sendDMMessage(conversationId, user.id, content)
        setDMMessages((prev) => ({
          ...prev,
          [conversationId]: [...(prev[conversationId] || []), msg],
        }))
      } catch (err) {
        console.error('Send DM error:', err)
        throw err
      }
    },
    [user?.id]
  )

  const sendMessage = useCallback(
    async (
      channelId: string,
      content: string,
      options?: { replyToId?: string; attachments?: { url: string; type: string; filename?: string }[] }
    ) => {
      if (!user) return
      try {
        const msg = await api.sendMessage(channelId, user.id, content, options)
        setMessages((prev) => ({
          ...prev,
          [channelId]: [...(prev[channelId] || []), msg],
        }))
      } catch {
        const tempMsg: Message = {
          id: 'temp-' + Date.now(),
          channel_id: channelId,
          user_id: user.id,
          content,
          created_at: new Date().toISOString(),
          username: user.username,
          reply_to_id: options?.replyToId,
          attachments: options?.attachments,
        }
        setMessages((prev) => ({
          ...prev,
          [channelId]: [...(prev[channelId] || []), tempMsg],
        }))
      }
    },
    [user]
  )

  const editMessage = useCallback(
    async (messageId: string, content: string) => {
      if (!user) return
      try {
        const msg = await api.editMessage(messageId, user.id, content)
        setMessages((prev) => {
          const entries = Object.entries(prev)
          return Object.fromEntries(
            entries.map(([chId, list]) => [
              chId,
              chId === msg.channel_id ? list.map((m) => (m.id === messageId ? msg : m)) : list,
            ])
          )
        })
      } catch (err) {
        console.error('Failed to edit message:', err)
      }
    },
    [user]
  )

  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!user) return
      try {
        await api.deleteMessage(messageId, user.id)
        setMessages((prev) => {
          const next = { ...prev }
          for (const chId of Object.keys(next)) {
            next[chId] = next[chId].filter((m) => m.id !== messageId)
          }
          return next
        })
      } catch (err) {
        console.error('Failed to delete message:', err)
      }
    },
    [user]
  )

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!user) return
      try {
        const channelId = Object.keys(messages).find((ch) => messages[ch].some((m) => m.id === messageId))
        if (!channelId) return
        const msg = messages[channelId].find((m) => m.id === messageId)
        const reactions = msg?.reactions || []
        const hasReacted = reactions.some((r) => r.user_id === user.id && r.emoji === emoji)
        if (hasReacted) {
          await api.removeReaction(messageId, user.id, emoji)
          setMessages((prev) => ({
            ...prev,
            [channelId]: prev[channelId].map((m) =>
              m.id === messageId
                ? { ...m, reactions: (m.reactions || []).filter((r) => !(r.user_id === user.id && r.emoji === emoji)) }
                : m
            ),
          }))
        } else {
          await api.addReaction(messageId, user.id, emoji)
          setMessages((prev) => ({
            ...prev,
            [channelId]: prev[channelId].map((m) =>
              m.id === messageId ? { ...m, reactions: [...(m.reactions || []), { user_id: user.id, emoji }] } : m
            ),
          }))
        }
      } catch (err) {
        console.error('Failed to toggle reaction:', err)
      }
    },
    [user, messages]
  )

  // ─── Server CRUD ──────────────────────────────────────

  const createServerFn = useCallback(async (name: string): Promise<Server | null> => {
    if (!user) return null
    const server = await api.createServer(name, user.id)
    await loadServers()
    setCurrentServerId(server.id)
    return server
  }, [user, loadServers])

  const updateServerFn = useCallback(async (serverId: string, data: { name?: string; icon_url?: string; banner_url?: string; rules_channel_id?: string | null; lock_channels_until_rules_accepted?: boolean; rules_accept_emoji?: string; updatedBy?: string }) => {
    try {
      await api.updateServer(serverId, data)
      await loadServers()
    } catch (err) {
      console.error('Failed to update server:', err)
    }
  }, [loadServers])

  const deleteServerFn = useCallback(async (serverId: string) => {
    try {
      await api.deleteServer(serverId)
      invalidateLayoutCache(serverId)
      await loadServers()
      if (currentServerId === serverId) {
        setCurrentServerId(null)
        setCurrentChannelId(null)
        setChannels([])
        setCategories([])
      }
    } catch (err) {
      console.error('Failed to delete server:', err)
    }
  }, [currentServerId, loadServers])

  const reorderServersFn = useCallback(
    async (updates: { serverId: string; order: number }[]) => {
      if (!user?.id) return
      try {
        await api.reorderServers(user.id, updates)
        await loadServers()
      } catch (err) {
        console.error('Failed to reorder servers:', err)
      }
    },
    [user?.id, loadServers]
  )

  // ─── Channel CRUD ─────────────────────────────────────

  const createChannelFn = useCallback(async (name: string, type: 'text' | 'voice' | 'rules', categoryId?: string): Promise<Channel | null> => {
    if (!currentServerId || !user) return null
    try {
      const createdBy = type === 'rules' ? user.id : undefined
      const ch = await api.createChannel(currentServerId, name, type, categoryId, createdBy)
      await loadChannels(currentServerId)
      return ch
    } catch (err) {
      console.error('Failed to create channel:', err)
      throw err
    }
  }, [currentServerId, loadChannels, user])

  const deleteChannelFn = useCallback(async (channelId: string) => {
    if (!currentServerId) return
    try {
      await api.deleteChannel(currentServerId, channelId)
      await loadChannels(currentServerId)
      if (currentChannelId === channelId) {
        setCurrentChannelId(null)
        const store = getLastChannelStorage()
        if (store[currentServerId] === channelId) {
          delete store[currentServerId]
          try {
            localStorage.setItem(LAST_CHANNEL_KEY, JSON.stringify(store))
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      console.error('Failed to delete channel:', err)
    }
  }, [currentServerId, currentChannelId, loadChannels])

  const reorderChannelsFn = useCallback(
    async (updates: { id: string; order: number }[]) => {
      if (!currentServerId) return
      try {
        const updated = await api.reorderChannels(currentServerId, updates)
        const channelsList = (updated as Channel[]) || []
        setChannels(channelsList)
        saveLayoutToCache(currentServerId, channelsList, categories)
      } catch (err) {
        console.error('Failed to reorder channels:', err)
      }
    },
    [currentServerId, categories]
  )

  const updateChannelFn = useCallback(
    async (channelId: string, data: { name?: string; order?: number; categoryId?: string | null }) => {
      if (!currentServerId) return
      try {
        const payload: { name?: string; order?: number; categoryId?: string | null } = {}
        if (data.name !== undefined) payload.name = data.name
        if (data.order !== undefined) payload.order = data.order
        if (data.categoryId !== undefined) payload.categoryId = data.categoryId
        const updated = await api.updateChannel(currentServerId, channelId, payload)
        setChannels((prev) => prev.map((c) => (c.id === channelId ? { ...c, ...updated } : c)))
        await loadChannels(currentServerId)
      } catch (err) {
        console.error('Failed to update channel:', err)
      }
    },
    [currentServerId, loadChannels]
  )

  // ─── Category CRUD ────────────────────────────────────

  const createCategoryFn = useCallback(async (name: string): Promise<Category | null> => {
    if (!currentServerId) return null
    try {
      const cat = await api.createCategory(currentServerId, name)
      await loadChannels(currentServerId)
      return cat
    } catch (err) {
      console.error('Failed to create category:', err)
      return null
    }
  }, [currentServerId, loadChannels])

  const updateCategoryFn = useCallback(
    async (catId: string, data: { name?: string; order?: number }) => {
      if (!currentServerId) return
      try {
        const updated = await api.updateCategory(currentServerId, catId, data)
        setCategories((prev) => prev.map((c) => (c.id === catId ? { ...c, ...updated } : c)))
        await loadChannels(currentServerId)
      } catch (err) {
        console.error('Failed to update category:', err)
      }
    },
    [currentServerId, loadChannels]
  )

  const reorderCategoriesFn = useCallback(
    async (updates: { id: string; order: number }[]) => {
      if (!currentServerId) return
      try {
        const updated = await api.reorderCategories(currentServerId, updates)
        setCategories((updated as Category[]) || [])
        await loadChannels(currentServerId)
      } catch (err) {
        console.error('Failed to reorder categories:', err)
      }
    },
    [currentServerId, loadChannels]
  )

  const deleteCategoryFn = useCallback(async (catId: string) => {
    if (!currentServerId) return
    try {
      await api.deleteCategory(currentServerId, catId)
      await loadChannels(currentServerId)
    } catch (err) {
      console.error('Failed to delete category:', err)
    }
  }, [currentServerId, loadChannels])

  // ─── Navigation ───────────────────────────────────────

  const setCurrentServer = useCallback((id: string) => {
    // Save current channel as last for current server before switching
    if (currentServerId && currentChannelId) {
      saveLastChannel(currentServerId, currentChannelId)
    }

    const cached = getCachedLayout(id)
    if (cached) {
      setChannels(cached.channels)
      setCategories(cached.categories)
    } else {
      setChannels([])
      setCategories([])
    }
    setCurrentServerId(id)
    setChannelUnreadCounts({})

    const lastId = getLastChannelStorage()[id] || null
    const channelsForNewServer = cached?.channels || []
    const channelExists = channelsForNewServer.some((c) => c.id === lastId && c.server_id === id)
    setCurrentChannelId(channelExists ? lastId : null)
  }, [currentServerId, currentChannelId])

  const setCurrentChannel = useCallback((id: string) => {
    setCurrentChannelId(id)
    if (currentServerId) saveLastChannel(currentServerId, id)
    setChannelUnreadCounts((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [currentServerId])

  const setCurrentDM = useCallback((id: string | null) => {
    setCurrentDMId(id)
    if (id) {
      setDMUnreadCounts((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    }
  }, [])

  useEffect(() => {
    if (currentServerId) loadChannels(currentServerId)
  }, [currentServerId, loadChannels])

  // Restore last channel when channels load asynchronously (e.g. no cache on first visit)
  useEffect(() => {
    if (!currentServerId || currentChannelId || channels.length === 0) return
    const lastId = getLastChannelStorage()[currentServerId]
    if (!lastId) return
    const exists = channels.some((c) => c.id === lastId && c.server_id === currentServerId)
    if (exists) setCurrentChannelId(lastId)
  }, [currentServerId, currentChannelId, channels])

  // Preload cache for other servers in background (instant preview when switching)
  useEffect(() => {
    if (!servers.length || !currentServerId) return
    servers.forEach((s) => {
      if (s.id === currentServerId) return
      Promise.all([
        api.getChannels(s.id),
        api.getCategories(s.id).catch(() => []),
      ])
        .then(([c, cats]) => saveLayoutToCache(s.id, c, cats))
        .catch(() => {})
    })
  }, [servers, currentServerId])

  // Background refresh: when tab becomes visible, refresh layout for all servers.
  // Updates cache for each; updates displayed state for current server.
  useEffect(() => {
    const refreshAllServersInBackground = () => {
      servers.forEach((s) => {
        Promise.all([
          api.getChannels(s.id),
          api.getCategories(s.id).catch(() => []),
        ])
          .then(([c, cats]) => {
            saveLayoutToCache(s.id, c, cats)
            if (s.id === currentServerId) {
              setChannels(c)
              setCategories(cats)
            }
          })
          .catch(() => {})
      })
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshAllServersInBackground()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [currentServerId, servers])

  useEffect(() => {
    if (currentChannelId) loadMessages(currentChannelId)
  }, [currentChannelId, loadMessages])

  useEffect(() => {
    if (currentDMId) loadDMMessages(currentDMId)
  }, [currentDMId, loadDMMessages])

  // Supabase Realtime: subscribe to messages and reactions for current channel
  useEffect(() => {
    if (!currentChannelId || !supabase) return

    const ch = subscribeToChannelMessages(currentChannelId, async (payload) => {
      if (payload.eventType === 'INSERT') {
        try {
          const msg = await api.getMessage(payload.new.id)
          // Play notification sound for messages from other users
          if (msg.user_id !== user?.id) {
            sounds.messageNotification()
          }
          setMessages((prev) => {
            const list = prev[currentChannelId] || []
            if (list.some((m) => m.id === msg.id)) return prev
            return { ...prev, [currentChannelId]: [...list, msg] }
          })
        } catch {
          // Fallback: reload channel
          loadMessages(currentChannelId)
        }
      } else if (payload.eventType === 'UPDATE') {
        try {
          const msg = await api.getMessage(payload.new.id)
          setMessages((prev) => ({
            ...prev,
            [currentChannelId]: (prev[currentChannelId] || []).map((m) =>
              m.id === msg.id ? msg : m
            ),
          }))
        } catch {
          loadMessages(currentChannelId)
        }
      } else if (payload.eventType === 'DELETE' && payload.old?.id) {
        setMessages((prev) => ({
          ...prev,
          [currentChannelId]: (prev[currentChannelId] || []).filter(
            (m) => m.id !== payload.old!.id
          ),
        }))
      }
    })

    realtimeChannelRef.current = ch

    return () => {
      if (realtimeChannelRef.current) {
        unsubscribe(realtimeChannelRef.current)
        realtimeChannelRef.current = null
      }
    }
  }, [currentChannelId])

  // Supabase Realtime: subscribe to ALL channel messages for unread indicators in sidebar
  // When a message arrives in a channel the user isn't viewing, increment that channel's unread count
  useEffect(() => {
    if (!currentServerId || !user?.id || !supabase) return

    const textChannelIds = new Set(
      channels.filter((c) => c.server_id === currentServerId && c.type === 'text').map((c) => c.id)
    )
    if (textChannelIds.size === 0) return

    const ch = subscribeToAllChannelMessages((payload) => {
      const { channel_id, user_id } = payload.new
      if (user_id === user.id) return
      if (currentChannelIdRef.current === channel_id) return
      if (!textChannelIds.has(channel_id)) return

      setChannelUnreadCounts((prev) => ({
        ...prev,
        [channel_id]: (prev[channel_id] ?? 0) + 1,
      }))
    })

    realtimeAllChannelRef.current = ch
    return () => {
      if (realtimeAllChannelRef.current) {
        unsubscribe(realtimeAllChannelRef.current)
        realtimeAllChannelRef.current = null
      }
    }
  }, [currentServerId, channels, user?.id])

  // Realtime reactions (subscribe to all, filter by message_id in current channel)
  useEffect(() => {
    if (!currentChannelId || !supabase) return

    const ch = subscribeToReactions(currentChannelId, (payload) => {
      const { message_id, user_id, emoji } = payload.new || payload.old || {}
      if (!message_id) return

      const list = messagesRef.current[currentChannelId] || []
      if (!list.some((m) => m.id === message_id)) return

      setMessages((prev) => {
        const list = prev[currentChannelId] || []
        const msg = list.find((m) => m.id === message_id)
        if (!msg) return prev

        const reactions = msg.reactions || []
        if (payload.eventType === 'INSERT') {
          if (reactions.some((r) => r.user_id === user_id && r.emoji === emoji))
            return prev
          return {
            ...prev,
            [currentChannelId]: list.map((m) =>
              m.id === message_id
                ? { ...m, reactions: [...reactions, { user_id: user_id!, emoji: emoji! }] }
                : m
            ),
          }
        } else {
          return {
            ...prev,
            [currentChannelId]: list.map((m) =>
              m.id === message_id
                ? {
                    ...m,
                    reactions: reactions.filter(
                      (r) => !(r.user_id === user_id && r.emoji === emoji)
                    ),
                  }
                : m
            ),
          }
        }
      })
    })

    realtimeReactionsRef.current = ch

    return () => {
      if (realtimeReactionsRef.current) {
        unsubscribe(realtimeReactionsRef.current)
        realtimeReactionsRef.current = null
      }
    }
  }, [currentChannelId])

  // Load DM conversations when user logs in
  useEffect(() => {
    if (user?.id) loadDMConversations()
  }, [user?.id, loadDMConversations])

  // Supabase Realtime: subscribe to ALL DM messages for unread indicators
  useEffect(() => {
    if (!user?.id || !supabase) return

    const ch = subscribeToAllDMMessages(async (payload) => {
      if (payload.eventType !== 'INSERT') return
      const { conversation_id, user_id } = payload.new
      if (user_id === user.id) return

      if (currentDMIdRef.current === conversation_id) return

      setDMConversations((prev) => {
        const hasConv = prev.some((c) => c.id === conversation_id)
        if (!hasConv) {
          loadDMConversations()
        }
        return prev
      })

      sounds.messageNotification()
      setDMUnreadCounts((prev) => ({
        ...prev,
        [conversation_id]: (prev[conversation_id] ?? 0) + 1,
      }))
      try {
        const msg = await api.getDMMessage(payload.new.id)
        setDMMessages((prev) => {
          const list = prev[conversation_id] || []
          if (list.some((m) => m.id === msg.id)) return prev
          return { ...prev, [conversation_id]: [...list, msg] }
        })
      } catch {
        /* ignore */
      }
    })

    realtimeAllDMRef.current = ch
    return () => {
      if (realtimeAllDMRef.current) {
        unsubscribe(realtimeAllDMRef.current)
        realtimeAllDMRef.current = null
      }
    }
  }, [user?.id])

  // Supabase Realtime: subscribe to DM messages for current conversation
  useEffect(() => {
    if (!currentDMId || !supabase) return

    const ch = subscribeToDMMessages(currentDMId, async (payload) => {
      if (payload.eventType === 'INSERT') {
        if (payload.new.user_id !== user?.id) {
          sounds.messageNotification()
        }
        try {
          const msg = await api.getDMMessage(payload.new.id)
          setDMMessages((prev) => {
            const list = prev[currentDMId] || []
            if (list.some((m) => m.id === msg.id)) return prev
            return { ...prev, [currentDMId]: [...list, msg] }
          })
        } catch {
          setDMMessages((prev) => {
            const list = prev[currentDMId] || []
            if (list.some((m) => m.id === payload.new.id)) return prev
            return {
              ...prev,
              [currentDMId]: [
                ...list,
                {
                  id: payload.new.id,
                  conversation_id: payload.new.conversation_id,
                  user_id: payload.new.user_id,
                  content: payload.new.content,
                  created_at: payload.new.created_at,
                  username: 'Unknown',
                },
              ],
            }
          })
        }
      } else if (payload.eventType === 'DELETE' && payload.old?.id) {
        setDMMessages((prev) => ({
          ...prev,
          [currentDMId]: (prev[currentDMId] || []).filter((m) => m.id !== payload.old!.id),
        }))
      }
    })

    realtimeDMRef.current = ch

    return () => {
      if (realtimeDMRef.current) {
        unsubscribe(realtimeDMRef.current)
        realtimeDMRef.current = null
      }
    }
  }, [currentDMId, user?.id])

  return (
    <AppContext.Provider
      value={{
        user,
        userStatus,
        setUserStatus,
        updateUser,
        servers,
        channels,
        categories,
        messages,
        currentServerId,
        currentChannelId,
        dmConversations,
        dmMessages,
        currentDMId,
        setCurrentDM,
        dmUnreadCounts,
        channelUnreadCounts,
        loadDMConversations,
        openDM,
        sendDMMessage,
        loadChannels,
        loadMessages,
        sendMessage,
        editMessage,
        deleteMessage,
        toggleReaction,
        createServer: createServerFn,
        updateServer: updateServerFn,
        deleteServer: deleteServerFn,
        createChannel: createChannelFn,
        reorderChannels: reorderChannelsFn,
        updateChannel: updateChannelFn,
        deleteChannel: deleteChannelFn,
        createCategory: createCategoryFn,
        updateCategory: updateCategoryFn,
        reorderCategories: reorderCategoriesFn,
        deleteCategory: deleteCategoryFn,
        loadServers,
        reorderServers: reorderServersFn,
        login,
        loginWithEmail,
        logout,
        setCurrentServer,
        setCurrentChannel,
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
