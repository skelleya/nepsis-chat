import type { Channel } from '../types'

interface ChannelListProps {
  channels: Channel[]
  currentChannelId: string | null
  onSelectChannel: (channel: Channel) => void
  serverName?: string
}

export function ChannelList({ channels, currentChannelId, onSelectChannel, serverName }: ChannelListProps) {
  const textChannels = channels.filter((c) => c.type === 'text')
  const voiceChannels = channels.filter((c) => c.type === 'voice')

  return (
    <div className="w-60 bg-app-channel flex flex-col">
      <div className="h-12 px-4 flex items-center gap-2 border-b border-app-dark text-app-text font-semibold shadow-sm">
        <img src="/logo.png" alt="Nepsis" className="h-6 w-6 object-contain flex-shrink-0" />
        {serverName ?? (channels[0]?.serverId === '1' ? 'Nepsis Chat' : 'Gaming Hub')}
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-2">
          <div className="px-2 py-1 text-xs font-semibold text-app-muted uppercase tracking-wider">
            Text Channels
          </div>
          {textChannels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => onSelectChannel(channel)}
              className={`w-full px-2 py-1.5 rounded flex items-center gap-2 text-left text-sm ${
                currentChannelId === channel.id
                  ? 'bg-app-hover text-white'
                  : 'text-app-muted hover:bg-app-hover hover:text-app-text'
              }`}
            >
              <span className="text-lg">#</span>
              {channel.name}
            </button>
          ))}
        </div>
        <div className="px-2 mt-4">
          <div className="px-2 py-1 text-xs font-semibold text-app-muted uppercase tracking-wider">
            Voice Channels
          </div>
          {voiceChannels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => onSelectChannel(channel)}
              className={`w-full px-2 py-1.5 rounded flex items-center gap-2 text-left text-sm ${
                currentChannelId === channel.id
                  ? 'bg-app-hover text-white'
                  : 'text-app-muted hover:bg-app-hover hover:text-app-text'
              }`}
            >
              <span className="text-lg">🔊</span>
              {channel.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
