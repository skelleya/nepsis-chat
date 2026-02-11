import { useState, useEffect, useCallback } from 'react'
import * as api from './services/api'
import { AppProvider, useApp } from './contexts/AppContext'
import { VoiceProvider, useVoice } from './contexts/VoiceContext'
import { ServerBar } from './components/ServerBar'
import { ChannelList } from './components/ChannelList'
import { ChatView } from './components/ChatView'
import { VoiceView } from './components/VoiceView'
import { MembersSidebar, type ServerMember } from './components/MembersSidebar'
import { LoginPage } from './components/LoginPage'
import { UpdateButton } from './components/UpdateButton'
import { DownloadBanner } from './components/DownloadBanner'
import { UserPanel } from './components/UserPanel'
import { ServerSettingsModal } from './components/ServerSettingsModal'
import { mockChannels } from './data/mockData'
import { Routes, Route, Navigate } from 'react-router-dom'
import { DownloadPage } from './pages/DownloadPage'

function AppContent() {
  const {
    user,
    servers,
    channels,
    categories,
    messages,
    currentServerId,
    currentChannelId,
    setCurrentServer,
    setCurrentChannel,
    sendMessage,
    createServer,
    updateServer,
    deleteServer,
    createChannel,
    createCategory,
    reorderChannels,
    logout,
  } = useApp()

  if (!user) return <LoginPage />

  return (
    <VoiceProvider userId={user.id} username={user.username}>
      <MainLayout
        user={user}
        servers={servers}
        channels={channels}
        categories={categories}
        messages={messages}
        currentServerId={currentServerId}
        currentChannelId={currentChannelId}
        setCurrentServer={setCurrentServer}
        setCurrentChannel={setCurrentChannel}
        sendMessage={sendMessage}
        createServer={createServer}
        updateServer={updateServer}
        deleteServer={deleteServer}
        createChannel={createChannel}
        createCategory={createCategory}
        reorderChannels={reorderChannels}
        logout={logout}
      />
    </VoiceProvider>
  )
}

