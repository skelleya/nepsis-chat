/**
 * DMView — Direct message chat UI.
 * Simplified chat view for 1-on-1 conversations.
 */

import { useState, useRef, useEffect } from 'react'
import type { DMConversation, DMMessage } from '../services/api'
import { ChatInput } from './ChatInput'

interface DMViewProps {
  conversation: DMConversation
  messages: DMMessage[]
  currentUserId: string
  onSendMessage: (content: string) => Promise<void>
  onClose?: () => void
}

export function DMView({
  conversation,
  messages,
  currentUserId,
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

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-app-darker">
      {/* Header */}
      <div className="h-12 px-4 flex items-center gap-3 border-b border-app-dark bg-app-channel flex-shrink-0">
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded text-app-muted hover:text-app-text hover:bg-app-hover transition-colors"
            title="Close DM"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
            </svg>
          </button>
        )}
        <div className="w-8 h-8 rounded-full bg-app-accent flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {conversation.other_user.username?.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-app-text truncate">
            {conversation.other_user.username}
          </h2>
          <p className="text-xs text-app-muted">Direct Message</p>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-app-muted text-sm">
            <p>No messages yet.</p>
            <p className="mt-1">Say hello!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.user_id === currentUserId
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}
              >
                <div className="w-8 h-8 rounded-full bg-app-accent flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {msg.username?.charAt(0).toUpperCase()}
                </div>
                <div className={`flex-1 min-w-0 max-w-[75%] ${isMe ? 'items-end' : ''}`}>
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="font-semibold text-app-text text-sm">
                      {msg.username}
                    </span>
                    <span className="text-[10px] text-app-muted">
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div
                    className={`text-sm break-words ${
                      isMe
                        ? 'bg-app-accent text-white rounded-lg rounded-tr-sm px-3 py-2 ml-auto'
                        : 'bg-app-hover text-app-text rounded-lg rounded-tl-sm px-3 py-2'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-app-dark flex-shrink-0">
        <form onSubmit={handleSubmit}>
          <ChatInput
            value={input}
            onChange={setInput}
            onSubmit={doSend}
            placeholder={`Message ${conversation.other_user.username}`}
            disabled={false}
            members={[{ id: conversation.other_user.id, username: conversation.other_user.username }]}
          />
        </form>
      </div>
    </div>
  )
}
