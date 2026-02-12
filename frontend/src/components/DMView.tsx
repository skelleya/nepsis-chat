/**
 * DMView — Direct message chat UI.
 * Modern 1-on-1 conversation view with polished design.
 */

import { useState, useRef, useEffect } from 'react'
import type { DMConversation, DMMessage } from '../services/api'
import * as api from '../services/api'
import { ChatInput } from './ChatInput'
import { EmojiPicker } from './EmojiPicker'

interface DMViewProps {
  conversation: DMConversation
  messages: DMMessage[]
  currentUserId: string
  currentUserAvatarUrl?: string
  onSendMessage: (content: string) => Promise<void>
  onClose?: () => void
  onBlockUser?: (userId: string) => void
  onReportUser?: (userId: string) => void
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

function isImageUrl(url: string): boolean {
  return /\.(gif|jpe?g|png|webp|svg)$/i.test(url) || /supabase.*storage.*\.(gif|jpe?g|png|webp)/i.test(url)
}

function renderMessageContent(content: string): { type: 'text' | 'image'; value: string }[] {
  const parts: { type: 'text' | 'image'; value: string }[] = []
  const urlRe = /(https?:\/\/[^\s]+)/g
  let lastIndex = 0
  let match
  while ((match = urlRe.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index)
      if (text.trim()) parts.push({ type: 'text', value: text })
    }
    if (isImageUrl(match[1])) {
      parts.push({ type: 'image', value: match[1] })
    } else {
      parts.push({ type: 'text', value: match[1] })
    }
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex)
    if (text.trim()) parts.push({ type: 'text', value: text })
  }
  return parts
}

