import { AppProvider, useApp } from './contexts/AppContext'
import { ServerBar } from './components/ServerBar'
import { ChannelList } from './components/ChannelList'
import { ChatView } from './components/ChatView'
import { VoiceView } from './components/VoiceView'
import { MembersSidebar } from './components/MembersSidebar'
import { LoginPage } from './components/LoginPage'
import { UpdateButton } from './components/UpdateButton'
import { mockChannels } from './data/mockData'
import { Routes, Route, Navigate } from 'react-router-dom'
import { DownloadPage } from './pages/DownloadPage'

function AppContent() {
  const { user, servers, channels, messages, currentServerId, currentChannelId, setCurrentServer, setCurrentChannel, sendMessage } = useApp()

  const displayChannels = channels.length > 0 ? channels : mockChannels.filter((c) => c.serverId === currentServerId).map((c) => ({
    id: c.id,
    server_id: c.serverId,
    name: c.name,
    type: c.type,
    order: c.order,
  }))

  const currentChannel = displayChannels.find((c) => c.id === currentChannelId)
  const channelMessages = currentChannelId ? (messages[currentChannelId] || []) : []

  if (!user) return <LoginPage />

  return (
    <div className="h-screen flex bg-app-darker">
      <ServerBar
        servers={servers.map((s) => ({ id: s.id, name: s.name, iconUrl: s.icon_url, ownerId: s.owner_id }))}
        currentServerId={currentServerId}
        onSelectServer={setCurrentServer}
      />
      <ChannelList
        channels={displayChannels.map((c) => ({ id: c.id, name: c.name, type: c.type, serverId: c.server_id, order: c.order }))}
        currentChannelId={currentChannelId}
        onSelectChannel={(ch) => setCurrentChannel(ch.id)}
        serverName={servers.find((s) => s.id === currentServerId)?.name}
      />
      {currentChannel && currentChannel.type === 'text' ? (
        <ChatView
          channel={{ id: currentChannel.id, name: currentChannel.name, type: currentChannel.type, serverId: currentChannel.server_id, order: currentChannel.order }}
          messages={channelMessages.map((m) => ({
            id: m.id,
            channelId: m.channel_id,
            userId: m.user_id,
            content: m.content,
            createdAt: m.created_at,
            username: m.username,
          }))}
          users={[{ id: user.id, username: user.username, status: 'online' }]}
          onSendMessage={(content) => sendMessage(currentChannel.id, content)}
        />
      ) : currentChannel && currentChannel.type === 'voice' ? (
        <VoiceView
          channel={{ id: currentChannel.id, name: currentChannel.name, type: currentChannel.type, serverId: currentChannel.server_id, order: currentChannel.order }}
          currentUserId={user.id}
          currentUsername={user.username}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-app-muted">
          Select a channel
        </div>
      )}
      <MembersSidebar users={[{ id: user.id, username: user.username, status: 'online' }]} />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <UpdateButton />
      <Routes>
        <Route path="/" element={<AppContent />} />
        <Route path="/download" element={<DownloadPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppProvider>
  )
}
