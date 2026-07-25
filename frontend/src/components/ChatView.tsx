import { useState, useRef, useEffect } from 'react'
import type { Channel, Message, User } from '../types'
import { useApp } from '../contexts/AppContext'
import * as api from '../services/api'
import { EmojiPicker } from './EmojiPicker'
import { ChatInput } from './ChatInput'
import { FileAttachment } from './FileAttachment'
import { GifPicker } from './GifPicker'
import { MessageContent } from './MessageContent'
import { TypingIndicator } from './TypingIndicator'
import { useChatTyping } from '../hooks/useChatTyping'

interface ServerEmoji {
  id: string
  name: string
  image_url: string
}

interface ChatViewProps {
  channel: Channel
  messages: Message[]
  users: User[]
  members?: { id: string; username: string; avatarUrl?: string }[]
  serverEmojis?: ServerEmoji[]
  onSendMessage?: (content: string, options?: { replyToId?: string; attachments?: { url: string; type: string; filename?: string }[] }) => void
  currentUserId: string
  isAdminOrOwner?: boolean
  /** For rules channel: only owner/admin can send. When false, hides chat input. */
  canSendMessages?: boolean
  /** When in rules channel, called after reaction toggle (to refresh rules acceptance state) */
  onAfterReaction?: () => void
}

