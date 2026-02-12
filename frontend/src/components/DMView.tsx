/**
 * DMView — Direct message chat UI.
 * Modern 1-on-1 conversation view with polished design.
 */

import { useState, useRef, useEffect } from 'react'
import type { DMConversation, DMMessage } from '../services/api'
import { ChatInput } from './ChatInput'

interface DMViewProps {
  conversation: DMConversation
  messages: DMMessage[]
  currentUserId: string
  currentUserAvatarUrl?: string
  onSendMessage: (content: string) => Promise<void>
  onClose?: () => void
}

function formatMessageTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const isToday = d.toDateString() === now.toDateString()
  const isYesterday = diff < 48 * 60 * 60 * 1000 && d.getDate() !== now.getDate()

  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (isToday) return time
  if (isYesterday) return `Yesterday ${time}`
  if (diff < 7 * 24 * 60 * 60 * 1000) return d.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function DMView({
  conversation,
  messages,
  currentUserId,
  currentUserAvatarUrl,
  onSendMessage,
  onClose,
}: DMViewProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const doSend = () => {
    const text = input.trim()
    if (text) {
      onSendMessage(text)
      setInput('')
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    doSend()
  }

  const username = conversation.other_user?.username ?? 'Unknown'
  const otherAvatarUrl = conversation.other_user?.avatar_url

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0c0d0f]">
      {/* Header — modern gradient accent */}
      <div className="h-14 px-5 flex items-center gap-4 border-b border-white/5 bg-[#16171a] flex-shrink-0">
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 -ml-1 rounded-lg text-app-muted hover:text-app-text hover:bg-white/5 transition-colors"
            title="Close DM"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
            </svg>
          </button>
        )}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-lg overflow-hidden ${otherAvatarUrl ? 'bg-transparent' : 'bg-gradient-to-br from-app-accent to-indigo-600 shadow-app-accent/20'}`}>
          {otherAvatarUrl ? (
            <img src={otherAvatarUrl} alt={username} className="w-full h-full object-cover" />
          ) : (
            username.charAt(0).toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-app-text truncate text-base">
            {username}
          </h2>
          <p className="text-xs text-app-muted/80">Direct Message</p>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 min-h-0"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-app-accent/20 to-indigo-600/20 flex items-center justify-center mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-app-accent">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-app-text font-medium">No messages yet</p>
            <p className="text-sm text-app-muted mt-1">Send a message to start the conversation</p>
          </div>
        ) : (
          <div className="space-y-5 max-w-2xl mx-auto">
            {messages.map((msg) => {
              const isMe = msg.user_id === currentUserId
              const avatarUrl = isMe ? currentUserAvatarUrl : otherAvatarUrl
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden ${avatarUrl ? 'bg-transparent' : 'bg-app-channel'}`}>
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={msg.username ?? ''} className="w-full h-full object-cover" />
                    ) : (
                      (msg.username ?? '?').charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className={`flex-1 min-w-0 max-w-[80%] ${isMe ? 'flex flex-col items-end' : ''}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-app-text text-sm">
                        {msg.username ?? 'Unknown'}
                      </span>
                      <span className="text-[11px] text-app-muted">
                        {formatMessageTime(msg.created_at)}
                      </span>
                    </div>
                    <div
                      className={`text-sm break-words px-4 py-2.5 ${
                        isMe
                          ? 'bg-app-accent text-white rounded-2xl rounded-br-md shadow-lg shadow-app-accent/15'
                          : 'bg-app-channel text-app-text rounded-2xl rounded-bl-md border border-white/5'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-4 border-t border-white/5 bg-[#16171a]/50 flex-shrink-0">
        <form onSubmit={handleSubmit}>
          <ChatInput
            value={input}
            onChange={setInput}
            onSubmit={doSend}
            placeholder={`Message ${username}`}
            disabled={false}
            members={conversation.other_user ? [{ id: conversation.other_user.id, username }] : []}
          />
        </form>
      </div>
    </div>
  )
}
