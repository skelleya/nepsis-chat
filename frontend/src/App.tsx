import { useState, useEffect, useCallback, useRef } from 'react'
import * as api from './services/api'
import { subscribeToServerMembers, unsubscribe } from './services/realtime'
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
import { LoginPage } from './components/LoginPage'
import { UpdateButton } from './components/UpdateButton'
import { DownloadBanner } from './components/DownloadBanner'
import { UserPanel } from './components/UserPanel'
import { ServerSettingsModal } from './components/ServerSettingsModal'
import { mockChannels } from './data/mockData'
import { Routes, Route, Navigate } from 'react-router-dom'
import { DownloadPage } from './pages/DownloadPage'
import { InvitePage } from './pages/InvitePage'
import { CommunityPage } from './pages/CommunityPage'
import { FriendsPage } from './pages/FriendsPage'
import { OnboardingPage, ONBOARDING_COMPLETED_KEY } from './pages/OnboardingPage'

function AppContent() {
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
    openDM,
    sendDMMessage,
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

  if (!user) return <LoginPage />

  return (
    <VoiceProvider userId={user.id} username={user.username}>
      <CallProvider userId={user.id} username={user.username}>
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
        openDM={openDM}
        sendDMMessage={sendDMMessage}
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
  )
}

interface MainLayoutProps {
  user: { id: string; username: string; avatar_url?: string; banner_url?: string; is_guest?: boolean }
  servers: { id: string; name: string; icon_url?: string; banner_url?: string; owner_id: string; rules_channel_id?: string | null; lock_channels_until_rules_accepted?: boolean; rules_accept_emoji?: string }[]
  channels: { id: string; server_id: string; name: string; type: 'text' | 'voice'; order: number; category_id?: string | null }[]
  categories: { id: string; server_id: string; name: string; order: number }[]
  messages: Record<string, { id: string; channel_id: string; user_id: string; content: string; created_at: string; edited_at?: string; username?: string; reply_to_id?: string; reply_to?: { username?: string; content?: string }; attachments?: { url: string; type: string; filename?: string }[]; reactions?: { user_id: string; emoji: string }[] }[]>
  currentServerId: string | null
  currentChannelId: string | null
  dmConversations: { id: string; created_at: string; other_user: { id: string; username: string; avatar_url?: string } }[]
  dmMessages: Record<string, { id: string; conversation_id: string; user_id: string; content: string; created_at: string; username: string }[]>
  currentDMId: string | null
  setCurrentDM: (id: string | null) => void
  dmUnreadCounts: Record<string, number>
  channelUnreadCounts: Record<string, number>
  openDM: (targetUserId: string, targetUsername: string) => Promise<string | undefined>
  sendDMMessage: (conversationId: string, content: string) => Promise<void>
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
  openDM,
  sendDMMessage,
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
  const [showServerSettings, setShowServerSettings] = useState(false)
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
        } else if (v.view === 'dm' && v.dmId) {
          setShowCommunity(false)
          setShowFriends(false)
          setCurrentDM(v.dmId)
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
  const currentUserRole = serverMembers.find((m) => m.userId === user.id)?.role ?? 'member'

  useEffect(() => {
    if (!currentServerId) return
    api.getServerEmojis(currentServerId).then(setServerEmojis).catch(() => setServerEmojis([]))
  }, [currentServerId])

  // Track if a full refresh is already in progress to avoid duplicate fetches
  const membersRefreshRef = useRef(false)

  useEffect(() => {
    if (!currentServerId || !user) {
      setServerMembers([])
      return
    }

    const load = async () => {
      if (membersRefreshRef.current) return
      membersRefreshRef.current = true
      try {
        const members = await api.getServerMembers(currentServerId)
        const isMember = members.some((m: ServerMember) => m.userId === user.id)
        if (!isMember) {
          setServerMembers([])
          return
        }
        setServerMembers(members)
      } catch {
        setServerMembers([])
      } finally {
        membersRefreshRef.current = false
      }
    }

    // Initial fetch
    load()

    // Subscribe to realtime changes on server_members for INSTANT join/leave updates
    const channel = subscribeToServerMembers(currentServerId, (_payload) => {
      // Any member change (join/leave/role update) → refetch full member list
      // (includes presence, voice state, avatar, etc. that realtime payload doesn't carry)
      load()
    })

    // Light fallback poll for presence/voice status changes (not in realtime publication).
    // Faster when in voice so sidebar voice indicators stay responsive.
    const ms = voice.voiceChannelId ? 2000 : 15000
    const interval = setInterval(load, ms)

    return () => {
      clearInterval(interval)
      unsubscribe(channel)
    }
  }, [currentServerId, user?.id, user?.avatar_url, voice.voiceChannelId])

  // Update presence (online / in-voice / away / dnd) — in-voice overrides when in voice
  useEffect(() => {
    if (!user) return
    const status = voice.voiceChannelId ? 'in-voice' : userStatus
    api.updatePresence(user.id, status, voice.voiceChannelId ?? null).catch(() => {})
  }, [user?.id, voice.voiceChannelId, userStatus])

  const handleKick = useCallback(
    async (targetUserId: string) => {
      if (!currentServerId) return
      await api.kickMember(currentServerId, targetUserId, user.id)
      setServerMembers((prev) => prev.filter((m) => m.userId !== targetUserId))
    },
    [currentServerId, user.id]
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
  const currentServer = servers.find((s) => s.id === currentServerId)

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

  // Handle channel selection - one-click join for voice; respect rules lock
  const handleSelectChannel = useCallback((channel: { id: string; name: string; type: string }) => {
    if (mustAcceptRules && rulesAcceptanceKnown && !hasAcceptedRules && channel.type !== 'rules' && channel.id !== rulesChannelId) {
      setCurrentChannel(rulesChannelId)
      showNotification('Accept the rules first to access other channels')
      return
    }
    setCurrentChannel(channel.id)
    if (channel.type === 'voice') {
      voice.joinVoice(channel.id, channel.name)
    }
  }, [setCurrentChannel, voice, mustAcceptRules, rulesAcceptanceKnown, hasAcceptedRules, rulesChannelId])

  // Build voice users map from ALL server members' presence — so users see who's in
  // each voice channel BEFORE entering (not just when they're already in one).
  const voiceUsers: Record<string, { userId: string; username: string; avatar_url?: string; isMuted?: boolean; isDeafened?: boolean; isSpeaking?: boolean }[]> = {}
  if (currentServerId && displayChannels.length > 0) {
    for (const member of serverMembers) {
      // Skip the current user from serverMembers — we'll add them from live voice state below
      if (member.userId === user.id) continue
      const chId = member.voiceChannelId
      if (!chId) continue
      const ch = displayChannels.find((c) => c.id === chId && c.server_id === currentServerId)
      if (!ch || ch.type !== 'voice') continue
      if (!voiceUsers[chId]) voiceUsers[chId] = []
      voiceUsers[chId].push({
        userId: member.userId,
        username: member.username,
        avatar_url: member.avatarUrl,
      })
    }
    // Add current user from LIVE voice state (instant, no API round-trip)
    if (voice.voiceChannelId) {
      const chInServer = displayChannels.find((c) => c.id === voice.voiceChannelId && c.server_id === currentServerId)
      if (chInServer) {
        if (!voiceUsers[voice.voiceChannelId]) voiceUsers[voice.voiceChannelId] = []
        // Add current user at the top
        voiceUsers[voice.voiceChannelId].unshift({
          userId: user.id,
          username: user.username,
          avatar_url: user.avatar_url,
          isMuted: voice.isMuted,
          isDeafened: voice.isDeafened,
          isSpeaking: voice.isSpeaking,
        })
        // Merge real-time participants (remote peers) — use avatar from serverMembers if available
        const memberByUserId = new Map(serverMembers.map((m) => [m.userId, m]))
        const inList = new Set(voiceUsers[voice.voiceChannelId].map((u) => u.userId))
        for (const p of voice.participants) {
          if (!inList.has(p.userId)) {
            const m = memberByUserId.get(p.userId)
            voiceUsers[voice.voiceChannelId].push({
              userId: p.userId,
              username: p.username,
              avatar_url: m?.avatarUrl,
              isMuted: false,
              isSpeaking: p.isSpeaking,
            })
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
    onToggleMute: () => voice.setIsMuted(!voice.isMuted),
    onToggleDeafen: () => voice.setIsDeafened(!voice.isDeafened),
    onToggleCamera: () => voice.toggleCamera(),
    onToggleScreenShare: () => voice.toggleScreenShare(),
    onDisconnect: () => voice.leaveVoice(),
  } : null

  // Clear stale DM selection when conversation not found (e.g. after API failure or tables missing)
  useEffect(() => {
    if (!currentDMId) return
    const conv = dmConversations.find((c) => c.id === currentDMId)
    if (!conv?.other_user) setCurrentDM(null)
  }, [currentDMId, dmConversations, setCurrentDM])

  // ESC key to close server settings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showServerSettings) {
        setShowServerSettings(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showServerSettings])

  return (
    <div className="h-screen flex bg-app-darker overflow-x-hidden">
      <ServerBar
        servers={servers.map((s) => ({ id: s.id, name: s.name, iconUrl: s.icon_url, bannerUrl: s.banner_url, ownerId: s.owner_id }))}
        currentServerId={currentServerId}
        onSelectServer={(id) => {
          setShowCommunity(false)
          setShowFriends(false)
          setCurrentServer(id)
          try {
            localStorage.setItem('nepsis_last_view', JSON.stringify({ view: 'server' }))
          } catch { /* ignore */ }
        }}
        onCreateServer={async (name) => { await createServer(name) }}
        onReorderServers={reorderServers}
        canCreateServer={!user?.is_guest}
        onOpenCommunity={openCommunityView}
        onOpenFriends={() => {
          setShowCommunity(false)
          setShowFriends(true)
          try {
            localStorage.setItem('nepsis_last_view', JSON.stringify({ view: 'friends' }))
          } catch { /* ignore */ }
        }}
      />

      {/* Channel list + User panel wrapper */}
      <div className="w-60 bg-app-channel flex flex-col flex-shrink-0">
        <ChannelList
          channels={displayChannels.map((c) => ({ id: c.id, name: c.name, type: c.type as 'text' | 'voice' | 'rules', serverId: c.server_id, order: c.order, categoryId: c.category_id }))}
          categories={categories.map((cat) => ({ id: cat.id, name: cat.name, serverId: cat.server_id, order: cat.order }))}
          currentChannelId={currentChannelId}
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
              setServerMembers(updated)
            } catch (e) {
              showNotification((e as Error).message, 'error')
            }
          }}
          voiceConnection={voiceConnection}
          voiceUsers={voiceUsers}
          onOpenServerSettings={() => setShowServerSettings(true)}
          onInvitePeople={handleInvitePeople}
          onOpenCommunity={openCommunityView}
          serverId={currentServerId ?? undefined}
          isOwner={currentServer?.owner_id === user.id}
          isAdminOrOwner={currentUserRole === 'owner' || currentUserRole === 'admin'}
          hasNoServers={servers.length === 0}
          dmConversations={dmConversations}
          currentDMId={currentDMId}
          dmUnreadCounts={dmUnreadCounts}
          channelUnreadCounts={channelUnreadCounts}
          onSelectDM={(id) => {
            setCurrentDM(id)
            setShowCommunity(false)
            setShowFriends(false)
            try {
              localStorage.setItem('nepsis_last_view', JSON.stringify({ view: 'dm', dmId: id }))
            } catch { /* ignore */ }
          }}
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
        />
      </div>

      {/* Main content */}
      {showFriends ? (
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
            const dmId = await openDM(userId, username)
            setShowFriends(false)
            if (dmId) {
              try {
                localStorage.setItem('nepsis_last_view', JSON.stringify({ view: 'dm', dmId }))
              } catch { /* ignore */ }
            }
          }}
        />
      ) : currentDMId ? (
        (() => {
          const conv = dmConversations.find((c) => c.id === currentDMId)
          const dmMsgs = dmMessages[currentDMId] || []
          if (!conv?.other_user) return null
          return (
            <DMView
              conversation={conv}
              messages={dmMsgs}
              currentUserId={user.id}
              currentUserAvatarUrl={user.avatar_url}
              onSendMessage={(content) => sendDMMessage(currentDMId, content)}
              onClose={() => {
                setCurrentDM(null)
                try {
                  localStorage.setItem('nepsis_last_view', JSON.stringify({ view: 'friends' }))
                } catch { /* ignore */ }
              }}
              onBlockUser={() => showNotification('Block feature coming soon')}
              onReportUser={() => showNotification('Report feature coming soon')}
            />
          )
        })()
      ) : showOnboarding ? (
        <OnboardingPage onExplore={openCommunityView} />
      ) : showCommunity ? (
        <CommunityPage
          onJoinServer={() => {
            setShowCommunity(false)
            setShowFriends(false)
            if (currentServerId) {
              try {
                localStorage.setItem('nepsis_last_view', JSON.stringify({ view: 'server' }))
              } catch { /* ignore */ }
            }
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
          users={[{ id: user.id, username: user.username, status: 'online' as const }]}
          onSendMessage={(content, options) => sendMessage(currentChannel.id, content, options)}
          currentUserId={user.id}
          isAdminOrOwner={currentUserRole === 'owner' || currentUserRole === 'admin'}
          canSendMessages={currentChannel.type === 'text' || (currentChannel.type === 'rules' && (currentUserRole === 'owner' || currentUserRole === 'admin'))}
          onAfterReaction={currentChannel.type === 'rules' ? refreshRulesAccepted : undefined}
        />
      ) : currentChannel && currentChannel.type === 'voice' ? (
        <VoiceView
          channel={{ id: currentChannel.id, name: currentChannel.name, type: currentChannel.type, serverId: currentChannel.server_id, order: currentChannel.order }}
          currentUserId={user.id}
          currentUsername={user.username}
          currentUserAvatarUrl={user.avatar_url}
          voiceUsersInChannel={voiceUsers[currentChannel.id] || []}
          onInvitePeople={handleInvitePeople}
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

      {!showCommunity && !showFriends && !showOnboarding && (
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
        onMessage={async (userId, username) => {
          try {
            await openDM(userId, username)
          } catch (e) {
            showNotification((e as Error).message, 'error')
          }
        }}
        onCall={(targetUserId, targetUsername, targetAvatarUrl) => {
          call.initiateCall(targetUserId, targetUsername, targetAvatarUrl)
        }}
        onAddFriend={async (userId, username) => {
          try {
            await api.sendFriendRequest(user.id, userId)
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
            setServerMembers(updated)
          } catch (e) {
            showNotification((e as Error).message, 'error')
          }
        }}
      />
      )}

      {/* DM Call overlay */}
      <CallOverlay />

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

      {/* Server Settings Modal */}
      {showServerSettings && currentServer && (
        <ServerSettingsModal
          serverName={currentServer.name}
          serverId={currentServer.id}
          userId={user.id}
          canManageEmojis={currentUserRole === 'owner' || currentUserRole === 'admin'}
          canManageMembers={currentUserRole === 'owner' || currentUserRole === 'admin'}
          canManageRules={currentUserRole === 'owner' || currentUserRole === 'admin'}
          rulesChannelId={currentServer?.rules_channel_id}
          lockChannelsUntilRulesAccepted={!!currentServer?.lock_channels_until_rules_accepted}
          rulesAcceptEmoji={currentServer?.rules_accept_emoji ?? '👍'}
          onClose={() => setShowServerSettings(false)}
          onUpdateServer={(data) => updateServer(currentServer.id, data)}
          serverIconUrl={currentServer.icon_url}
          serverBannerUrl={currentServer.banner_url}
          onDeleteServer={() => deleteServer(currentServer.id)}
          onKickMember={handleKick}
          onMembersChange={async () => {
            if (currentServerId) {
              const updated = await api.getServerMembers(currentServerId)
              setServerMembers(updated)
            }
          }}
        />
      )}
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <DownloadBanner />
      <UpdateButton />
      <Routes>
        <Route path="/" element={<AppContent />} />
        <Route path="/invite/:code" element={<InvitePage />} />
        <Route path="/download" element={<DownloadPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppProvider>
  )
}
