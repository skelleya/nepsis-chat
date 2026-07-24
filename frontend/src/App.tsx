import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react'
import gsap from 'gsap'
import * as api from './services/api'
import { subscribeToServerMembers, subscribeToUserPresence, unsubscribe } from './services/realtime'
import { AppProvider, useApp } from './contexts/AppContext'
import { VoiceProvider, useVoice } from './contexts/VoiceContext'
import { CallProvider, useCall } from './contexts/CallContext'
import { ServerBar } from './components/ServerBar'
import { ChannelList } from './components/ChannelList'
import { ChatView } from './components/ChatView'
import { VoiceView } from './components/VoiceView'
import { DMView } from './components/DMView'
import { MembersSidebar, type ServerMember } from './components/MembersSidebar'
import { CallOverlay } from './components/CallOverlay'
import { VoiceFloatingOverlay } from './components/VoiceFloatingOverlay'
import { LoginPage } from './components/LoginPage'
import { DownloadBanner } from './components/DownloadBanner'
import { EmailConfirmBanner } from './components/EmailConfirmBanner'
import { TitleBar } from './components/TitleBar'
import { GlobalKeybindings } from './components/GlobalKeybindings'
import { UserPanel } from './components/UserPanel'
import { ServerSettingsModal } from './components/ServerSettingsModal'
import { GroupDMModal } from './components/GroupDMModal'
import { mockChannels } from './data/mockData'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'

/** Set when an unauthenticated user clicks “Log In to Join” on an invite link. */
const PENDING_INVITE_KEY = 'nepsis_pending_invite'
import { DownloadPage } from './pages/DownloadPage'
import { InvitePage } from './pages/InvitePage'
import { CommunityPage } from './pages/CommunityPage'
import { FriendsPage } from './pages/FriendsPage'
import { OnboardingPage, ONBOARDING_COMPLETED_KEY } from './pages/OnboardingPage'
import { ErrorBoundary } from './components/ErrorBoundary'
import { blockUser, isUserBlocked, subscribeBlockedUsers } from './services/blockedUsers'

function AppContent() {
  const navigate = useNavigate()
  const {
    user,
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
    channelMentionCounts,
    openDM,
    createGroupDM,
    addGroupDMMembers,
    sendDMMessage,
    toggleDMReaction,
    setCurrentServer,
    setCurrentChannel,
    sendMessage,
    createServer,
    updateServer,
    deleteServer,
    reorderServers,
    createChannel,
    createCategory,
    reorderChannels,
    updateChannel,
    updateCategory,
    reorderCategories,
    deleteChannel,
    deleteCategory,
    logout,
  } = useApp()

  // If AppContent remounts while already authenticated (e.g. return from /invite/:code),
  // show the app immediately — the null→user transition effect will not re-fire.
  const [showLogin, setShowLogin] = useState(() => !user)
  const [showApp, setShowApp] = useState(() => !!user)
  const prevUserRef = useRef(user)
  const loginShellRef = useRef<HTMLDivElement>(null)
  const transitioningRef = useRef(false)

  // When auth succeeds: mount app underneath first, then fade login out (no scale — avoids black edge flash).
  useLayoutEffect(() => {
    const prev = prevUserRef.current
    prevUserRef.current = user

    if (!prev && user) {
      setShowApp(true)
      return
    }

    // Already signed in on (re)mount — keep app visible (invite join → navigate home).
    if (user && !showApp) {
      setShowApp(true)
      setShowLogin(false)
      return
    }

    if (prev && !user) {
      // Kill in-flight login fade so onComplete cannot hide login after logout
      if (loginShellRef.current) gsap.killTweensOf(loginShellRef.current)
      transitioningRef.current = false
      setShowApp(false)
      setShowLogin(true)
      if (loginShellRef.current) gsap.set(loginShellRef.current, { opacity: 1, y: 0, scale: 1 })
    }
  }, [user, showApp])

  // After login from an invite page, resume the invite flow.
  useEffect(() => {
    if (!user) return
    let code: string | null = null
    try {
      code = sessionStorage.getItem(PENDING_INVITE_KEY)
      if (code) sessionStorage.removeItem(PENDING_INVITE_KEY)
    } catch { /* ignore */ }
    if (code) navigate(`/invite/${code}`)
  }, [user, navigate])

  useLayoutEffect(() => {
    if (!user || !showApp || !showLogin || transitioningRef.current) return
    transitioningRef.current = true
    const el = loginShellRef.current
    if (!el) {
      setShowLogin(false)
      transitioningRef.current = false
      return
    }
    gsap.set(el, { opacity: 1, y: 0, scale: 1 })
    const tween = gsap.to(el, {
      opacity: 0,
      duration: 0.35,
      ease: 'power2.inOut',
      force3D: false,
      onComplete: () => {
        // Only hide login if still signed in — avoids blank screen after quick logout
        if (prevUserRef.current) setShowLogin(false)
        transitioningRef.current = false
      },
    })
    return () => {
      tween.kill()
      transitioningRef.current = false
    }
  }, [user, showApp, showLogin])

  const displayName = user ? ((user.display_name && user.display_name.trim()) || user.username) : ''
  // Never render an empty shell (stale GSAP onComplete used to leave both flags false)
  const showLoginLayer = showLogin || !user
  const isElectron = !!window.electronAPI?.isElectron
  const chromePad = isElectron ? 'pt-8' : ''

  return (
    <>
      {/* Electron: Discord-style custom chrome above everything */}
      <div className="fixed top-0 left-0 right-0 z-[60]">
        <TitleBar />
      </div>
      {showApp && user && (
        <div className={`fixed inset-0 overflow-hidden bg-app-darker ${chromePad}`}>
          <VoiceProvider userId={user.id} username={displayName}>
            <CallProvider userId={user.id} username={displayName}>
            <GlobalKeybindings />
            <MainLayout
              user={user}
              servers={servers}
              channels={channels}
              categories={categories}
              messages={messages}
              currentServerId={currentServerId}
              currentChannelId={currentChannelId}
              dmConversations={dmConversations}
              dmMessages={dmMessages}
              currentDMId={currentDMId}
              setCurrentDM={setCurrentDM}
              dmUnreadCounts={dmUnreadCounts}
              channelUnreadCounts={channelUnreadCounts}
              channelMentionCounts={channelMentionCounts}
              openDM={openDM}
              createGroupDM={createGroupDM}
              addGroupDMMembers={addGroupDMMembers}
              sendDMMessage={sendDMMessage}
              toggleDMReaction={toggleDMReaction}
              setCurrentServer={setCurrentServer}
              setCurrentChannel={setCurrentChannel}
              sendMessage={sendMessage}
              createServer={createServer}
              updateServer={updateServer}
              deleteServer={deleteServer}
              reorderServers={reorderServers}
              createChannel={createChannel}
              createCategory={createCategory}
              reorderChannels={reorderChannels}
              updateChannel={updateChannel}
              updateCategory={updateCategory}
              reorderCategories={reorderCategories}
              deleteChannel={deleteChannel}
              deleteCategory={deleteCategory}
              logout={logout}
            />
            </CallProvider>
          </VoiceProvider>
        </div>
      )}
      {showLoginLayer && (
        <div ref={loginShellRef} className={`fixed inset-0 z-20 ${chromePad}`}>
          <LoginPage />
        </div>
      )}
    </>
  )
}