interface MainLayoutProps {
  user: { id: string; username: string; avatar_url?: string; banner_url?: string; is_guest?: boolean }
  servers: { id: string; name: string; icon_url?: string; owner_id: string }[]
  channels: { id: string; server_id: string; name: string; type: 'text' | 'voice'; order: number; category_id?: string | null }[]
  categories: { id: string; server_id: string; name: string; order: number }[]
  messages: Record<string, { id: string; channel_id: string; user_id: string; content: string; created_at: string; edited_at?: string; username?: string; reply_to_id?: string; reply_to?: { username?: string; content?: string }; attachments?: { url: string; type: string; filename?: string }[]; reactions?: { user_id: string; emoji: string }[] }[]>
  currentServerId: string | null
  currentChannelId: string | null
  setCurrentServer: (id: string) => void
  setCurrentChannel: (id: string) => void
  sendMessage: (channelId: string, content: string, options?: { replyToId?: string; attachments?: { url: string; type: string; filename?: string }[] }) => Promise<void>
  createServer: (name: string) => Promise<unknown>
  updateServer: (serverId: string, data: { name?: string }) => Promise<void>
  deleteServer: (serverId: string) => Promise<void>
  createChannel: (name: string, type: 'text' | 'voice', categoryId?: string) => Promise<unknown>
  createCategory: (name: string) => Promise<unknown>
  reorderChannels: (updates: { id: string; order: number }[]) => Promise<void>
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
  setCurrentServer,
  setCurrentChannel,
  sendMessage,
  createServer,
  updateServer,
  deleteServer,
  createChannel,
  createCategory,
  reorderChannels,
  logout,
}: MainLayoutProps) {
  const voice = useVoice()
  const [showServerSettings, setShowServerSettings] = useState(false)
  const [serverMembers, setServerMembers] = useState<ServerMember[]>([])
  const [serverEmojis, setServerEmojis] = useState<{ id: string; name: string; image_url: string }[]>([])
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  const { userStatus, setUserStatus, updateUser } = useApp()
  const currentUserRole = serverMembers.find((m) => m.userId === user.id)?.role ?? 'member'

  useEffect(() => {
    if (!currentServerId) return
    api.getServerEmojis(currentServerId).then(setServerEmojis).catch(() => setServerEmojis([]))
  }, [currentServerId])

  useEffect(() => {
    if (!currentServerId || !user) {
      setServerMembers([])
      return
    }
    const load = async () => {
      try {
        const members = await api.getServerMembers(currentServerId)
        const isMember = members.some((m: ServerMember) => m.userId === user.id)
        if (!isMember) {
          await api.joinServer(currentServerId, user.id)
          const updated = await api.getServerMembers(currentServerId)
          setServerMembers(updated)
        } else {
          setServerMembers(members)
        }
      } catch {
        setServerMembers([])
      }
    }
    load()
    // Poll members every 8s to keep voice channel presence (who's in which channel) up to date
    const interval = setInterval(load, 8000)
    return () => clearInterval(interval)
  }, [currentServerId, user?.id])

  // Update presence (online / in-voice / away / dnd) — in-voice overrides when in voice
  const { userStatus } = useApp()
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

  // Handle channel selection - one-click join for voice
  const handleSelectChannel = useCallback((channel: { id: string; name: string; type: string }) => {
    setCurrentChannel(channel.id)
    // Auto-join voice channels on click (one-click join like Discord)
    if (channel.type === 'voice') {
      voice.joinVoice(channel.id, channel.name)
    }
  }, [setCurrentChannel, voice])

  // Build voice users map from ALL server members' presence — so users see who's in
  // each voice channel BEFORE entering (not just when they're already in one).
  const voiceUsers: Record<string, { userId: string; username: string; isMuted?: boolean; isDeafened?: boolean }[]> = {}
  if (currentServerId && displayChannels.length > 0) {
    for (const member of serverMembers) {
      const chId = member.voiceChannelId
      if (!chId) continue
      const ch = displayChannels.find((c) => c.id === chId && c.server_id === currentServerId)
      if (!ch || ch.type !== 'voice') continue
      if (!voiceUsers[chId]) voiceUsers[chId] = []
      const isCurrentUser = member.userId === user.id
      voiceUsers[chId].push({
        userId: member.userId,
        username: member.username,
        isMuted: isCurrentUser ? voice.isMuted : undefined,
        isDeafened: isCurrentUser ? voice.isDeafened : undefined,
      })
    }
    // When current user is in voice, merge real-time participants (for accurate mute state)
    if (voice.voiceChannelId && voiceUsers[voice.voiceChannelId]) {
      const inList = new Set(voiceUsers[voice.voiceChannelId].map((u) => u.userId))
      for (const p of voice.participants) {
        if (!inList.has(p.userId)) {
          voiceUsers[voice.voiceChannelId].push({ userId: p.userId, username: p.username, isMuted: false })
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
        servers={servers.map((s) => ({ id: s.id, name: s.name, iconUrl: s.icon_url, ownerId: s.owner_id }))}
        currentServerId={currentServerId}
        onSelectServer={setCurrentServer}
        onCreateServer={async (name) => { await createServer(name) }}
        canCreateServer={!user?.is_guest}
      />

      {/* Channel list + User panel wrapper */}
      <div className="w-60 bg-app-channel flex flex-col flex-shrink-0">
        <ChannelList
          channels={displayChannels.map((c) => ({ id: c.id, name: c.name, type: c.type as 'text' | 'voice', serverId: c.server_id, order: c.order, categoryId: c.category_id }))}
          categories={categories.map((cat) => ({ id: cat.id, name: cat.name, serverId: cat.server_id, order: cat.order }))}
          currentChannelId={currentChannelId}
          onSelectChannel={(ch) => handleSelectChannel(ch)}
          serverName={currentServer?.name}
          onCreateChannel={async (name, type, catId) => { await createChannel(name, type, catId) }}
          onCreateCategory={async (name) => { await createCategory(name) }}
          onReorderChannels={async (updates) => { await reorderChannels(updates) }}
          voiceConnection={voiceConnection}
          voiceUsers={voiceUsers}
          onOpenServerSettings={() => setShowServerSettings(true)}
          serverId={currentServerId ?? undefined}
          isOwner={currentServer?.owner_id === user.id}
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
      {currentChannel && currentChannel.type === 'text' ? (
        <ChatView
          channel={{ id: currentChannel.id, name: currentChannel.name, type: currentChannel.type, serverId: currentChannel.server_id, order: currentChannel.order }}
          members={serverMembers.map((m) => ({ id: m.userId, username: m.username }))}
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
        />
      ) : currentChannel && currentChannel.type === 'voice' ? (
        <VoiceView
          channel={{ id: currentChannel.id, name: currentChannel.name, type: currentChannel.type, serverId: currentChannel.server_id, order: currentChannel.order }}
          currentUserId={user.id}
          currentUsername={user.username}
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

      <MembersSidebar
        members={serverMembers}
        currentUserId={user.id}
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
            await api.createOrGetDMConversation(user.id, userId)
            showNotification(`DM with ${username} ready. Full DM UI coming soon.`)
          } catch (e) {
            showNotification((e as Error).message, 'error')
          }
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
          onClose={() => setShowServerSettings(false)}
          onUpdateServer={(data) => updateServer(currentServer.id, data)}
          onDeleteServer={() => deleteServer(currentServer.id)}
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
        <Route path="/download" element={<DownloadPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppProvider>
  )
}
