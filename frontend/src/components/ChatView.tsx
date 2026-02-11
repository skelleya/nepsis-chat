import { useState } from 'react'
import type { Channel, Message, User } from '../types'

interface ChatViewProps {
  channel: Channel
  messages: Message[]
  users: User[]
  onSendMessage?: (content: string) => void
}

export function ChatView({ channel, messages, users, onSendMessage }: ChatViewProps) {
  const [input, setInput] = useState('')
  const getUser = (userId: string) => users.find((u) => u.id === userId) ?? { username: 'Unknown', id: '' }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (text && onSendMessage) {
      onSendMessage(text)
      setInput('')
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-app-darker">
      <div className="h-12 px-4 flex items-center border-b border-app-dark shadow-sm">
        <span className="text-xl text-app-muted">#</span>
        <span className="ml-2 font-semibold text-app-text">{channel.name}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message) => {
            const user = getUser(message.userId)
            return (
              <div key={message.id} className="flex gap-4 py-1 hover:bg-app-dark/50 rounded px-2 -mx-2">
                <div className="w-10 h-10 rounded-full bg-app-accent flex items-center justify-center text-white font-bold flex-shrink-0">
                  {user.username.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-app-text">
                      {(message as Message & { username?: string }).username ?? user.username}
                    </span>
                    <span className="text-xs text-app-muted">{new Date(message.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-app-text mt-0.5">{message.content}</p>
                </div>
              </div>
            )
          })}
      </div>
      <form className="p-4" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Message #${channel.name}`}
          className="w-full bg-app-dark rounded-lg px-4 py-3 text-app-text placeholder-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent"
        />
      </form>
    </div>
  )
}