interface MainLayoutProps {
  user: { id: string; username: string; display_name?: string | null; avatar_url?: string; banner_url?: string; is_guest?: boolean }
  servers: { id: string; name: string; icon_url?: string; banner_url?: string; owner_id: string; rules_channel_id?: string | null; lock_channels_until_rules_accepted?: boolean; rules_accept_emoji?: string }[]
  channels: { id: string; server_id: string; name: string; type: 'text' | 'voice'; order: number; category_id?: string | null }[]
  categories: { id: string; server_id: string; name: string; order: number }[]
  messages: Record<string, { id: string; channel_id: string; user_id: string; content: string; created_at: string; edited_at?: string; username?: string; reply_to_id?: string; reply_to?: { username?: string; content?: string }; attachments?: { url: string; type: string; filename?: string }[]; reactions?: { user_id: string; emoji: string }[] }[]>
  currentServerId: string | null
  currentChannelId: string | null
  dmConversations: api.DMConversation[]
  dmMessages: Record<string, { id: string; conversation_id: string; user_id: string; content: string; created_at: string; username: string }[]>
  currentDMId: string | null
  setCurrentDM: (id: string | null) => void
  dmUnreadCounts: Record<string, number>
  channelUnreadCounts: Record<string, number>
  channelMentionCounts: Record<string, number>
  openDM: (targetUserId: string, targetUsername: string) => Promise<string | undefined>
  createGroupDM: (memberIds: string[], name?: string) => Promise<string | undefined>
  addGroupDMMembers: (conversationId: string, memberIds: string[]) => Promise<void>
  sendDMMessage: (
    conversationId: string,
    content: string,
    options?: { replyToId?: string }
  ) => Promise<void>
  toggleDMReaction: (messageId: string, emoji: string) => Promise<void>
  setCurrentServer: (id: string) => void
  setCurrentChannel: (id: string) => void
  sendMessage: (channelId: string, content: string, options?: { replyToId?: string; attachments?: { url: string; type: string; filename?: string }[] }) => Promise<void>
  createServer: (name: string) => Promise<unknown>
  updateServer: (serverId: string, data: { name?: string; icon_url?: string; banner_url?: string }) => Promise<void>
  deleteServer: (serverId: string) => Promise<void>
  reorderServers: (updates: { serverId: string; order: number }[]) => Promise<void>
  createChannel: (name: string, type: 'text' | 'voice' | 'rules', categoryId?: string) => Promise<unknown>
  createCategory: (name: string) => Promise<unknown>
  reorderChannels: (updates: { id: string; order: number }[]) => Promise<void>
  updateChannel: (channelId: string, data: { name?: string; order?: number; categoryId?: string | null }) => Promise<void>
  updateCategory: (catId: string, data: { name?: string; order?: number }) => Promise<void>
  reorderCategories: (updates: { id: string; order: number }[]) => Promise<void>
  deleteChannel: (channelId: string) => Promise<void>
  deleteCategory: (catId: string) => Promise<void>
  logout: () => void
}