export function ChatView({
  channel,
  messages,
  users,
  members = [],
  serverEmojis = [],
  onSendMessage,
  currentUserId,
  isAdminOrOwner = false,
  canSendMessages = true,
  onAfterReaction,
}: ChatViewProps) {
  const { user: appUser, editMessage, deleteMessage, toggleReaction } = useApp()
  const currentUsername = appUser?.display_name || appUser?.username || ''
  const { typingUsers, notifyTyping, stopTyping } = useChatTyping(
    channel.id,
    appUser ? { userId: appUser.id, username: currentUsername } : null
  )
  const [input, setInput] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [attachments, setAttachments] = useState<{ url: string; type: string; filename?: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null)
  const [showInputEmojiPicker, setShowInputEmojiPicker] = useState(false)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [emojiAnchorRect, setEmojiAnchorRect] = useState<DOMRect | null>(null)
  const [inputEmojiAnchorRect, setInputEmojiAnchorRect] = useState<DOMRect | null>(null)
  const [hasNewMessages, setHasNewMessages] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastMessageCountRef = useRef(0)
  const firstNewMessageIdRef = useRef<string | null>(null)

  const isAtBottom = () => {
    const el = scrollRef.current
    if (!el) return true
    const threshold = 100
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold
  }

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }

  // When channel changes, reset state; scroll happens when messages load
  useEffect(() => {
    lastMessageCountRef.current = 0
    firstNewMessageIdRef.current = null
    setHasNewMessages(false)
  }, [channel.id])

  // Initial load or when no prev messages: scroll to bottom
  useEffect(() => {
    if (messages.length === 0) return
    if (lastMessageCountRef.current === 0) {
      lastMessageCountRef.current = messages.length
      scrollToBottom('auto')
      return
    }
    const prevCount = lastMessageCountRef.current
    if (messages.length > prevCount) {
      if (isAtBottom()) {
        lastMessageCountRef.current = messages.length
        scrollToBottom('smooth')
      } else {
        setHasNewMessages(true)
        firstNewMessageIdRef.current = messages[prevCount]?.id ?? null
      }
    }
  }, [messages])

  const handleScroll = () => {
    if (isAtBottom() && hasNewMessages) {
      setHasNewMessages(false)
      firstNewMessageIdRef.current = null
      lastMessageCountRef.current = messages.length
    }
  }

  const jumpToNewMessages = () => {
    const id = firstNewMessageIdRef.current
    if (id) {
      document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      scrollToBottom('smooth')
    }
    setHasNewMessages(false)
    firstNewMessageIdRef.current = null
    lastMessageCountRef.current = messages.length
  }

  const getUser = (userId: string) => users.find((u) => u.id === userId) ?? { username: 'Unknown', id: userId }
  const getMemberAvatar = (userId: string) => members.find((m) => m.id === userId)?.avatarUrl

  const handleEdit = (msg: Message) => {
    setEditingId(msg.id)
    setEditContent(msg.content)
  }

  const saveEdit = async () => {
    if (!editingId || !editContent.trim()) return
    await editMessage(editingId, editContent.trim())
    setEditingId(null)
    setEditContent('')
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    setUploading(true)
    try {
      for (let i = 0; i < files.length; i++) {
        const { url } = await api.uploadFile(files[i])
        const type = files[i].type.startsWith('image/')
        ? 'image'
        : files[i].type.startsWith('video/')
          ? 'video'
          : 'file'
        setAttachments((prev) => [...prev, { url, type, filename: files[i].name }])
      }
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
      e.target.value = ''
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

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx))
  }

  const canEditOrDelete = (msg: Message) => msg.userId === currentUserId || isAdminOrOwner

  const groupedReactions = (reactions: { userId: string; emoji: string }[] = []) => {
    const map = new Map<string, { count: number; userIds: string[] }>()
    reactions.forEach((r) => {
      const key = r.emoji
      const cur = map.get(key) || { count: 0, userIds: [] }
      if (!cur.userIds.includes(r.userId)) {
        cur.count++
        cur.userIds.push(r.userId)
      }
      map.set(key, cur)
    })
    return Array.from(map.entries()).map(([emoji, { count, userIds }]) => ({ emoji, count, userIds }))
  }

  const [showAttachMenu, setShowAttachMenu] = useState(false)

  const formatChatTime = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    if (d.toDateString() === now.toDateString()) return time
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === yesterday.toDateString()) return `Yesterday at ${time}`
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` at ${time}`
  }

  return (
    <div className="chat-shell flex-1 flex flex-col min-w-0">
      <div className="chat-header-modern h-12 px-4 flex items-center gap-2 flex-shrink-0 z-10">
        {channel.type === 'rules' ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-app-offline">
            <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
            <path d="M9 15h6v2H9zm0-4h6v2H9zm0-4h3v2H9z"/>
          </svg>
        ) : (
          <span className="text-2xl font-semibold text-app-offline leading-none">#</span>
        )}
        <span className="font-display font-semibold text-app-text text-[16px]">{channel.name}</span>
        {channel.type === 'rules' && (
          <span className="ml-1 text-xs text-app-muted">(read-only — react to accept)</span>
        )}
      </div>

      <div
        ref={scrollRef}
        className="scrollbar-thin flex-1 overflow-y-auto relative min-h-0 py-4"
        onScroll={handleScroll}
      >
        {messages.map((message, idx) => {
          const user = getUser(message.userId)
          const username = message.username ?? user.username
          const isEditing = editingId === message.id
          const prev = messages[idx - 1]
          const isGrouped =
            !!prev &&
            prev.userId === message.userId &&
            new Date(message.createdAt).toDateString() === new Date(prev.createdAt).toDateString() &&
            new Date(message.createdAt).getTime() - new Date(prev.createdAt).getTime() < 7 * 60 * 1000
          const showDateSep =
            !prev || new Date(message.createdAt).toDateString() !== new Date(prev.createdAt).toDateString()

          return (
            <div key={message.id}>
              {showDateSep && (
                <div className="flex items-center gap-3 mx-5 my-5">
                  <div className="flex-1 h-px bg-app-glass/[0.07]" />
                  <span className="text-[10px] font-semibold text-app-muted uppercase tracking-[0.12em]">
                    {new Date(message.createdAt).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                  <div className="flex-1 h-px bg-app-glass/[0.07]" />
                </div>
              )}
              <div
                id={`msg-${message.id}`}
                className={`chat-msg-row chat-message-modern group relative flex gap-3.5 px-5 ${
                  isGrouped ? 'min-h-[1.375rem]' : 'mt-3'
                }`}
              >
                {/* Hover action bar */}
                <div className="absolute right-5 -top-3 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 max-lg:opacity-100 z-10 flex items-center bg-app-panel/95 border border-app-glass/[0.08] rounded-lg shadow-xl overflow-hidden backdrop-blur">
                  <button
                    type="button"
                    onClick={() => setReplyTo(message)}
                    className="px-2 py-1 text-xs text-app-muted hover:bg-app-hover hover:text-white"
                  >
                    Reply
                  </button>
                  {canEditOrDelete(message) && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleEdit(message)}
                        className="px-2 py-1 text-xs text-app-muted hover:bg-app-hover hover:text-white"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMessage(message.id)}
                        className="px-2 py-1 text-xs text-[#f23f43] hover:bg-app-hover"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>

                {isGrouped ? (
                  <div className="w-10 flex-shrink-0 flex justify-center pt-0.5">
                    <span className="text-[10px] text-app-muted opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 max-lg:opacity-100 leading-5">
                      {new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                ) : (
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden mt-0.5 ${getMemberAvatar(message.userId) ? 'bg-transparent' : 'bg-app-accent'}`}>
                    {getMemberAvatar(message.userId) ? (
                      <img src={getMemberAvatar(message.userId)} alt={username} className="w-full h-full object-cover" />
                    ) : (
                      username.charAt(0)
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  {!isGrouped && (
                    <div className="flex items-baseline gap-2 flex-wrap leading-tight">
                      <span className="font-semibold text-app-text text-[15px]">{username}</span>
                      <span className="text-[11px] tabular-nums text-app-muted/80">
                        {formatChatTime(message.createdAt)}
                        {message.editedAt && ' (edited)'}
                      </span>
                    </div>
                  )}

                  {message.replyTo && (
                    <div
                      className="mt-1 mb-0.5 flex items-center gap-1 text-sm text-app-muted cursor-pointer hover:text-app-text before:content-[''] before:block before:w-0.5 before:h-3 before:bg-app-hover before:rounded before:mr-1"
                      onClick={() => {
                        const el = document.getElementById(`msg-${message.replyToId}`)
                        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <span className="font-medium text-app-accent">{message.replyTo.username ?? 'Unknown'}</span>
                      <span className="truncate max-w-md">{message.replyTo.content || '[deleted]'}</span>
                    </div>
                  )}

                  {isEditing ? (
                    <div className="mt-1">
                      <input
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && saveEdit()}
                        className="w-full bg-app-hover rounded px-2 py-1.5 text-app-text outline-none"
                        autoFocus
                      />
                      <div className="mt-1 flex gap-2 text-xs">
                        <button onClick={saveEdit} className="text-[#00a8fc] hover:underline">save</button>
                        <button onClick={() => { setEditingId(null); setEditContent('') }} className="text-[#00a8fc] hover:underline">cancel</button>
                      </div>
                    </div>
                  ) : (
                    <MessageContent
                      content={message.content}
                      currentUsername={currentUsername}
                      highlightMentions
                      className={isGrouped ? '' : 'mt-0.5'}
                    />
                  )}

                  {message.attachments?.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {message.attachments.map((a, i) => (
                        <FileAttachment
                          key={i}
                          url={a.url}
                          type={a.type}
                          filename={a.filename}
                        />
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-1 flex flex-wrap gap-1 items-center">
                    {groupedReactions(message.reactions).map(({ emoji, count, userIds }) => {
                      const customEmoji = emoji.startsWith(':') && emoji.endsWith(':')
                        ? serverEmojis.find((e) => `:${e.name}:` === emoji)
                        : null
                      return (
                        <button
                          key={emoji}
                          onClick={async () => {
                            await toggleReaction(message.id, emoji)
                            onAfterReaction?.()
                          }}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-sm border ${
                            userIds.includes(currentUserId)
                              ? 'bg-app-accent/25 border-app-accent/50 text-app-text'
                              : 'bg-app-channel border-transparent text-app-muted hover:border-app-hover'
                          }`}
                        >
                          {customEmoji ? (
                            <img src={customEmoji.image_url} alt={customEmoji.name} className="w-4 h-4 object-contain" />
                          ) : (
                            emoji
                          )}
                          {count > 1 && <span className="text-xs">{count}</span>}
                        </button>
                      )
                    })}
                    <button
                      onClick={(e) => {
                        if (showEmojiPicker === message.id) {
                          setShowEmojiPicker(null)
                          setEmojiAnchorRect(null)
                        } else {
                          setShowEmojiPicker(message.id)
                          setEmojiAnchorRect(e.currentTarget.getBoundingClientRect())
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 max-lg:opacity-100 text-app-muted hover:text-white text-sm px-1"
                    >
                      🙂
                    </button>
                    {showEmojiPicker === message.id && (
                      <EmojiPicker
                        anchorRect={emojiAnchorRect ?? undefined}
                        serverEmojis={serverEmojis}
                        onSelect={async (emoji) => {
                          await toggleReaction(message.id, emoji)
                          onAfterReaction?.()
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
        <div ref={messagesEndRef} />
        {hasNewMessages && (
          <button
            onClick={jumpToNewMessages}
            className="sticky bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-app-accent text-white text-sm font-medium shadow-lg hover:bg-app-accent-hover transition-colors flex items-center gap-2"
          >
            <span>New messages</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
            </svg>
          </button>
        )}
      </div>

      {canSendMessages && (
      <form
        className="chat-composer-wrap px-4 sm:px-5 pb-5 pt-3 flex-shrink-0"
        onSubmit={(e) => {
          e.preventDefault()
          const text = input.trim()
          const hasAttach = attachments.length > 0
          if ((text || hasAttach) && onSendMessage) {
            stopTyping()
            onSendMessage(text || ' ', { replyToId: replyTo?.id, attachments: attachments.length ? attachments : undefined })
            setInput('')
            setReplyTo(null)
            setAttachments([])
          }
        }}
      >
        {replyTo && (
          <div className="mb-2 flex items-start gap-2 px-3 py-2 rounded-t-lg bg-app-channel border-l-2 border-app-accent text-sm">
            <div className="flex-1 min-w-0">
              <span className="text-app-accent font-medium">Replying to {replyTo.username ?? getUser(replyTo.userId).username}</span>
              <p className="text-app-muted mt-0.5 truncate max-w-md">{replyTo.content || '[no preview]'}</p>
            </div>
            <button type="button" onClick={() => setReplyTo(null)} className="text-app-muted hover:text-white p-1">×</button>
          </div>
        )}
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2 px-1">
            {attachments.map((a, i) => (
              <div key={i} className="relative bg-app-channel rounded-lg p-2">
                {a.type === 'image' ? (
                  <img src={a.url} alt="" className="max-w-[80px] max-h-[60px] rounded object-cover" />
                ) : a.type === 'video' ? (
                  <span className="text-xs text-app-muted">🎬 {a.filename}</span>
                ) : (
                  <span className="text-xs text-app-muted">📎 {a.filename}</span>
                )}
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
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
          accept="image/*,.gif,.webp,.pdf,.txt,video/mp4,video/webm,video/quicktime,video/*"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <ChatInput
          value={input}
          onChange={(value) => {
            setInput(value)
            if (value.trim()) notifyTyping()
            else stopTyping()
          }}
          onSubmit={() => {
            const text = input.trim()
            const hasAttach = attachments.length > 0
            if ((text || hasAttach) && onSendMessage) {
              stopTyping()
              onSendMessage(text || ' ', { replyToId: replyTo?.id, attachments: attachments.length ? attachments : undefined })
              setInput('')
              setReplyTo(null)
              setAttachments([])
            }
          }}
          placeholder={channel.type === 'rules' ? 'Add server rules...' : `Message #${channel.name}`}
          disabled={!onSendMessage}
          members={members}
          serverEmojis={serverEmojis}
          uploading={uploading}
          onAttachClick={() => setShowAttachMenu((v) => !v)}
          attachOpen={showAttachMenu}
          attachMenu={
            showAttachMenu ? (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowAttachMenu(false)} />
                <div className="absolute left-0 bottom-full mb-2 py-2 z-50 bg-app-darker rounded-lg shadow-xl border border-white/10 min-w-[180px]">
                  <button
                    type="button"
                    onClick={() => {
                      fileInputRef.current?.click()
                      setShowAttachMenu(false)
                    }}
                    disabled={uploading}
                    className="w-full px-3 py-2 text-left text-sm text-app-text hover:bg-app-accent hover:text-white"
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
                  if (showInputEmojiPicker) {
                    setShowInputEmojiPicker(false)
                    setInputEmojiAnchorRect(null)
                  } else {
                    setShowInputEmojiPicker(true)
                    setInputEmojiAnchorRect(e.currentTarget.getBoundingClientRect())
                  }
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-app-muted hover:text-white"
                title="Emoji"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-4.5-7.5c.83 0 1.5-.67 1.5-1.5S8.33 9.5 7.5 9.5 6 10.17 6 11s.67 1.5 1.5 1.5zm9 0c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5zM12 17.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
                </svg>
              </button>
              {showInputEmojiPicker && (
                <EmojiPicker
                  anchorRect={inputEmojiAnchorRect ?? undefined}
                  serverEmojis={serverEmojis}
                  onSelect={(emoji) => { setInput((i) => i + emoji); setShowInputEmojiPicker(false); setInputEmojiAnchorRect(null) }}
                  onClose={() => { setShowInputEmojiPicker(false); setInputEmojiAnchorRect(null) }}
                />
              )}
            </>
          }
        />
        <TypingIndicator users={typingUsers} />
      </form>
      )}
      {showGifPicker && (
        <GifPicker userId={currentUserId} onSelect={handleGifSelect} onClose={() => setShowGifPicker(false)} />
      )}
      {!canSendMessages && channel.type === 'rules' && messages.length === 0 && (
        <div className="px-4 pb-6 text-center text-app-muted text-sm">
          No rules have been set up yet. Contact the server owner or admin to add rules.
        </div>
      )}
    </div>
  )
}
