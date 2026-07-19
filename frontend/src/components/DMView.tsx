/**
 * DMView — Discord-style direct message chat.
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
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (isToday) return time
  if (isYesterday) return `Yesterday at ${time}`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined }) + ` at ${time}`
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
    if (isImageUrl(match[1])) parts.push({ type: 'image', value: match[1] })
    else parts.push({ type: 'text', value: match[1] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex)
    if (text.trim()) parts.push({ type: 'text', value: text })
  }
  return parts
}

function sameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString()
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
  const [showInputEmoji, setShowInputEmoji] = useState(false)
  const [inputEmojiRect, setInputEmojiRect] = useState<DOMRect | null>(null)
  const [dmReactions, setDmReactions] = useState<Record<string, { emoji: string; userId: string }[]>>({})
  const [showUserMenu, setShowUserMenu] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const doSend = async () => {
    const text = input.trim()
    const urls = attachments.map((a) => a.url).filter(Boolean)
    const content = urls.length > 0 ? (text ? `${text}\n\n${urls.join('\n')}` : urls.join('\n')) : text
    if (!content) return
    await onSendMessage(content)
    setInput('')
    setAttachments([])
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
      setShowAttachMenu(false)
    }
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

  const username = conversation.other_user?.username ?? 'Unknown'
  const otherUserId = conversation.other_user?.id
  const otherAvatarUrl = conversation.other_user?.avatar_url

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#313338]">
      {/* Header — Discord DM top bar */}
      <div className="h-12 px-4 flex items-center gap-3 border-b border-[#1f2023] shadow-sm flex-shrink-0 z-10">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-[#80848e] flex-shrink-0">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.19 0 2.34-.21 3.41-.6.3-.11.49-.4.49-.72v-.28c0-.32-.19-.61-.48-.73A8.96 8.96 0 0112 20c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8c0 .66-.08 1.3-.23 1.91-.07.3.02.61.24.82l.2.2c.28.28.75.2.91-.16.4-.9.63-1.9.63-2.96C22 6.48 17.52 2 12 2zm0 4c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm0 14c-2.67 0-5.33-.84-7.2-2.4.03-1.99 4.8-3.1 7.2-3.1 2.4 0 7.17 1.1 7.2 3.1A11.94 11.94 0 0112 20z" />
        </svg>
        <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 bg-[#5865f2] flex items-center justify-center text-white text-[10px] font-bold">
          {otherAvatarUrl ? (
            <img src={otherAvatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            username.charAt(0).toUpperCase()
          )}
        </div>
        <h2 className="font-semibold text-[#f2f3f5] text-[16px] truncate flex-1">{username}</h2>
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="p-1.5 rounded text-[#b5bac1] hover:text-[#dbdee1] hover:bg-white/5"
            title="More"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="6" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="18" r="1.5" />
            </svg>
          </button>
          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-full mt-1 py-1 z-50 bg-[#111214] rounded-md shadow-xl border border-white/10 min-w-[150px]">
                {onClose && (
                  <button
                    onClick={() => { onClose(); setShowUserMenu(false) }}
                    className="w-full px-3 py-2 text-left text-sm text-[#dbdee1] hover:bg-[#5865f2] hover:text-white"
                  >
                    Close DM
                  </button>
                )}
                <button
                  onClick={() => { onBlockUser?.(otherUserId); setShowUserMenu(false) }}
                  className="w-full px-3 py-2 text-left text-sm text-[#f23f43] hover:bg-[#f23f43] hover:text-white"
                >
                  Block User
                </button>
                <button
                  onClick={() => { onReportUser?.(otherUserId); setShowUserMenu(false) }}
                  className="w-full px-3 py-2 text-left text-sm text-[#dbdee1] hover:bg-[#5865f2] hover:text-white"
                >
                  Report User
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Messages — Discord left-aligned stream */}
      <div className="flex-1 overflow-y-auto min-h-0 px-0 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col justify-end h-full px-4 pb-4">
            <div className="w-20 h-20 rounded-full bg-[#5865f2] flex items-center justify-center text-white text-3xl font-bold mb-3 overflow-hidden">
              {otherAvatarUrl ? (
                <img src={otherAvatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                username.charAt(0).toUpperCase()
              )}
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">{username}</h3>
            <p className="text-[#b5bac1] text-sm max-w-md">
              This is the beginning of your direct message history with <strong className="text-[#dbdee1]">@{username}</strong>.
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {messages.map((msg, idx) => {
              const prev = messages[idx - 1]
              const isGrouped =
                !!prev &&
                prev.user_id === msg.user_id &&
                sameDay(prev.created_at, msg.created_at) &&
                new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < 7 * 60 * 1000
              const isMe = msg.user_id === currentUserId
              const avatarUrl = isMe ? currentUserAvatarUrl : otherAvatarUrl
              const showDateSep =
                !prev || !sameDay(prev.created_at, msg.created_at)

              const reactions = dmReactions[msg.id] || []
              const groupedReactions = reactions.reduce((acc, r) => {
                if (!acc[r.emoji]) acc[r.emoji] = { count: 0, userIds: [] as string[] }
                if (!acc[r.emoji].userIds.includes(r.userId)) {
                  acc[r.emoji].count++
                  acc[r.emoji].userIds.push(r.userId)
                }
                return acc
              }, {} as Record<string, { count: number; userIds: string[] }>)

              return (
                <div key={msg.id}>
                  {showDateSep && (
                    <div className="flex items-center gap-2 mx-4 my-3">
                      <div className="flex-1 h-px bg-[#3f4147]" />
                      <span className="text-[12px] font-semibold text-[#949ba4] uppercase tracking-wide">
                        {new Date(msg.created_at).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
                      </span>
                      <div className="flex-1 h-px bg-[#3f4147]" />
                    </div>
                  )}
                  <div
                    className={`group relative flex gap-4 px-4 hover:bg-[#2e3035]/60 ${
                      isGrouped ? 'py-0.5 min-h-[1.375rem]' : 'mt-4 py-0.5'
                    }`}
                  >
                    {isGrouped ? (
                      <div className="w-10 flex-shrink-0 flex justify-center pt-0.5">
                        <span className="text-[10px] text-[#949ba4] opacity-0 group-hover:opacity-100 leading-5">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden bg-[#5865f2] flex items-center justify-center text-white font-semibold text-sm mt-0.5">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (msg.username ?? '?').charAt(0).toUpperCase()
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      {!isGrouped && (
                        <div className="flex items-baseline gap-2 flex-wrap leading-tight">
                          <span className="font-medium text-[#f2f3f5] text-[16px] hover:underline cursor-default">
                            {msg.username ?? 'Unknown'}
                          </span>
                          <span className="text-[12px] text-[#949ba4]">
                            {formatMessageTime(msg.created_at)}
                          </span>
                        </div>
                      )}
                      <div className={`text-[#dbdee1] text-[16px] leading-[1.375] break-words whitespace-pre-wrap ${isGrouped ? '' : 'mt-0.5'}`}>
                        {(() => {
                          const parts = renderMessageContent(msg.content)
                          if (parts.length === 0) return msg.content
                          return parts.map((part, i) =>
                            part.type === 'image' ? (
                              <a key={i} href={part.value} target="_blank" rel="noreferrer" className="block mt-1">
                                <img src={part.value} alt="" className="max-w-[300px] max-h-[220px] rounded object-contain" />
                              </a>
                            ) : (
                              <span key={i}>{part.value}</span>
                            )
                          )
                        })()}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1 items-center">
                        {Object.entries(groupedReactions).map(([emoji, { count, userIds }]) => (
                          <button
                            key={emoji}
                            onClick={() => toggleReaction(msg.id, emoji)}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-sm border ${
                              userIds.includes(currentUserId)
                                ? 'bg-[#5865f2]/25 border-[#5865f2]/50 text-[#c9cdfb]'
                                : 'bg-[#2b2d31] border-transparent text-[#b5bac1] hover:border-[#3f4147]'
                            }`}
                          >
                            {emoji}
                            {count > 1 && <span className="text-xs">{count}</span>}
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
                          className="opacity-0 group-hover:opacity-100 text-[#b5bac1] hover:text-white text-sm px-1"
                        >
                          🙂
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
                </div>
              )
            })}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="px-4 pb-6 pt-2 flex-shrink-0">
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2 px-1">
            {attachments.map((a, i) => (
              <div key={i} className="relative bg-[#2b2d31] rounded-lg p-2">
                {a.type === 'image' ? (
                  <img src={a.url} alt="" className="max-w-[80px] max-h-[60px] rounded object-cover" />
                ) : (
                  <span className="text-xs text-[#b5bac1]">📎 {a.filename}</span>
                )}
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#1e1f22] border border-[#3f4147] text-[#dbdee1] text-xs"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.gif,.webp,video/mp4,video/webm,.pdf,.txt"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={doSend}
          placeholder={`Message @${username}`}
          members={conversation.other_user ? [{ id: conversation.other_user.id, username }] : []}
          uploading={uploading}
          onAttachClick={() => setShowAttachMenu((v) => !v)}
          attachOpen={showAttachMenu}
          attachMenu={
            showAttachMenu ? (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowAttachMenu(false)} />
                <div className="absolute left-0 bottom-full mb-2 py-2 z-50 bg-[#111214] rounded-lg shadow-xl border border-white/10 min-w-[180px]">
                  <button
                    type="button"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.accept = 'image/*,.gif,.webp,video/mp4,video/webm,.pdf,.txt'
                        fileInputRef.current.click()
                      }
                    }}
                    disabled={uploading}
                    className="w-full px-3 py-2 text-left text-sm text-[#dbdee1] hover:bg-[#5865f2] hover:text-white flex items-center gap-2"
                  >
                    Upload a File
                  </button>
                </div>
              </>
            ) : null
          }
          rightSlot={
            <>
              <button
                type="button"
                onClick={(e) => {
                  if (showInputEmoji) {
                    setShowInputEmoji(false)
                    setInputEmojiRect(null)
                  } else {
                    setShowInputEmoji(true)
                    setInputEmojiRect(e.currentTarget.getBoundingClientRect())
                  }
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#b5bac1] hover:text-white"
                title="Emoji"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-4.5-7.5c.83 0 1.5-.67 1.5-1.5S8.33 9.5 7.5 9.5 6 10.17 6 11s.67 1.5 1.5 1.5zm9 0c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5zM12 17.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
                </svg>
              </button>
              {showInputEmoji && (
                <EmojiPicker
                  anchorRect={inputEmojiRect ?? undefined}
                  onSelect={(emoji) => {
                    setInput((v) => v + emoji)
                    setShowInputEmoji(false)
                    setInputEmojiRect(null)
                  }}
                  onClose={() => { setShowInputEmoji(false); setInputEmojiRect(null) }}
                />
              )}
            </>
          }
        />
      </div>
    </div>
  )
}