function MainLayout({
  user,
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
  channelMentionCounts,
  openDM,
  createGroupDM,
  addGroupDMMembers,
  sendDMMessage,
  toggleDMReaction,
  setCurrentServer,
  setCurrentChannel,
  sendMessage,
  createServer,
  updateServer,
  deleteServer,
  reorderServers,
  createChannel,
  createCategory,
  reorderChannels,
  updateChannel,
  updateCategory,
  reorderCategories,
  deleteChannel,
  deleteCategory,
  logout,
}: MainLayoutProps) {
  const voice = useVoice()
  const call = useCall()
  const currentDisplayName = (user.display_name && user.display_name.trim()) || user.username
  const [showServerSettings, setShowServerSettings] = useState(false)
  const [channelNavOpen, setChannelNavOpen] = useState(false)
  const [channelRailMinimized, setChannelRailMinimized] = useState(() => {
    try {
      return localStorage.getItem('nepsis_channel_rail_minimized') === '1'
    } catch {
      return false
    }
  })
  const [desktopLayout, setDesktopLayout] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  )
  const [membersOpen, setMembersOpen] = useState(false)
  const [groupDMModal, setGroupDMModal] = useState<{ mode: 'create' | 'add'; conversationId?: string } | null>(null)

  const toggleChannelRail = useCallback(() => {
    setChannelRailMinimized((current) => {
      const next = !current
      try {
        localStorage.setItem('nepsis_channel_rail_minimized', next ? '1' : '0')
      } catch { /* ignore */ }
      return next
    })
  }, [])

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)')
    const update = () => setDesktopLayout(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  const desktopChannelMinimized = desktopLayout && channelRailMinimized
  const [blockedRevision, setBlockedRevision] = useState(0)
  const savedView = (() => {
    try {
      const raw = localStorage.getItem('nepsis_last_view')
      if (!raw) return { view: 'community' as const }
      const parsed = JSON.parse(raw)
      return parsed?.view ? parsed : { view: 'community' as const }
    } catch {
      return { view: 'community' as const }
    }
  })()
  const hasNoServers = servers.length === 0
  const isGuest = user?.is_guest ?? false
  const hasCompletedOnboarding = (() => {
    try {
      return localStorage.getItem(ONBOARDING_COMPLETED_KEY) === 'true'
    } catch {
      return false
    }
  })()
  const shouldShowOnboarding = hasNoServers && !isGuest && !hasCompletedOnboarding
  const [showCommunity, setShowCommunity] = useState(
    savedView.view === 'community' || (savedView.view === 'server' && hasNoServers)
  )
  const [showOnboarding, setShowOnboarding] = useState(shouldShowOnboarding)
  const [showFriends, setShowFriends] = useState(savedView.view === 'friends')
  const [serverMembers, setServerMembers] = useState<ServerMember[]>([])
  const [serverEmojis, setServerEmojis] = useState<{ id: string; name: string; image_url: string }[]>([])
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const mainContentRef = useRef<HTMLDivElement>(null)

  useEffect(() => subscribeBlockedUsers(() => setBlockedRevision((n) => n + 1)), [])

  // Restore last view on mount; re-run when servers finish loading (0 -> >0)
  const prevServersLengthRef = useRef(servers.length)
  useEffect(() => {
    const hadServers = prevServersLengthRef.current > 0
    const hasServers = servers.length > 0
    prevServersLengthRef.current = servers.length

    try {
      const raw = localStorage.getItem('nepsis_last_view')
      const v = raw ? (JSON.parse(raw) as { view?: string; dmId?: string }) : { view: 'community' }
      if (hasServers) {
        if (v.view === 'community') {
          setShowCommunity(true)
          setShowFriends(false)
        } else if (v.view === 'friends') {
          setShowFriends(true)
          setShowCommunity(false)
          if (v.dmId) setCurrentDM(v.dmId)
        } else if (v.view === 'server') {
          setShowCommunity(false)
          setShowFriends(false)
          // Restore open DM over the server rail (voice presence stays visible)
          if (v.dmId) setCurrentDM(v.dmId)
        } else {
          setShowCommunity(false)
          setShowFriends(false)
        }
      } else if (!hadServers) {
        setShowCommunity(v.view === 'friends' ? false : true)
        setShowFriends(v.view === 'friends')
      }
    } catch { /* ignore */ }
  }, [servers.length, setCurrentDM])

  // When no servers: guest → explore; non-guest → onboarding (or explore if completed)
  useEffect(() => {
    if (!hasNoServers) {
      setShowOnboarding(false)
      return
    }
    const completed = localStorage.getItem(ONBOARDING_COMPLETED_KEY) === 'true'
    if (isGuest) {
      setShowOnboarding(false)
      setShowCommunity(true)
    } else if (!completed) {
      setShowOnboarding(true)
      setShowCommunity(false)
    } else {
      setShowOnboarding(false)
      setShowCommunity(true)
    }
  }, [hasNoServers, isGuest])

  useEffect(() => {
    if (servers.length === 0 && !showCommunity && !showFriends && !showOnboarding) {
      try {
        const raw = localStorage.getItem('nepsis_last_view')
        const v = raw ? (JSON.parse(raw) as { view?: string }) : {}
        setShowFriends(v.view === 'friends')
        setShowCommunity(v.view !== 'friends')
      } catch {
        setShowCommunity(true)
        setShowFriends(false)
      }
    }
  }, [servers.length, showCommunity, showFriends, showOnboarding])

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  const openCommunityView = useCallback(() => {
    setShowOnboarding(false)
    setShowCommunity(true)
    setShowFriends(false)
    try {
      localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true')
      localStorage.setItem('nepsis_last_view', JSON.stringify({ view: 'community' }))
    } catch { /* ignore */ }
  }, [])

  const { userStatus, setUserStatus, updateUser } = useApp()
  const currentServer = servers.find((s) => s.id === currentServerId)
  const memberRole = serverMembers.find((m) => m.userId === user.id)?.role
  // owner_id is authoritative — members poll must not strip Server Settings from the real owner
  const isServerOwner = !!currentServer && currentServer.owner_id === user.id
  const currentUserRole: ServerMember['role'] = isServerOwner
    ? 'owner'
    : memberRole === 'owner' || memberRole === 'admin' || memberRole === 'member'
      ? memberRole
      : 'member'
  const isAdminOrOwner =
    isServerOwner || currentUserRole === 'owner' || currentUserRole === 'admin'

  // Keep a snapshot so Server Settings stays mounted if servers briefly fails to reload
  const settingsServerRef = useRef(currentServer)
  if (currentServer) settingsServerRef.current = currentServer
  const settingsServer = currentServer ?? (showServerSettings ? settingsServerRef.current : undefined)

  // Close settings when leaving the server context (not on transient list clear)
  useEffect(() => {
    if (!showServerSettings) return
    if (currentServerId && settingsServerRef.current && settingsServerRef.current.id !== currentServerId) {
      setShowServerSettings(false)
    }
  }, [currentServerId, showServerSettings])

  useEffect(() => {
    if (!currentServerId) return
    api.getServerEmojis(currentServerId).then(setServerEmojis).catch(() => setServerEmojis([]))
  }, [currentServerId])

  // Track in-flight refresh; allow a follow-up load if presence changed mid-fetch
  const membersRefreshRef = useRef(false)
  const membersNeedsReloadRef = useRef(false)
  const effectiveVoiceChannelId = voice.voiceChannelId ?? voice.otherTabVoiceChannelId
  const voiceChannelIdRef = useRef(effectiveVoiceChannelId)
  const userStatusRef = useRef(userStatus)
  const serverOwnerIdRef = useRef<string | null>(null)
  voiceChannelIdRef.current = effectiveVoiceChannelId
  userStatusRef.current = userStatus
  serverOwnerIdRef.current = currentServer?.owner_id ?? null

  /** Overlay live self-presence so we never look Offline / missing while connected. */
  const withLiveSelfPresence = useCallback((members: ServerMember[]): ServerMember[] => {
    if (!user) return members
    const liveVoice = voiceChannelIdRef.current
    const liveStatus: ServerMember['status'] = liveVoice
      ? 'in-voice'
      : userStatusRef.current === 'offline'
        ? 'offline'
        : userStatusRef.current === 'away' || userStatusRef.current === 'dnd'
          ? userStatusRef.current
          : 'online'
    const selfIsOwner = serverOwnerIdRef.current === user.id
    const patched = members.map((m) => {
      if (m.userId !== user.id) return m
      return {
        ...m,
        role: selfIsOwner ? 'owner' : m.role,
        status: liveStatus,
        // Prefer live voice channel; keep API value only when not in voice locally
        voiceChannelId: liveVoice ?? (liveStatus === 'in-voice' ? m.voiceChannelId : null),
        username: m.username || currentDisplayName,
        avatarUrl: user.avatar_url ?? m.avatarUrl,
      }
    })
    // Ensure self is always in the member list when viewing a server we're in
    if (!patched.some((m) => m.userId === user.id)) {
      patched.push({
        userId: user.id,
        username: currentDisplayName,
        avatarUrl: user.avatar_url,
        role: selfIsOwner ? 'owner' : 'member',
        status: liveStatus,
        voiceChannelId: liveVoice ?? null,
      })
    }
    return patched
  }, [user, currentDisplayName])

  useEffect(() => {
    if (!currentServerId || !user) {
      setServerMembers([])
      return
    }

    const load = async () => {
      if (membersRefreshRef.current) {
        membersNeedsReloadRef.current = true
        return
      }
      membersRefreshRef.current = true
      try {
        do {
          membersNeedsReloadRef.current = false
          const members = await api.getServerMembers(currentServerId)
          const isMember = members.some((m: ServerMember) => m.userId === user.id)
          const selfIsOwner = serverOwnerIdRef.current === user.id
          if (!isMember) {
            if (selfIsOwner) {
              // Membership row missing/raced but servers.owner_id says we own it — keep owner UI
              setServerMembers(withLiveSelfPresence(members))
            } else {
              // Confirmed not in server_members — clear list (kicked / left).
              setServerMembers([])
            }
            break
          }
          // Always overlay live self presence so you never look Offline / missing to yourself
          setServerMembers(withLiveSelfPresence(members))
        } while (membersNeedsReloadRef.current)
      } catch (err) {
        // Transient API failures must not wipe roles (that hid Server Settings for owners)
        console.warn('Members refresh failed; keeping previous list', err)
      } finally {
        membersRefreshRef.current = false
      }
    }

    load()

    const membersChannel = subscribeToServerMembers(currentServerId, () => {
      load()
    })

    // Instant presence updates (online / in-voice) for everyone already in this server.
    // Presence is global — ignore userIds not in this server's member list (members INSERT reloads).
    const presenceChannel = subscribeToUserPresence((payload) => {
      const uid = payload.new?.user_id || payload.old?.user_id
      if (!uid) return
      setServerMembers((prev) => {
        if (!prev.some((m) => m.userId === uid)) return prev
        if (payload.eventType === 'DELETE' || !payload.new?.user_id) {
          // Never wipe our own live presence from a Realtime DELETE race
          return withLiveSelfPresence(
            prev.map((m) =>
              m.userId === uid ? { ...m, status: 'offline' as const, voiceChannelId: null } : m
            )
          )
        }
        const st = payload.new.status
        const mapped: ServerMember['status'] =
          st === 'in-voice' ? 'in-voice'
            : st === 'online' ? 'online'
              : st === 'away' ? 'away'
                : st === 'dnd' ? 'dnd'
                  : 'offline'
        return withLiveSelfPresence(
          prev.map((m) =>
            m.userId === uid
              ? { ...m, status: mapped, voiceChannelId: payload.new.voice_channel_id ?? null }
              : m
          )
        )
      })
    })

    // Fallback poll (presence realtime covers most cases)
    const ms = effectiveVoiceChannelId ? 3000 : 10000
    const interval = setInterval(load, ms)

    return () => {
      clearInterval(interval)
      unsubscribe(membersChannel)
      unsubscribe(presenceChannel)
    }
  }, [currentServerId, user?.id, user?.avatar_url, effectiveVoiceChannelId, withLiveSelfPresence])

  // Update presence (online / in-voice / away / dnd) — optimistic local patch first
  useEffect(() => {
    if (!user) return
    const status = effectiveVoiceChannelId ? 'in-voice' : userStatus
    const voiceChannelId = effectiveVoiceChannelId ?? null

    setServerMembers((prev) =>
      withLiveSelfPresence(
        prev.map((m) =>
          m.userId === user.id
            ? {
                ...m,
                status: status === 'offline' ? 'offline'
                  : status === 'away' || status === 'dnd' || status === 'in-voice' ? status
                    : 'online',
                voiceChannelId,
              }
            : m
        )
      )
    )

    // Retry so the other device / Realtime subscribers see you instantly
    const push = (attempt = 0) => {
      api.updatePresence(user.id, status, voiceChannelId).catch((err) => {
        console.warn('Presence update failed', err)
        if (attempt < 2) setTimeout(() => push(attempt + 1), 400 * (attempt + 1))
      })
    }
    push()
  }, [user?.id, effectiveVoiceChannelId, userStatus, withLiveSelfPresence])

  // Heartbeat so other devices see you as online even if a single upsert was dropped
  useEffect(() => {
    if (!user) return
    const tick = () => {
      const status = voiceChannelIdRef.current ? 'in-voice' : userStatusRef.current
      const voiceChannelId = voiceChannelIdRef.current ?? null
      api.updatePresence(user.id, status === 'offline' ? 'online' : status, voiceChannelId).catch(() => {})
    }
    const id = setInterval(tick, 25000)
    return () => clearInterval(id)
  }, [user?.id])

  // Mark offline when tab closes / refreshes (keepalive survives unload)
  useEffect(() => {
    if (!user) return
    const markOffline = () => {
      // Another same-account tab owns voice; closing this observer must not
      // erase that session's global presence.
      if (voiceChannelIdRef.current && !voice.voiceChannelId) return
      const base = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
      try {
        fetch(`${base}/users/${user.id}/presence`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'offline', voiceChannelId: null }),
          keepalive: true,
        }).catch(() => {})
      } catch { /* ignore */ }
    }
    window.addEventListener('pagehide', markOffline)
    return () => window.removeEventListener('pagehide', markOffline)
  }, [user?.id, voice.voiceChannelId])

  const handleKick = useCallback(
    async (targetUserId: string) => {
      if (!currentServerId || !user) return
      try {
        await api.kickMember(currentServerId, targetUserId, user.id)
        setServerMembers((prev) => prev.filter((m) => m.userId !== targetUserId))
        showNotification('Member kicked from server')
      } catch (e) {
        showNotification(e instanceof Error ? e.message : 'Failed to kick member', 'error')
        throw e
      }
    },
    [currentServerId, user]
  )

  const handleBan = useCallback(
    async (targetUserId: string) => {
      if (!currentServerId || !user) return
      try {
        await api.banMember(currentServerId, targetUserId, user.id)
        setServerMembers((prev) => prev.filter((m) => m.userId !== targetUserId))
        showNotification('Member banned from server')
      } catch (e) {
        showNotification(e instanceof Error ? e.message : 'Failed to ban member', 'error')
        throw e
      }
    },
    [currentServerId, user]
  )

  const handleInvitePeople = useCallback(async () => {
    if (!currentServerId || !user) return
    try {
      const inv = await api.createInvite(currentServerId, user.id)
      const link = `${window.location.origin}${window.location.pathname || '/'}#/invite/${inv.code}`
      await navigator.clipboard.writeText(link)
      showNotification('Invite link copied to clipboard!')
    } catch (e) {
      showNotification(e instanceof Error ? e.message : 'Failed to create invite', 'error')
    }
  }, [currentServerId, user?.id])

  const displayChannels = channels.length > 0 ? channels : mockChannels.filter((c) => c.serverId === currentServerId).map((c) => ({
    id: c.id,
    server_id: c.serverId,
    name: c.name,
    type: c.type,
    order: c.order,
    category_id: null as string | null,
  }))

  const currentChannel = displayChannels.find((c) => c.id === currentChannelId)
  const channelMessages = currentChannelId ? (messages[currentChannelId] || []) : []

  // Rules acceptance: when server locks channels until rules accepted
  const [rulesAccepted, setRulesAccepted] = useState<Record<string, boolean>>({})
  const rulesChannelId = currentServer?.rules_channel_id
  const lockUntilAccepted = !!currentServer?.lock_channels_until_rules_accepted
  const mustAcceptRules = lockUntilAccepted && !!rulesChannelId
  const rulesAcceptanceKnown = !rulesChannelId || (currentServerId != null && currentServerId in rulesAccepted)
  const hasAcceptedRules = rulesChannelId ? (rulesAccepted[currentServerId ?? ''] === true) : true

  useEffect(() => {
    if (!currentServerId || !user || !rulesChannelId) return
    api.getRulesAcceptance(currentServerId, user.id).then((r) => {
      setRulesAccepted((prev) => ({ ...prev, [currentServerId]: r.accepted }))
    }).catch(() => {})
  }, [currentServerId, user?.id, rulesChannelId])

  // When server has lock and user hasn't accepted, auto-select rules channel
  useEffect(() => {
    if (!mustAcceptRules || hasAcceptedRules || !rulesChannelId || !rulesAcceptanceKnown) return
    const rulesCh = displayChannels.find((c) => c.id === rulesChannelId)
    if (rulesCh && currentChannelId !== rulesChannelId) {
      setCurrentChannel(rulesChannelId)
    }
  }, [mustAcceptRules, hasAcceptedRules, rulesChannelId, rulesAcceptanceKnown, currentChannelId, displayChannels, setCurrentChannel])

  const refreshRulesAccepted = useCallback(() => {
    if (!currentServerId || !user || !rulesChannelId) return
    api.getRulesAcceptance(currentServerId, user.id).then((r) => {
      setRulesAccepted((prev) => ({ ...prev, [currentServerId]: r.accepted }))
    }).catch(() => {})
  }, [currentServerId, user?.id, rulesChannelId])

  // Handle channel selection - close DM, open channel; voice also joins
  const handleSelectChannel = useCallback((channel: { id: string; name: string; type: string; serverId?: string }) => {
    if (mustAcceptRules && rulesAcceptanceKnown && !hasAcceptedRules && channel.type !== 'rules' && channel.id !== rulesChannelId) {
      setCurrentDM(null)
      setShowFriends(false)
      setCurrentChannel(rulesChannelId)
      setChannelNavOpen(false)
      showNotification('Accept the rules first to access other channels')
      return
    }
    // Leaving a DM for a text/voice/rules channel
    setCurrentDM(null)
    setShowFriends(false)
    setShowCommunity(false)
    setCurrentChannel(channel.id)
    setChannelNavOpen(false)
    try {
      localStorage.setItem('nepsis_last_view', JSON.stringify({ view: 'server' }))
    } catch { /* ignore */ }
    if (channel.type === 'voice') {
      // Opening the room already owned by another tab is observer-only. The
      // existing session keeps its mic/WebRTC connection instead of being kicked.
      if (voice.otherTabVoiceChannelId !== channel.id) {
        voice.joinVoice(channel.id, channel.name, {
          serverId: channel.serverId || currentServerId,
          restoreUi: false,
        })
      }
    }
  }, [setCurrentChannel, setCurrentDM, voice, mustAcceptRules, rulesAcceptanceKnown, hasAcceptedRules, rulesChannelId, currentServerId])

  // After refresh/rejoin: open the voice channel UI (and its server) automatically.
  useEffect(() => {
    if (!voice.voiceChannelId || !servers.length) return
    let parsed: { restoreUi?: boolean; serverId?: string | null; channelId?: string } | null = null
    try {
      const raw = sessionStorage.getItem('nepsis_voice_rejoin')
      parsed = raw ? JSON.parse(raw) : null
    } catch {
      parsed = null
    }
    if (!parsed?.restoreUi) return

    const serverId = parsed.serverId || voice.voiceServerId
    if (serverId && serverId !== currentServerId) {
      setCurrentServer(serverId)
      return
    }
    if (!serverId) return

    const channelReady =
      channels.some((c) => c.id === voice.voiceChannelId && c.server_id === serverId) ||
      displayChannels.some((c) => c.id === voice.voiceChannelId)

    if (!channelReady && channels.length === 0) return

    setShowFriends(false)
    setShowCommunity(false)
    setShowOnboarding(false)
    setCurrentDM(null)
    if (currentChannelId !== voice.voiceChannelId) {
      setCurrentChannel(voice.voiceChannelId)
    }
    try {
      localStorage.setItem('nepsis_last_view', JSON.stringify({ view: 'server' }))
    } catch { /* ignore */ }
    voice.clearVoiceUiRestoreFlag()
  }, [
    voice.voiceChannelId,
    voice.voiceServerId,
    voice.clearVoiceUiRestoreFlag,
    servers.length,
    currentServerId,
    currentChannelId,
    channels,
    displayChannels,
    setCurrentServer,
    setCurrentChannel,
    setCurrentDM,
  ])

  // After switching back to the server you're in voice on, open that voice room
  // once channels are loaded (covers async layout cache / last-channel races).
  const preferVoiceOnServerRef = useRef<string | null>(null)
  useEffect(() => {
    const targetServer = preferVoiceOnServerRef.current
    if (!targetServer || !voice.voiceChannelId || voice.voiceServerId !== targetServer) return
    if (currentServerId !== targetServer) return
    if (!channels.some((c) => c.id === voice.voiceChannelId && c.server_id === targetServer)) return
    setCurrentChannel(voice.voiceChannelId)
    preferVoiceOnServerRef.current = null
  }, [currentServerId, voice.voiceChannelId, voice.voiceServerId, channels, setCurrentChannel])

  const visibleDmConversations = dmConversations.filter(
    (c) => c.is_group || !c.other_user?.id || !isUserBlocked(c.other_user.id)
  )
  void blockedRevision // re-filter when block list changes

  const handleOpenDM = useCallback(
    async (targetUserId: string, targetUsername: string) => {
      if (isUserBlocked(targetUserId)) {
        showNotification('Unblock this user in Privacy settings to message them', 'error')
        return undefined
      }
      const dmId = await openDM(targetUserId, targetUsername)
      // From a server (member Message / voice), keep channel list + voice presence visible
      if (currentServerId && !showFriends) {
        setShowFriends(false)
        try {
          localStorage.setItem('nepsis_last_view', JSON.stringify({ view: 'server', dmId }))
        } catch { /* ignore */ }
      }
      setChannelNavOpen(false)
      setMembersOpen(false)
      return dmId
    },
    [openDM, currentServerId, showFriends]
  )

  const handleBlockUser = useCallback(
    (targetUserId: string) => {
      const conv = dmConversations.find((c) => c.other_user?.id === targetUserId)
      const name = conv?.other_user?.username || 'User'
      blockUser(targetUserId, name)
      if (currentDMId && conv?.id === currentDMId) setCurrentDM(null)
      showNotification(`Blocked ${name}. Manage blocked users in Privacy settings.`)
    },
    [dmConversations, currentDMId, setCurrentDM]
  )

  const handleReportUser = useCallback(
    async (targetUserId: string) => {
      const conv = dmConversations.find((c) => c.other_user?.id === targetUserId)
      const name = conv?.other_user?.username || 'User'
      try {
        await api.submitBugReport({
          userId: user.id,
          username: currentDisplayName,
          title: `User report: ${name}`,
          description: `Reported userId=${targetUserId} username=${name} from DM. Please review for abuse.`,
        })
        showNotification(`Report submitted for ${name}`)
      } catch (e) {
        showNotification(e instanceof Error ? e.message : 'Failed to submit report', 'error')
      }
    },
    [dmConversations, user.id, currentDisplayName]
  )

  const mobileTitle = showFriends && !currentDMId
    ? 'Friends'
    : currentDMId
      ? (() => {
          const conversation = dmConversations.find((entry) => entry.id === currentDMId)
          if (!conversation) return 'Direct Message'
          if (!conversation.is_group) return conversation.other_user?.username || 'Direct Message'
          return conversation.name?.trim() || conversation.participants
            .filter((participant) => participant.id !== user.id)
            .map((participant) => participant.username)
            .join(', ') || 'Group message'
        })()
      : showCommunity
        ? 'Community'
        : showOnboarding
          ? 'Welcome'
          : currentChannel?.name
            ? `${currentChannel.type === 'text' || currentChannel.type === 'rules' ? '#' : ''}${currentChannel.name}`
            : currentServer?.name || 'Nepsis'

  // Build voice users map from ALL server members' presence — so users see who's in
  // each voice channel BEFORE entering (not just when they're already in one).
  const voiceUsers: Record<string, { userId: string; username: string; avatar_url?: string; isMuted?: boolean; isDeafened?: boolean; isSpeaking?: boolean; isScreenSharing?: boolean }[]> = {}
  if (currentServerId && displayChannels.length > 0) {
    for (const member of serverMembers) {
      // Skip the current user from serverMembers — we'll add them from live voice state below
      if (member.userId === user.id) continue
      const chId = member.voiceChannelId
      if (!chId) continue
      // Channel IDs are globally unique; match by id (server_id optional for mock/partial loads)
      const ch = displayChannels.find((c) => c.id === chId)
      if (!ch || ch.type !== 'voice') continue
      if (ch.server_id && ch.server_id !== currentServerId) continue
      if (!voiceUsers[chId]) voiceUsers[chId] = []
      const voiceState = voice.remoteVoiceStates[member.userId]
      voiceUsers[chId].push({
        userId: member.userId,
        username: member.username,
        avatar_url: member.avatarUrl,
        isMuted: voiceState?.muted,
        isDeafened: voiceState?.deafened,
        isScreenSharing: voice.screenShareUserIds.includes(member.userId),
      })
    }
    // Inject self from this tab's live session or another same-account tab.
    if (effectiveVoiceChannelId) {
      const chInServer = displayChannels.find((c) => c.id === effectiveVoiceChannelId)
      // Show under this channel when it belongs to the current server, or until channels finish loading
      const belongsHere = !chInServer || !chInServer.server_id || chInServer.server_id === currentServerId
      if (belongsHere) {
        const chId = effectiveVoiceChannelId
        if (!voiceUsers[chId]) voiceUsers[chId] = []
        if (!voiceUsers[chId].some((u) => u.userId === user.id)) {
          voiceUsers[chId].unshift({
            userId: user.id,
            username: currentDisplayName,
            avatar_url: user.avatar_url,
            isMuted: voice.voiceChannelId ? voice.isMuted : false,
            isDeafened: voice.voiceChannelId ? voice.isDeafened : false,
            isSpeaking: voice.voiceChannelId ? voice.isSpeaking : false,
            isScreenSharing: voice.voiceChannelId ? voice.isScreenSharing : false,
          })
        } else {
          const selfIdx = voiceUsers[chId].findIndex((u) => u.userId === user.id)
          if (selfIdx >= 0) {
            voiceUsers[chId][selfIdx] = {
              ...voiceUsers[chId][selfIdx],
              isMuted: voice.voiceChannelId ? voice.isMuted : voiceUsers[chId][selfIdx].isMuted,
              isDeafened: voice.voiceChannelId ? voice.isDeafened : voiceUsers[chId][selfIdx].isDeafened,
              isSpeaking: voice.voiceChannelId ? voice.isSpeaking : false,
              isScreenSharing: voice.voiceChannelId ? voice.isScreenSharing : voiceUsers[chId][selfIdx].isScreenSharing,
            }
          }
        }
        // Merge real-time participants (remote peers) — use avatar from serverMembers if available
        const memberByUserId = new Map(serverMembers.map((m) => [m.userId, m]))
        const inList = new Set(voiceUsers[chId].map((u) => u.userId))
        for (const p of voice.participants) {
          const voiceState = voice.remoteVoiceStates[p.userId]
          if (!inList.has(p.userId)) {
            const m = memberByUserId.get(p.userId)
            voiceUsers[chId].push({
              userId: p.userId,
              username: p.username,
              avatar_url: m?.avatarUrl,
              isMuted: voiceState?.muted ?? p.isMuted ?? false,
              isDeafened: voiceState?.deafened ?? p.isDeafened ?? false,
              isSpeaking: p.isSpeaking,
              isScreenSharing: voice.screenShareUserIds.includes(p.userId),
            })
          } else {
            const idx = voiceUsers[chId].findIndex((u) => u.userId === p.userId)
            if (idx >= 0) {
              voiceUsers[chId][idx] = {
                ...voiceUsers[chId][idx],
                isMuted: voiceState?.muted ?? p.isMuted ?? voiceUsers[chId][idx].isMuted,
                isDeafened: voiceState?.deafened ?? p.isDeafened ?? voiceUsers[chId][idx].isDeafened,
                isSpeaking: p.isSpeaking,
                isScreenSharing: voice.screenShareUserIds.includes(p.userId),
              }
            }
          }
        }
      }
    }
  }

  // Voice connection info for ChannelList
  const voiceConnection = voice.isConnected ? {
    channelId: voice.voiceChannelId!,
    channelName: voice.voiceChannelName!,
    isMuted: voice.isMuted,
    isDeafened: voice.isDeafened,
    isCameraOn: voice.isCameraOn,
    isScreenSharing: voice.isScreenSharing,
    ping: voice.ping,
    pingSource: voice.pingSource,
    pingPath: voice.pingPath,
    onToggleMute: () => voice.setIsMuted(!voice.isMuted),
    onToggleDeafen: () => voice.setIsDeafened(!voice.isDeafened),
    onToggleCamera: () => voice.toggleCamera(),
    onToggleScreenShare: () => voice.toggleScreenShare(),
    onDisconnect: () => voice.leaveVoice(),
  } : null

  const handleMuteInVoice = async (targetUserId: string) => {
    if (!currentServerId) return
    try {
      await api.muteMemberInVoice(currentServerId, targetUserId, user.id)
      showNotification('User muted in voice')
    } catch (e) {
      showNotification((e as Error).message, 'error')
    }
  }

  const handleUnmuteInVoice = async (targetUserId: string) => {
    if (!currentServerId) return
    try {
      await api.unmuteMemberInVoice(currentServerId, targetUserId, user.id)
      showNotification('User unmuted in voice')
    } catch (e) {
      showNotification((e as Error).message, 'error')
    }
  }

  const handleDeafenInVoice = async (targetUserId: string) => {
    if (!currentServerId) return
    try {
      await api.deafenMemberInVoice(currentServerId, targetUserId, user.id)
      showNotification('User deafened in voice')
    } catch (e) {
      showNotification((e as Error).message, 'error')
    }
  }

  const handleUndeafenInVoice = async (targetUserId: string) => {
    if (!currentServerId) return
    try {
      await api.undeafenMemberInVoice(currentServerId, targetUserId, user.id)
      showNotification('User undeafened in voice')
    } catch (e) {
      showNotification((e as Error).message, 'error')
    }
  }

  const handleDisconnectFromVoice = async (targetUserId: string) => {
    if (!currentServerId) return
    try {
      await api.disconnectMemberFromVoice(currentServerId, targetUserId, user.id)
      showNotification('User disconnected from voice')
      const updated = await api.getServerMembers(currentServerId)
      setServerMembers(withLiveSelfPresence(updated))
    } catch (e) {
      showNotification((e as Error).message, 'error')
    }
  }

  // Clear stale DM selection when conversation not found (e.g. after API failure or tables missing)
  useEffect(() => {
    if (!currentDMId) return
    const conv = dmConversations.find((c) => c.id === currentDMId)
    if (!conv || (!conv.is_group && !conv.other_user)) setCurrentDM(null)
  }, [currentDMId, dmConversations, setCurrentDM])

  const mainViewKey =
    showFriends && !currentDMId ? 'friends'
      : currentDMId ? `dm-${currentDMId}`
        : showOnboarding ? 'onboarding'
          : showCommunity ? 'community'
            : currentChannel ? `${currentChannel.type}-${currentChannel.id}`
              : 'empty'

  // VoiceView is only mounted for the voice channel main pane — everywhere else keep PiP cameras.
  const showingVoiceView =
    !showFriends &&
    !currentDMId &&
    !showOnboarding &&
    !showCommunity &&
    currentChannel?.type === 'voice'

  const voicePipAvatars = useMemo(() => {
    const map = new Map<string, string | undefined>()
    for (const m of serverMembers) {
      map.set(m.userId, m.avatarUrl)
    }
    if (user?.avatar_url) map.set(user.id, user.avatar_url)
    return map
  }, [serverMembers, user?.id, user?.avatar_url])

  useLayoutEffect(() => {
    const el = mainContentRef.current
    if (!el) return
    gsap.killTweensOf(el)
    gsap.fromTo(
      el,
      { opacity: 0 },
      { opacity: 1, duration: 0.2, ease: 'sine.out', overwrite: true }
    )
    // Voice audio sinks live outside this node; nudge play after view swaps so
    // browsers that paused sinks when VoiceView unmounted resume hearing peers.
    try {
      window.dispatchEvent(new Event('nepsis-voice-audio-nudge'))
    } catch {
      /* ignore */
    }
    return () => {
      gsap.killTweensOf(el)
    }
  }, [mainViewKey])

  return (
    <div className="h-full w-full min-h-0 flex bg-app-darker overflow-hidden relative">
      <ServerBar
        servers={servers.map((s) => ({ id: s.id, name: s.name, iconUrl: s.icon_url, bannerUrl: s.banner_url, ownerId: s.owner_id }))}
        currentServerId={currentServerId}
        isFriendsActive={showFriends}
        onSelectServer={(id) => {
          setShowCommunity(false)
          setShowFriends(false)
          setCurrentDM(null)
          setCurrentServer(id)
          setChannelNavOpen(false)
          try {
            localStorage.setItem('nepsis_last_view', JSON.stringify({ view: 'server' }))
          } catch { /* ignore */ }
          // Prefer the live voice room when returning to its server.
          if (voice.voiceChannelId && voice.voiceServerId === id) {
            preferVoiceOnServerRef.current = id
            queueMicrotask(() => setCurrentChannel(voice.voiceChannelId!))
          }
        }}
        onCreateServer={async (name) => { await createServer(name) }}
        onReorderServers={reorderServers}
        canCreateServer={!user?.is_guest}
        onOpenCommunity={openCommunityView}
        onOpenFriends={() => {
          setShowCommunity(false)
          setShowFriends(true)
          setChannelNavOpen(true)
          try {
            localStorage.setItem('nepsis_last_view', JSON.stringify({ view: 'friends' }))
          } catch { /* ignore */ }
        }}
      />

      {/* Mobile channel-nav backdrop */}
      {channelNavOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          aria-label="Close channel list"
          onClick={() => setChannelNavOpen(false)}
        />
      )}

      {/* Channel list + User panel wrapper */}
      <div
        className={`fixed lg:relative z-40 inset-y-0 left-[72px] lg:left-auto w-72 ${desktopChannelMinimized ? 'lg:w-14' : 'lg:w-72'} bg-app-channel flex flex-col flex-shrink-0 transition-[width,transform] duration-200 ease-out ${
          channelNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <ChannelList
          channels={displayChannels.map((c) => ({ id: c.id, name: c.name, type: c.type as 'text' | 'voice' | 'rules', serverId: c.server_id, order: c.order, categoryId: c.category_id }))}
          categories={categories.map((cat) => ({ id: cat.id, name: cat.name, serverId: cat.server_id, order: cat.order }))}
          currentChannelId={currentDMId ? null : currentChannelId}
          onSelectChannel={(ch) => handleSelectChannel(ch)}
          serverName={currentServer?.name}
          serverBannerUrl={currentServer?.banner_url}
          onCreateChannel={async (name, type, catId) => {
            try {
              await createChannel(name, type, catId)
            } catch (e) {
              showNotification(e instanceof Error ? e.message : 'Failed to create channel', 'error')
            }
          }}
          onCreateCategory={async (name) => { await createCategory(name) }}
          onReorderChannels={async (updates) => { await reorderChannels(updates) }}
          onUpdateChannel={updateChannel}
          onUpdateCategory={updateCategory}
          onReorderCategories={async (updates) => { await reorderCategories(updates) }}
          onDeleteChannel={deleteChannel}
          onDeleteCategory={deleteCategory}
          onMoveToChannel={async (targetUserId, channelId) => {
            if (!currentServerId) return
            try {
              await api.moveMemberToVoiceChannel(currentServerId, targetUserId, channelId, user.id)
              showNotification('User moved to voice channel')
              const updated = await api.getServerMembers(currentServerId)
              setServerMembers(withLiveSelfPresence(updated))
            } catch (e) {
              showNotification((e as Error).message, 'error')
            }
          }}
          onMuteInVoice={handleMuteInVoice}
          onUnmuteInVoice={handleUnmuteInVoice}
          onDeafenInVoice={handleDeafenInVoice}
          onUndeafenInVoice={handleUndeafenInVoice}
          onDisconnectFromVoice={handleDisconnectFromVoice}
          onKick={handleKick}
          onBan={handleBan}
          onMessageUser={async (userId, username) => {
            try {
              await handleOpenDM(userId, username)
            } catch (e) {
              showNotification((e as Error).message, 'error')
            }
          }}
          onCallUser={(targetUserId, targetUsername, targetAvatarUrl) => {
            call.initiateCall(targetUserId, targetUsername, targetAvatarUrl)
          }}
          onAddFriend={async (userId, username) => {
            try {
              await api.sendFriendRequest(user.id, userId, 'personal', 'personal')
              showNotification(`Friend request sent to ${username}`)
            } catch (e) {
              showNotification((e as Error).message, 'error')
            }
          }}
          onSetMemberRole={async (targetUserId, role) => {
            if (!currentServerId) return
            try {
              await api.setMemberRole(currentServerId, targetUserId, user.id, role)
              showNotification(role === 'admin' ? 'User promoted to admin' : 'User set to member')
              const updated = await api.getServerMembers(currentServerId)
              setServerMembers(withLiveSelfPresence(updated))
            } catch (e) {
              showNotification((e as Error).message, 'error')
            }
          }}
          serverMembers={serverMembers}
          currentUserRole={currentUserRole}
          voiceConnection={voiceConnection}
          voiceUsers={voiceUsers}
          onWatchScreenShare={(userId) => {
            voice.setWatchingShareUserId(userId)
            // Open the voice channel view so the resizable stage is visible
            if (voice.voiceChannelId) {
              setCurrentDM(null)
              setShowFriends(false)
              setCurrentChannel(voice.voiceChannelId)
              setChannelNavOpen(false)
            }
          }}
          onOpenServerSettings={() => setShowServerSettings(true)}
          onInvitePeople={handleInvitePeople}
          onOpenCommunity={openCommunityView}
          serverId={currentServerId ?? undefined}
          isOwner={isServerOwner || currentUserRole === 'owner'}
          isAdminOrOwner={isAdminOrOwner}
          hasNoServers={servers.length === 0}
          isFriendsView={showFriends}
          dmConversations={visibleDmConversations}
          currentDMId={currentDMId}
          dmUnreadCounts={dmUnreadCounts}
          channelUnreadCounts={channelUnreadCounts}
          channelMentionCounts={channelMentionCounts}
          onSelectDM={(id) => {
            // Discord-like: opening a DM keeps the current sidebar.
            // On a server (e.g. while in voice), stay on server channels so you still see
            // yourself in the voice channel; Friends home keeps the friends sidebar.
            setCurrentDM(id)
            setShowCommunity(false)
            setChannelNavOpen(false)
            try {
              localStorage.setItem(
                'nepsis_last_view',
                JSON.stringify(
                  showFriends
                    ? { view: 'friends', dmId: id }
                    : { view: 'server', dmId: id }
                )
              )
            } catch { /* ignore */ }
          }}
          onCreateGroupDM={() => setGroupDMModal({ mode: 'create' })}
          minimized={desktopChannelMinimized}
          onToggleMinimized={toggleChannelRail}
        />
        <UserPanel
          user={user}
          isMuted={voice.isMuted}
          isDeafened={voice.isDeafened}
          isSpeaking={voice.isSpeaking}
          userStatus={userStatus}
          onSetStatus={setUserStatus}
          onToggleMute={() => voice.setIsMuted(!voice.isMuted)}
          onToggleDeafen={() => voice.setIsDeafened(!voice.isDeafened)}
          onLogout={logout}
          onUserUpdate={updateUser}
          compact={desktopChannelMinimized}
        />
      </div>

      {/* Main column */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
      {/* Mobile top bar */}
      <div className="lg:hidden flex items-center gap-2 px-3 h-12 border-b border-white/5 bg-app-dark flex-shrink-0">
        <button
          type="button"
          onClick={() => setChannelNavOpen(true)}
          className="p-2 rounded-md text-app-muted hover:text-app-text hover:bg-app-hover/60"
          aria-label="Open channels and DMs"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
          </svg>
        </button>
        <span className="flex-1 min-w-0 truncate text-sm font-semibold text-app-text font-display">
          {mobileTitle}
        </span>
        {!showCommunity && !showFriends && !showOnboarding && (
          <button
            type="button"
            onClick={() => setMembersOpen(true)}
            className="p-2 rounded-md text-app-muted hover:text-app-text hover:bg-app-hover/60 xl:hidden"
            aria-label="Open members"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
            </svg>
          </button>
        )}
      </div>

      {/* Main content */}
      <div ref={mainContentRef} className="flex-1 min-w-0 min-h-0 flex">
      {showFriends && !currentDMId ? (
        <FriendsPage
          onClose={() => {
            setShowFriends(false)
            if (currentServerId) {
              try {
                localStorage.setItem('nepsis_last_view', JSON.stringify({ view: 'server' }))
              } catch { /* ignore */ }
            }
          }}
          onOpenDM={async (userId, username) => {
            const dmId = await handleOpenDM(userId, username)
            if (dmId) {
              try {
                localStorage.setItem('nepsis_last_view', JSON.stringify({ view: 'friends', dmId }))
              } catch { /* ignore */ }
            }
          }}
          stayOnFriendsWhenOpeningDM
        />
      ) : currentDMId ? (
        (() => {
          const conv = visibleDmConversations.find((c) => c.id === currentDMId) || dmConversations.find((c) => c.id === currentDMId)
          const dmMsgs = dmMessages[currentDMId] || []
          if (!conv || (!conv.is_group && !conv.other_user)) return null
          return (
            <DMView
              conversation={conv}
              messages={dmMsgs}
              currentUserId={user.id}
              currentUserAvatarUrl={user.avatar_url}
              onSendMessage={(content, options) => sendDMMessage(currentDMId, content, options)}
              onToggleReaction={toggleDMReaction}
              onClose={() => {
                setCurrentDM(null)
                try {
                  localStorage.setItem(
                    'nepsis_last_view',
                    JSON.stringify({ view: showFriends ? 'friends' : 'server' })
                  )
                } catch { /* ignore */ }
              }}
              onBlockUser={handleBlockUser}
              onReportUser={handleReportUser}
              onAddPeople={
                conv.is_group && conv.participants.length < 10
                  ? () => setGroupDMModal({ mode: 'add', conversationId: conv.id })
                  : undefined
              }
            />
          )
        })()
      ) : showOnboarding ? (
        <OnboardingPage onExplore={openCommunityView} />
      ) : showCommunity ? (
        <CommunityPage
          onJoinServer={(serverId) => {
            setShowCommunity(false)
            setShowFriends(false)
            try {
              localStorage.setItem('nepsis_last_view', JSON.stringify({ view: 'server' }))
            } catch { /* ignore */ }
            if (serverId) setCurrentServer(serverId)
          }}
          onClose={
            servers.length > 0
              ? () => {
                  setShowCommunity(false)
                  try {
                    localStorage.setItem('nepsis_last_view', JSON.stringify({ view: 'server' }))
                  } catch { /* ignore */ }
                }
              : undefined
          }
        />
      ) : currentChannel && (currentChannel.type === 'text' || currentChannel.type === 'rules') ? (
        <ChatView
          channel={{ id: currentChannel.id, name: currentChannel.name, type: currentChannel.type, serverId: currentChannel.server_id, order: currentChannel.order }}
          members={serverMembers.map((m) => ({ id: m.userId, username: m.username, avatarUrl: m.avatarUrl }))}
          serverEmojis={serverEmojis}
          messages={channelMessages.map((m) => ({
            id: m.id,
            channelId: m.channel_id,
            userId: m.user_id,
            content: m.content,
            createdAt: m.created_at,
            editedAt: m.edited_at,
            username: m.username,
            replyToId: m.reply_to_id,
            replyTo: m.reply_to,
            attachments: m.attachments,
            reactions: m.reactions?.map((r: { user_id: string; emoji: string }) => ({ userId: r.user_id, emoji: r.emoji })),
          }))}
          users={[{ id: user.id, username: currentDisplayName, status: 'online' as const }]}
          onSendMessage={(content, options) => sendMessage(currentChannel.id, content, options)}
          currentUserId={user.id}
          isAdminOrOwner={isAdminOrOwner}
          canSendMessages={currentChannel.type === 'text' || (currentChannel.type === 'rules' && isAdminOrOwner)}
          onAfterReaction={currentChannel.type === 'rules' ? refreshRulesAccepted : undefined}
        />
      ) : currentChannel && currentChannel.type === 'voice' ? (
        <VoiceView
          channel={{ id: currentChannel.id, name: currentChannel.name, type: currentChannel.type, serverId: currentChannel.server_id, order: currentChannel.order }}
          currentUserId={user.id}
          currentUsername={currentDisplayName}
          currentUserAvatarUrl={user.avatar_url}
          voiceUsersInChannel={voiceUsers[currentChannel.id] || []}
          onInvitePeople={handleInvitePeople}
          isAdminOrOwner={isAdminOrOwner}
          serverId={currentServerId ?? undefined}
          onMuteMember={handleMuteInVoice}
          onUnmuteMember={handleUnmuteInVoice}
          onDeafenMember={handleDeafenInVoice}
          onUndeafenMember={handleUndeafenInVoice}
          onDisconnectMember={handleDisconnectFromVoice}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-app-muted">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" className="mb-3 opacity-40">
            <path d="M5.88657 21C5.57547 21 5.3399 20.7189 5.39427 20.4126L6.00001 17H2.59511C2.28449 17 2.04905 16.7198 2.10259 16.4138L2.27759 15.4138C2.31946 15.1746 2.52722 15 2.77011 15H6.35001L7.41001 9H4.00511C3.69449 9 3.45905 8.71977 3.51259 8.41381L3.68759 7.41381C3.72946 7.17456 3.93722 7 4.18011 7H7.76001L8.39677 3.41262C8.43914 3.17391 8.64664 3 8.88907 3H9.87344C10.1845 3 10.4201 3.28107 10.3657 3.58738L9.76001 7H15.76L16.3968 3.41262C16.4391 3.17391 16.6466 3 16.8891 3H17.8734C18.1845 3 18.4201 3.28107 18.3657 3.58738L17.76 7H21.1649C21.4755 7 21.711 7.28023 21.6574 7.58619L21.4824 8.58619C21.4406 8.82544 21.2328 9 20.9899 9H17.41L16.35 15H19.7549C20.0655 15 20.301 15.2802 20.2474 15.5862L20.0724 16.5862C20.0306 16.8254 19.8228 17 19.5799 17H16L15.3632 20.5874C15.3209 20.8261 15.1134 21 14.8709 21H13.8866C13.5755 21 13.3399 20.7189 13.3943 20.4126L14 17H8.00001L7.36325 20.5874C7.32088 20.8261 7.11337 21 6.87094 21H5.88657ZM9.41001 9L8.35001 15H14.35L15.41 9H9.41001Z"/>
          </svg>
          <h3 className="text-lg font-semibold text-app-text mb-1">No Channel Selected</h3>
          <p className="text-sm">Select a text or voice channel to get started</p>
        </div>
      )}
      </div>
      </div>

      {/* Mobile members backdrop */}
      {membersOpen && !showCommunity && !showFriends && !showOnboarding && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/50 xl:hidden"
          aria-label="Close members"
          onClick={() => setMembersOpen(false)}
        />
      )}

      {/* Hide members while a DM is open (Discord-like); server channels stay in the left rail */}
      {!showCommunity && !showFriends && !showOnboarding && !currentDMId && (
      <div
        className={`fixed xl:relative z-40 inset-y-0 right-0 h-full min-h-0 self-stretch flex flex-col flex-shrink-0 transition-transform duration-200 ease-out ${
          membersOpen ? 'translate-x-0' : 'translate-x-full xl:translate-x-0'
        }`}
      >
      <MembersSidebar
        members={serverMembers}
        currentUserId={user.id}
        currentUserAvatarUrl={user.avatar_url}
        currentUserRole={currentUserRole}
        serverId={currentServerId}
        voiceChannels={displayChannels.filter((c) => c.type === 'voice').map((c) => ({
          id: c.id,
          name: c.name,
          type: 'voice' as const,
          serverId: c.server_id,
          order: c.order,
          categoryId: c.category_id,
        }))}
        onKick={handleKick}
        onBan={handleBan}
        onMessage={async (userId, username) => {
          try {
            await handleOpenDM(userId, username)
          } catch (e) {
            showNotification((e as Error).message, 'error')
          }
        }}
        onCall={(targetUserId, targetUsername, targetAvatarUrl) => {
          call.initiateCall(targetUserId, targetUsername, targetAvatarUrl)
        }}
        onAddFriend={async (userId, username) => {
          try {
            // From a server member card: add their Personal identity from your default profile
            await api.sendFriendRequest(user.id, userId, 'personal', 'personal')
            showNotification(`Friend request sent to ${username}`)
          } catch (e) {
            showNotification((e as Error).message, 'error')
          }
        }}
        onMoveToChannel={async (targetUserId, channelId) => {
          if (!currentServerId) return
          try {
            await api.moveMemberToVoiceChannel(currentServerId, targetUserId, channelId, user.id)
            showNotification('User moved to voice channel')
            const updated = await api.getServerMembers(currentServerId)
            setServerMembers(withLiveSelfPresence(updated))
          } catch (e) {
            showNotification((e as Error).message, 'error')
          }
        }}
        remoteVoiceStates={voice.remoteVoiceStates}
        onMuteInVoice={handleMuteInVoice}
        onUnmuteInVoice={handleUnmuteInVoice}
        onDeafenInVoice={handleDeafenInVoice}
        onUndeafenInVoice={handleUndeafenInVoice}
        onDisconnectFromVoice={handleDisconnectFromVoice}
      />
      </div>
      )}

      {groupDMModal && (
        <GroupDMModal
          userId={user.id}
          mode={groupDMModal.mode}
          excludedUserIds={
            groupDMModal.conversationId
              ? dmConversations.find((entry) => entry.id === groupDMModal.conversationId)?.participants.map((participant) => participant.id) || []
              : []
          }
          onClose={() => setGroupDMModal(null)}
          onConfirm={async (memberIds, name) => {
            if (groupDMModal.mode === 'create') {
              const id = await createGroupDM(memberIds, name)
              if (id) {
                setShowCommunity(false)
                setShowFriends(true)
                setChannelNavOpen(false)
              }
            } else if (groupDMModal.conversationId) {
              await addGroupDMMembers(groupDMModal.conversationId, memberIds)
              showNotification('People added to group message')
            }
          }}
        />
      )}

      {/* DM Call overlay */}
      <CallOverlay />

      {/* Voice cameras while browsing text / DMs / friends */}
      <VoiceFloatingOverlay
        visible={!showingVoiceView}
        currentUserId={user.id}
        currentUsername={(user.display_name && user.display_name.trim()) || user.username}
        currentUserAvatarUrl={user.avatar_url}
        avatarByUserId={voicePipAvatars}
        onReturnToVoice={() => {
          if (!voice.voiceChannelId) return
          setShowFriends(false)
          setShowCommunity(false)
          setShowOnboarding(false)
          setCurrentDM(null)
          setCurrentChannel(voice.voiceChannelId)
          setChannelNavOpen(false)
          try {
            localStorage.setItem('nepsis_last_view', JSON.stringify({ view: 'server' }))
          } catch {
            /* ignore */
          }
        }}
      />

      {/* Notification toast */}
      {notification && (
        <div
          className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg text-sm font-medium z-50 ${
            notification.type === 'error' ? 'bg-red-600/90 text-white' : 'bg-app-accent text-white'
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Server Settings Modal — use settingsServer snapshot so a brief servers reload cannot unmount it */}
      {showServerSettings && settingsServer && (
        <ServerSettingsModal
          serverName={settingsServer.name}
          serverId={settingsServer.id}
          userId={user.id}
          canManageEmojis={isAdminOrOwner}
          canManageMembers={isAdminOrOwner}
          canManageRules={isAdminOrOwner}
          rulesChannelId={settingsServer?.rules_channel_id}
          lockChannelsUntilRulesAccepted={!!settingsServer?.lock_channels_until_rules_accepted}
          rulesAcceptEmoji={settingsServer?.rules_accept_emoji ?? '👍'}
          onClose={() => setShowServerSettings(false)}
          onUpdateServer={(data) => updateServer(settingsServer.id, data)}
          serverIconUrl={settingsServer.icon_url}
          serverBannerUrl={settingsServer.banner_url}
          onDeleteServer={() => deleteServer(settingsServer.id)}
          onKickMember={handleKick}
          onBanMember={handleBan}
          onMembersChange={async () => {
            if (currentServerId) {
              try {
                const updated = await api.getServerMembers(currentServerId)
                setServerMembers(withLiveSelfPresence(updated))
              } catch (err) {
                console.warn('Members refresh after settings change failed', err)
              }
            }
          }}
        />
      )}
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <DownloadBanner />
        <EmailConfirmBanner />
        <Routes>
          <Route path="/" element={<AppContent />} />
          <Route path="/invite/:code" element={<InvitePage />} />
          <Route path="/download" element={<DownloadPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppProvider>
    </ErrorBoundary>
  )
}
