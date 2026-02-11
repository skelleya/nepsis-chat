import type { Channel } from '../types'
import { useVoiceChannel } from '../hooks/useVoiceChannel'
import { RemoteAudio } from './RemoteAudio'

interface VoiceViewProps {
  channel: Channel
  currentUserId: string
  currentUsername: string
}

export function VoiceView({ channel, currentUserId, currentUsername }: VoiceViewProps) {
  const {
    participants,
    localStream,
    isMuted,
    setIsMuted,
    isDeafened,
    setIsDeafened,
    join,
    leave,
    error,
  } = useVoiceChannel(channel.id, currentUserId, currentUsername)

  const isInVoice = !!localStream
  const allParticipants = isInVoice
    ? [
        { userId: currentUserId, username: currentUsername, stream: null, isSpeaking: !isMuted },
        ...participants,
      ]
    : participants

  return (
    <div className="flex-1 flex flex-col bg-app-darker">
      <div className="h-12 px-4 flex items-center border-b border-app-dark shadow-sm">
        <span className="text-xl text-app-muted">🔊</span>
        <span className="ml-2 font-semibold text-app-text">{channel.name}</span>
      </div>
      {error && (
        <div className="mx-4 mt-2 p-2 rounded bg-red-900/50 text-red-200 text-sm">{error}</div>
      )}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-app-muted text-sm mb-4">
          {allParticipants.length} in voice
        </div>
        <div className="space-y-3">
          {allParticipants.map((p) => (
            <div
              key={p.userId}
              className="flex items-center gap-3 p-3 rounded-lg bg-app-dark/50 hover:bg-app-dark"
            >
              <div className="w-12 h-12 rounded-full bg-app-accent flex items-center justify-center text-white font-bold text-lg">
                {p.username.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-app-text">
                  {p.username} {p.userId === currentUserId && '(you)'}
                </div>
                <div className="text-app-muted text-sm">
                  {p.userId === currentUserId ? (isMuted ? 'Muted' : 'Speaking') : (p.stream ? 'Connected' : 'Connecting...')}
                </div>
              </div>
              {p.stream && (
                <RemoteAudio stream={p.stream} muted={isDeafened} />
              )}
              {p.stream && <div className="w-2 h-2 rounded-full bg-app-online" />}
            </div>
          ))}
        </div>
      </div>
      <div className="p-4 border-t border-app-dark">
        {isInVoice ? (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-3 rounded-full transition-colors ${
                isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-app-hover hover:bg-app-channel'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? '🔇' : '🎤'}
            </button>
            <button
              onClick={() => setIsDeafened(!isDeafened)}
              className={`p-3 rounded-full transition-colors ${
                isDeafened ? 'bg-red-600 hover:bg-red-700' : 'bg-app-hover hover:bg-app-channel'
              }`}
              title={isDeafened ? 'Undeafen' : 'Deafen'}
            >
              {isDeafened ? '🔇' : '🔊'}
            </button>
            <button
              onClick={leave}
              className="p-3 rounded-full bg-red-600 hover:bg-red-700 transition-colors"
              title="Leave channel"
            >
              📞
            </button>
          </div>
        ) : (
          <button
            onClick={join}
            className="w-full px-6 py-3 rounded-full bg-app-accent hover:bg-app-accent-hover text-white font-semibold transition-colors"
          >
            Join Voice
          </button>
        )}
      </div>
    </div>
  )
}
