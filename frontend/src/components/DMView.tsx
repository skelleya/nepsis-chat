/**
 * DMView — Discord-style direct message chat.
 */

import { useState, useRef, useEffect } from 'react'
import type { DMConversation, DMMessage } from '../services/api'
import * as api from '../services/api'
import { useCall } from '../contexts/CallContext'
import { ChatInput } from './ChatInput'
import { EmojiPicker } from './EmojiPicker'
import { FileAttachment, isImageUrl, isVideoUrl, isFileUrl } from './FileAttachment'
import { MemberProfilePanel } from './MemberProfilePanel'
import type { ServerMember } from './MembersSidebar'
import { GifPicker } from './GifPicker'

interface DMViewProps {
  conversation: DMConversation
  messages: DMMessage[]
  currentUserId: string
  currentUserAvatarUrl?: string
  onSendMessage: (content: string, options?: { replyToId?: string }) => Promise<void>
  onToggleReaction: (messageId: string, emoji: string) => Promise<void>
  onClose?: () => void
  onBlockUser?: (userId: string) => void
  onReportUser?: (userId: string) => void
  onAddPeople?: () => void
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

function renderMessageContent(
  content: string
): { type: 'text' | 'image' | 'video' | 'file'; value: string }[] {
  const parts: { type: 'text' | 'image' | 'video' | 'file'; value: string }[] = []
  const urlRe = /(https?:\/\/[^\s]+)/g
  let lastIndex = 0
  let match
  while ((match = urlRe.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index)
      if (text.trim()) parts.push({ type: 'text', value: text })
    }
    const url = match[1]
    if (isImageUrl(url)) parts.push({ type: 'image', value: url })
    else if (isVideoUrl(url)) parts.push({ type: 'video', value: url })
    else if (isFileUrl(url)) parts.push({ type: 'file', value: url })
    else parts.push({ type: 'text', value: url })
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
  onToggleReaction,
  onClose,
  onBlockUser,
  onReportUser,
  onAddPeople,
}: DMViewProps) {
  const call = useCall()
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<{ url: string; type: string; filename?: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null)
  const [emojiAnchorRect, setEmojiAnchorRect] = useState<DOMRect | null>(null)
  const [showInputEmoji, setShowInputEmoji] = useState(false)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [inputEmojiRect, setInputEmojiRect] = useState<DOMRect | null>(null)
  const [replyTo, setReplyTo] = useState<DMMessage | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [profileAnchor, setProfileAnchor] = useState<DOMRect | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const nameBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    setReplyTo(null)
  }, [conversation.id])

  const isGroup = conversation.is_group
  const otherParticipants = conversation.participants.filter((participant) => participant.id !== currentUserId)
  const username = isGroup
    ? conversation.name?.trim() || otherParticipants.map((participant) => participant.username).join(', ') || 'Group message'
    : conversation.other_user?.username ?? 'Unknown'
  const otherUserId = conversation.other_user?.id
  const otherAvatarUrl = conversation.other_user?.avatar_url
  const participantById = new Map(conversation.participants.map((participant) => [participant.id, participant]))
  const inCallWithThem =
    call.callState === 'in-call' && call.remoteUserId === otherUserId

  const profileMember: ServerMember | null = !isGroup && otherUserId
    ? {
        userId: otherUserId,
        username,
        avatarUrl: otherAvatarUrl || undefined,
        bannerUrl: conversation.other_user?.banner_url || undefined,
        bio: conversation.other_user?.bio || '',
        profileType: conversation.other_user?.profile_type,
        role: 'member',
        status: 'online',
      }
    : null

  const openProfile = (el?: HTMLElement | null) => {
    const rect = (el ?? nameBtnRef.current)?.getBoundingClientRect()
    if (rect) setProfileAnchor(rect)
  }

  const doSend = async () => {
    const text = input.trim()
    const urls = attachments.map((a) => a.url).filter(Boolean)
    const content = urls.length > 0 ? (text ? `${text}\n\n${urls.join('\n')}` : urls.join('\n')) : text
    if (!content) return
    await onSendMessage(content, replyTo ? { replyToId: replyTo.id } : undefined)
    setInput('')
    setAttachments([])
    setReplyTo(null)
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

  const handleGifSelect = async (gif: api.GifSearchResult) => {
    setUploading(true)
    try {
      const { url } = await api.importGif(currentUserId, gif.url)
      setAttachments((previous) => [
        ...previous,
        { url, type: 'image', filename: `${gif.title || 'gif'}.gif` },
      ])
    } finally {
      setUploading(false)
    }
  }

  const selectReply = (msg: DMMessage) => {
    setReplyTo(msg)
    requestAnimationFrame(() => {
      document.getElementById('dm-chat-input')?.focus()
    })
  }

  const startCall = (video = false) => {
    if (!otherUserId) return
    if (inCallWithThem) {
      call.expandCall()
      return
    }
    if (call.callState !== 'idle') return
    call.initiateCall(otherUserId, username, otherAvatarUrl || undefined, { video })
  }

  return (
    <div className="chat-shell flex-1 flex flex-col min-w-0">
      {/* Header — Discord DM top bar */}
      <div className="chat-header-modern h-12 px-4 flex items-center gap-3 flex-shrink-0 z-10">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-app-offline flex-shrink-0">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.19 0 2.34-.21 3.41-.6.3-.11.49-.4.49-.72v-.28c0-.32-.19-.61-.48-.73A8.96 8.96 0 0112 20c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8c0 .66-.08 1.3-.23 1.91-.07.3.02.61.24.82l.2.2c.28.28.75.2.91-.16.4-.9.63-1.9.63-2.96C22 6.48 17.52 2 12 2zm0 4c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm0 14c-2.67 0-5.33-.84-7.2-2.4.03-1.99 4.8-3.1 7.2-3.1 2.4 0 7.17 1.1 7.2 3.1A11.94 11.94 0 0112 20z" />
        </svg>
        <button
          ref={nameBtnRef}
          type="button"
          onClick={(e) => { if (!isGroup) openProfile(e.currentTarget) }}
          className={`flex items-center gap-2 min-w-0 flex-1 text-left rounded-md px-1.5 py-1 -mx-1.5 transition-colors ${isGroup ? 'cursor-default' : 'hover:bg-app-hover/50'}`}
          title={isGroup ? `${conversation.participants.length} members` : `View ${username}'s profile`}
        >
          <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 bg-app-accent flex items-center justify-center text-white text-[10px] font-bold">
            {isGroup ? (
              <span className="text-sm">👥</span>
            ) : otherAvatarUrl ? (
              <img src={otherAvatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              username.charAt(0).toUpperCase()
            )}
          </div>
          <h2 className="font-display font-semibold text-app-text text-[16px] truncate">{username}</h2>
        </button>

        <div className="flex items-center gap-1">
          {isGroup && onAddPeople && (
            <button
              type="button"
              onClick={onAddPeople}
              className="px-2.5 py-1.5 rounded text-sm font-medium text-app-text bg-app-hover/70 hover:bg-app-hover"
              title="Add people"
            >
              Add people
            </button>
          )}
          {!isGroup && (inCallWithThem ? (
            <button
              type="button"
              onClick={() => call.expandCall()}
              className="px-2.5 py-1.5 rounded text-sm font-medium text-white bg-[#23a559] hover:opacity-90"
              title="Expand call"
            >
              In call — Expand
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => startCall(false)}
                disabled={call.callState !== 'idle'}
                className="p-1.5 rounded text-app-muted hover:text-app-text hover:bg-white/5 disabled:opacity-40"
                title="Call"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => startCall(true)}
                disabled={call.callState !== 'idle'}
                className="p-1.5 rounded text-app-muted hover:text-app-text hover:bg-white/5 disabled:opacity-40"
                title="Video Call"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                </svg>
              </button>
            </>
          ))}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="p-1.5 rounded text-app-muted hover:text-app-text hover:bg-white/5"
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
                <div className="absolute right-0 top-full mt-1 py-1 z-50 bg-app-darker rounded-md shadow-xl border border-white/10 min-w-[150px]">
                  {onClose && (
                    <button
                      onClick={() => { onClose(); setShowUserMenu(false) }}
                      className="w-full px-3 py-2 text-left text-sm text-app-text hover:bg-app-accent hover:text-white"
                    >
                      Close DM
                    </button>
                  )}
                  {!isGroup && (
                    <>
                      <button
                        onClick={() => { if (otherUserId) onBlockUser?.(otherUserId); setShowUserMenu(false) }}
                        className="w-full px-3 py-2 text-left text-sm text-[#f23f43] hover:bg-[#f23f43] hover:text-white"
                      >
                        Block User
                      </button>
                      <button
                        onClick={() => { if (otherUserId) onReportUser?.(otherUserId); setShowUserMenu(false) }}
                        className="w-full px-3 py-2 text-left text-sm text-app-text hover:bg-app-accent hover:text-white"
                      >
                        Report User
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Messages — Discord left-aligned stream */}
      <div className="scrollbar-thin flex-1 overflow-y-auto min-h-0 px-0 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col justify-end h-full px-4 pb-4">
            <button
              type="button"
              onClick={(e) => { if (!isGroup) openProfile(e.currentTarget) }}
              className={`text-left rounded-xl p-2 -m-2 transition-colors w-fit ${isGroup ? 'cursor-default' : 'hover:bg-app-hover/30'}`}
              title={isGroup ? `${conversation.participants.length} members` : `View ${username}'s profile`}
            >
              <div className="w-20 h-20 rounded-full bg-app-accent flex items-center justify-center text-white text-3xl font-bold mb-3 overflow-hidden">
                {isGroup ? (
                  <span>👥</span>
                ) : otherAvatarUrl ? (
                  <img src={otherAvatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  username.charAt(0).toUpperCase()
                )}
              </div>
              <h3 className="text-2xl font-bold text-white mb-1">{username}</h3>
            </button>
            <p className="text-app-muted text-sm max-w-md">
              {isGroup
                ? <>This is the beginning of <strong className="text-app-text">{username}</strong>.</>
                : <>This is the beginning of your direct message history with <strong className="text-app-text">@{username}</strong>.</>}
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
              const avatarUrl = isMe ? currentUserAvatarUrl : participantById.get(msg.user_id)?.avatar_url
              const showDateSep = !prev || !sameDay(prev.created_at, msg.created_at)

              const reactions = msg.reactions || []
              const groupedReactions = reactions.reduce((acc, r) => {
                if (!acc[r.emoji]) acc[r.emoji] = { count: 0, userIds: [] as string[] }
                if (!acc[r.emoji].userIds.includes(r.user_id)) {
                  acc[r.emoji].count++
                  acc[r.emoji].userIds.push(r.user_id)
                }
                return acc
              }, {} as Record<string, { count: number; userIds: string[] }>)

              return (
                <div key={msg.id} id={`dm-msg-${msg.id}`}>
                  {showDateSep && (
                    <div className="flex items-center gap-3 mx-5 my-5">
                      <div className="flex-1 h-px bg-app-glass/[0.07]" />
                      <span className="text-[10px] font-semibold text-app-muted uppercase tracking-[0.12em]">
                        {new Date(msg.created_at).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
                      </span>
                      <div className="flex-1 h-px bg-app-glass/[0.07]" />
                    </div>
                  )}
                  <div
                    className={`chat-msg-row chat-message-modern group relative flex gap-3.5 px-5 cursor-pointer ${
                      isGrouped ? 'min-h-[1.375rem]' : 'mt-3'
                    } ${replyTo?.id === msg.id ? 'bg-app-accent/10' : ''}`}
                    onClick={() => selectReply(msg)}
                  >
                    <div className="absolute right-5 -top-3 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 max-lg:opacity-100 z-10 flex items-center bg-app-panel/95 border border-app-glass/[0.08] rounded-lg shadow-xl overflow-hidden backdrop-blur">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          selectReply(msg)
                        }}
                        className="px-2 py-1 text-xs text-app-muted hover:bg-app-hover hover:text-white"
                      >
                        Reply
                      </button>
                    </div>

                    {isGrouped ? (
                      <div className="w-10 flex-shrink-0 flex justify-center pt-0.5">
                        <span className="text-[10px] text-app-muted opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 max-lg:opacity-100 leading-5">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden bg-app-accent flex items-center justify-center text-white font-semibold text-sm mt-0.5">
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
                          <span className="font-semibold text-app-text text-[15px] hover:underline cursor-default">
                            {msg.username ?? 'Unknown'}
                          </span>
                          <span className="text-[11px] tabular-nums text-app-muted/80">
                            {formatMessageTime(msg.created_at)}
                          </span>
                        </div>
                      )}
                      {msg.reply_to && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            document.getElementById(`dm-msg-${msg.reply_to!.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                          }}
                          className="mt-0.5 mb-1 flex items-center gap-1.5 text-xs text-app-muted hover:text-white border-l-2 border-app-hover pl-2"
                        >
                          <span className="font-semibold text-app-accent">{msg.reply_to.username}</span>
                          <span className="truncate max-w-[240px]">{msg.reply_to.content}</span>
                        </button>
                      )}
                      <div className={`text-app-text text-[15px] leading-[1.5] break-words whitespace-pre-wrap ${isGrouped ? '' : 'mt-0.5'}`}>
                        {(() => {
                          const parts = renderMessageContent(msg.content)
                          if (parts.length === 0) return msg.content
                          return parts.map((part, i) => {
                            if (part.type === 'image' || part.type === 'video' || part.type === 'file') {
                              return (
                                <FileAttachment
                                  key={i}
                                  url={part.value}
                                  type={part.type}
                                  stopPropagation
                                />
                              )
                            }
                            return <span key={i}>{part.value}</span>
                          })
                        })()}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1 items-center" onClick={(e) => e.stopPropagation()}>
                        {Object.entries(groupedReactions).map(([emoji, { count, userIds }]) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => onToggleReaction(msg.id, emoji)}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-sm border ${
                              userIds.includes(currentUserId)
                                ? 'bg-app-accent/25 border-app-accent/50 text-app-text'
                                : 'bg-app-channel border-transparent text-app-muted hover:border-app-hover'
                            }`}
                          >
                            {emoji}
                            {count > 1 && <span className="text-xs">{count}</span>}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={(e) => {
                            if (showEmojiPicker === msg.id) {
                              setShowEmojiPicker(null)
                              setEmojiAnchorRect(null)
                            } else {
                              setShowEmojiPicker(msg.id)
                              setEmojiAnchorRect(e.currentTarget.getBoundingClientRect())
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 max-lg:opacity-100 text-app-muted hover:text-white text-sm px-1"
                        >
                          🙂
                        </button>
                        {showEmojiPicker === msg.id && (
                          <EmojiPicker
                            anchorRect={emojiAnchorRect ?? undefined}
                            onSelect={(emoji) => {
                              onToggleReaction(msg.id, emoji)
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
      <div className="chat-composer-wrap px-4 sm:px-5 pb-5 pt-3 flex-shrink-0">
        {replyTo && (
          <div className="mb-2 flex items-center justify-between gap-2 px-3 py-2 rounded-t-lg bg-app-channel border-l-4 border-app-accent">
            <div className="min-w-0 text-sm">
              <span className="text-app-muted">Replying to </span>
              <span className="text-app-accent font-semibold">{replyTo.username}</span>
              <p className="text-app-muted truncate">{replyTo.content}</p>
            </div>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="text-app-muted hover:text-white text-lg leading-none px-1"
              title="Cancel reply"
            >
              ×
            </button>
          </div>
        )}
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2 px-1">
            {attachments.map((a, i) => (
              <div key={i} className="relative bg-app-channel rounded-lg p-2">
                {a.type === 'image' ? (
                  <img src={a.url} alt="" className="max-w-[80px] max-h-[60px] rounded object-cover" />
                ) : (
                  <span className="text-xs text-app-muted">📎 {a.filename}</span>
                )}
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-app-darker border border-app-hover text-app-text text-xs"
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
          placeholder={replyTo ? `Reply to @${replyTo.username}` : `Message ${isGroup ? username : `@${username}`}`}
          members={otherParticipants.map((participant) => ({ id: participant.id, username: participant.username }))}
          uploading={uploading}
          onAttachClick={() => setShowAttachMenu((v) => !v)}
          attachOpen={showAttachMenu}
          inputId="dm-chat-input"
          attachMenu={
            showAttachMenu ? (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowAttachMenu(false)} />
                <div className="absolute left-0 bottom-full mb-2 py-2 z-50 bg-app-darker rounded-lg shadow-xl border border-white/10 min-w-[180px]">
                  <button
                    type="button"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.accept = 'image/*,.gif,.webp,video/mp4,video/webm,.pdf,.txt'
                        fileInputRef.current.click()
                      }
                    }}
                    disabled={uploading}
                    className="w-full px-3 py-2 text-left text-sm text-app-text hover:bg-app-accent hover:text-white flex items-center gap-2"
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
                onClick={() => setShowGifPicker(true)}
                disabled={uploading}
                className="h-8 px-2 rounded-lg text-[11px] font-bold tracking-wide text-app-muted hover:text-app-text hover:bg-app-glass/[0.06] disabled:opacity-50"
                title="Choose a GIF"
              >
                GIF
              </button>
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
                className="w-8 h-8 rounded-full flex items-center justify-center text-app-muted hover:text-white"
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

      {showGifPicker && (
        <GifPicker userId={currentUserId} onSelect={handleGifSelect} onClose={() => setShowGifPicker(false)} />
      )}

      {profileMember && profileAnchor && (
        <MemberProfilePanel
          member={profileMember}
          currentUserId={currentUserId}
          anchorRect={profileAnchor}
          anchorRef={nameBtnRef}
          placement="below"
          onClose={() => setProfileAnchor(null)}
          onCall={
            otherUserId
              ? (userId, name, avatar) => {
                  if (call.callState === 'idle') call.initiateCall(userId, name, avatar)
                  else if (inCallWithThem) call.expandCall()
                }
              : undefined
          }
          onAddFriend={async (userId) => {
            try {
              await api.sendFriendRequest(currentUserId, userId, 'personal', 'personal')
            } catch (err) {
              console.error('Add friend failed:', err)
            }
          }}
        />
      )}
    </div>
  )
}