export function DMView({
  conversation,
  messages,
  currentUserId,
  currentUserAvatarUrl,
  onSendMessage,
  onClose,
  onBlockUser,
  onReportUser,
}: DMViewProps) {
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<{ url: string; type: string; filename?: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null)
  const [emojiAnchorRect, setEmojiAnchorRect] = useState<DOMRect | null>(null)
  const [dmReactions, setDmReactions] = useState<Record<string, { emoji: string; userId: string }[]>>({})
  const [showUserMenu, setShowUserMenu] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const doSend = async () => {
    const text = input.trim()
    const urls = attachments.map((a) => a.url).filter(Boolean)
    const content = urls.length > 0 ? (text ? `${text}\n\n${urls.join('\n')}` : urls.join('\n')) : text
    if (content) {
      await onSendMessage(content)
      setInput('')
      setAttachments([])
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    doSend()
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    setUploading(true)
    try {
      for (let i = 0; i < files.length; i++) {
        const { url } = await api.uploadFile(files[i])
        const type = files[i].type.startsWith('image/') ? 'image' : files[i].type.startsWith('video/') ? 'video' : 'file'
        setAttachments((prev) => [...prev, { url, type, filename: files[i].name }])
      }
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx))
  }

  const toggleReaction = (messageId: string, emoji: string) => {
    setDmReactions((prev) => {
      const list = prev[messageId] || []
      const exists = list.some((r) => r.userId === currentUserId && r.emoji === emoji)
      const next = { ...prev }
      next[messageId] = exists
        ? list.filter((r) => !(r.userId === currentUserId && r.emoji === emoji))
        : [...list, { emoji, userId: currentUserId }]
      return next
    })
  }

  const lastMessageFromMe = messages.filter((m) => m.user_id === currentUserId).pop()

  const username = conversation.other_user?.username ?? 'Unknown'
  const otherUserId = conversation.other_user?.id
  const otherAvatarUrl = conversation.other_user?.avatar_url

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0c0d0f]">
      {/* Header */}
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
          <h2 className="font-semibold text-app-text truncate text-base">{username}</h2>
          <p className="text-xs text-app-muted/80">Direct Message</p>
        </div>

        {/* 3 dots menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="p-2 rounded-lg text-app-muted hover:text-app-text hover:bg-white/5 transition-colors"
            title="More options"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="6" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="18" r="1.5" />
            </svg>
          </button>
          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-full mt-1 py-1 z-50 bg-[#2b2d31] rounded-lg shadow-xl border border-app-hover/50 min-w-[140px]">
                <button
                  onClick={() => {
                    onBlockUser?.(otherUserId)
                    setShowUserMenu(false)
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-app-hover/60"
                >
                  Block User
                </button>
                <button
                  onClick={() => {
                    onReportUser?.(otherUserId)
                    setShowUserMenu(false)
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-app-text hover:bg-app-hover/60"
                >
                  Report User
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 sm:px-6 py-6 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-app-accent/20 to-indigo-600/20 flex items-center justify-center mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-app-accent">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-app-text font-medium">No messages yet</p>
            <p className="text-sm text-app-muted mt-1">Send a message to start the conversation</p>
          </div>
        ) : (
          <div className="w-full max-w-3xl mx-auto flex flex-col">
            {messages.map((msg, idx) => {
              const isMe = msg.user_id === currentUserId
              const prevMsg = messages[idx - 1]
              const nextMsg = messages[idx + 1]
              const isFromSameSender = prevMsg?.user_id === msg.user_id
              const isNextFromSameSender = nextMsg?.user_id === msg.user_id
              const avatarUrl = isMe ? currentUserAvatarUrl : otherAvatarUrl
              const reactions = dmReactions[msg.id] || []
              const groupedReactions = reactions.reduce((acc, r) => {
                const key = r.emoji
                if (!acc[key]) acc[key] = { count: 0, userIds: [] as string[] }
                if (!acc[key].userIds.includes(r.userId)) {
                  acc[key].count++
                  acc[key].userIds.push(r.userId)
                }
                return acc
              }, {} as Record<string, { count: number; userIds: string[] }>)

              return (
                <div
                  key={msg.id}
                  className={`group flex gap-3 w-full ${isMe ? 'flex-row-reverse' : ''} ${isNextFromSameSender ? 'mb-1.5' : 'mb-3'}`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden bg-app-channel ${isFromSameSender ? 'opacity-0 invisible' : ''}`}>
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={msg.username ?? ''}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; e.currentTarget.parentElement!.textContent = (msg.username ?? '?').charAt(0).toUpperCase() }}
                      />
                    ) : (
                      (msg.username ?? '?').charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[75%] min-w-0`}>
                    {!isFromSameSender && (
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-medium text-app-text text-sm">{msg.username ?? 'Unknown'}</span>
                        <span className="text-[11px] text-app-muted">{formatMessageTime(msg.created_at)}</span>
                        {isMe && lastMessageFromMe?.id === msg.id && (
                          <span className="text-app-muted" title="Sent">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                            </svg>
                          </span>
                        )}
                      </div>
                    )}
                    <div
                      className={`text-sm break-words px-4 py-2.5 ${
                        isMe
                          ? 'bg-app-accent text-white rounded-2xl rounded-br-md shadow-lg shadow-app-accent/15'
                          : 'bg-app-channel text-app-text rounded-2xl rounded-bl-md border border-white/5'
                      }`}
                    >
                      {(() => {
                        const parts = renderMessageContent(msg.content)
                        if (parts.length === 0) return <span className="whitespace-pre-wrap">{msg.content}</span>
                        return parts.map((part, i) =>
                          part.type === 'image' ? (
                            <a key={i} href={part.value} target="_blank" rel="noreferrer" className="block mt-2 first:mt-0">
                              <img src={part.value} alt="" className="max-w-[280px] max-h-[200px] rounded-lg object-contain" />
                            </a>
                          ) : (
                            <span key={i} className="whitespace-pre-wrap">{part.value}</span>
                          )
                        )
                      })()}
                    </div>
                    {/* Reactions */}
                    <div className="mt-1 flex flex-wrap gap-1 items-center">
                      {Object.entries(groupedReactions).map(([emoji, { count, userIds }]) => (
                        <button
                          key={emoji}
                          onClick={() => toggleReaction(msg.id, emoji)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-sm ${
                            userIds.includes(currentUserId) ? 'bg-app-accent/30 text-app-accent' : 'bg-app-dark text-app-muted hover:bg-app-hover'
                          }`}
                        >
                          {emoji}
                          {count > 1 && <span>{count}</span>}
                        </button>
                      ))}
                      <button
                        onClick={(e) => {
                          if (showEmojiPicker === msg.id) {
                            setShowEmojiPicker(null)
                            setEmojiAnchorRect(null)
                          } else {
                            setShowEmojiPicker(msg.id)
                            setEmojiAnchorRect(e.currentTarget.getBoundingClientRect())
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 text-app-muted hover:text-app-text transition-opacity text-sm"
                      >
                        +
                      </button>
                      {showEmojiPicker === msg.id && (
                        <EmojiPicker
                          anchorRect={emojiAnchorRect ?? undefined}
                          onSelect={(emoji) => {
                            toggleReaction(msg.id, emoji)
                            setShowEmojiPicker(null)
                            setEmojiAnchorRect(null)
                          }}
                          onClose={() => { setShowEmojiPicker(null); setEmojiAnchorRect(null) }}
                        />
                      )}
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
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((a, i) => (
                <div key={i} className="relative">
                  {a.type === 'image' ? (
                    <img src={a.url} alt="" className="max-w-[80px] max-h-[60px] rounded object-cover" />
                  ) : (
                    <span className="text-xs text-app-muted px-2 py-1 bg-app-channel rounded">📎 {a.filename}</span>
                  )}
                  <button type="button" onClick={() => removeAttachment(i)} className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-xs">
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            {/* + / X toggle */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAttachMenu(!showAttachMenu)}
                className="p-2.5 rounded-lg text-app-muted hover:text-app-text hover:bg-white/5 transition-colors"
                title={showAttachMenu ? 'Close' : 'Attach'}
              >
                {showAttachMenu ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                  </svg>
                )}
              </button>
              {showAttachMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowAttachMenu(false)} />
                  <div className="absolute left-0 bottom-full mb-1 py-2 z-50 bg-[#2b2d31] rounded-xl shadow-xl border border-app-hover/50 min-w-[160px]">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.gif,.webp,video/mp4,video/webm,.pdf,.txt"
                      multiple
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.accept = 'image/*,.gif,.webp,video/mp4,video/webm,.pdf,.txt'
                          fileInputRef.current.click()
                        }
                        setShowAttachMenu(false)
                      }}
                      disabled={uploading}
                      className="w-full px-4 py-2 text-left text-sm text-app-text hover:bg-app-hover/60 flex items-center gap-2"
                    >
                      {uploading ? '⏳' : '📎'} Send file
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.accept = 'image/*,.gif,.webp'
                          fileInputRef.current.click()
                        }
                        setShowAttachMenu(false)
                      }}
                      disabled={uploading}
                      className="w-full px-4 py-2 text-left text-sm text-app-text hover:bg-app-hover/60 flex items-center gap-2"
                    >
                      🖼️ Picture
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAttachMenu(false)}
                      className="w-full px-4 py-2 text-left text-sm text-app-muted hover:bg-app-hover/60 flex items-center gap-2"
                    >
                      GIF (coming soon)
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="flex-1 flex gap-2 min-w-0">
              <ChatInput
                value={input}
                onChange={setInput}
                onSubmit={doSend}
                placeholder={`Message ${username}`}
                disabled={false}
                members={conversation.other_user ? [{ id: conversation.other_user.id, username }] : []}
              />
              <button
                type="submit"
                disabled={!input.trim() && attachments.length === 0}
                className="p-2.5 rounded-lg bg-app-accent text-white hover:bg-app-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                title="Send"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
