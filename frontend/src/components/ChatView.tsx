import { useState, useRef } from 'react'
import type { Channel, Message, User } from '../types'
import { useApp } from '../contexts/AppContext'
import * as api from '../services/api'
import { EmojiPicker } from './EmojiPicker'

interface ServerEmoji {
  id: string
  name: string
  image_url: string
}

interface ChatViewProps {
  channel: Channel
  messages: Message[]
  users: User[]
  serverEmojis?: ServerEmoji[]
  onSendMessage?: (content: string, options?: { replyToId?: string; attachments?: { url: string; type: string; filename?: string }[] }) => void
  currentUserId: string
  isAdminOrOwner?: boolean
}

export function ChatView({
  channel,
  messages,
  users,
  serverEmojis = [],
  onSendMessage,
  currentUserId,
  isAdminOrOwner = false,
}: ChatViewProps) {
  const { editMessage, deleteMessage, toggleReaction } = useApp()
  const [input, setInput] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [attachments, setAttachments] = useState<{ url: string; type: string; filename?: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null)
  const [showInputEmojiPicker, setShowInputEmojiPicker] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getUser = (userId: string) => users.find((u) => u.id === userId) ?? { username: 'Unknown', id: userId }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (text && onSendMessage) {
      onSendMessage(text, { replyToId: replyTo?.id, attachments: attachments.length ? attachments : undefined })
      setInput('')
      setReplyTo(null)
      setAttachments([])
    }
  }

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

  return (
    <div className="flex-1 flex flex-col bg-app-darker">
      <div className="h-12 px-4 flex items-center border-b border-app-dark shadow-sm">
        <span className="text-xl text-app-muted">#</span>
        <span className="ml-2 font-semibold text-app-text">{channel.name}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message) => {
          const user = getUser(message.userId)
          const username = message.username ?? user.username
          const isEditing = editingId === message.id

          return (
            <div
              id={`msg-${message.id}`}
              key={message.id}
              className="group flex gap-3 py-1.5 hover:bg-app-dark/50 rounded px-2 -mx-2 transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-app-accent flex items-center justify-center text-white font-bold flex-shrink-0">
                {username.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-semibold text-app-text">{username}</span>
                  <span className="text-xs text-app-muted">
                    {new Date(message.createdAt).toLocaleString()}
                    {message.editedAt && ' (edited)'}
                  </span>
                  <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                    <button
                      onClick={() => setReplyTo(message)}
                      className="text-xs text-app-muted hover:text-app-text"
                    >
                      Reply
                    </button>
                    {canEditOrDelete(message) && (
                      <>
                        <button
                          onClick={() => handleEdit(message)}
                          className="text-xs text-app-muted hover:text-app-text"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteMessage(message.id)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {message.replyTo && (
                  <div
                    className="mt-1 pl-3 border-l-2 border-app-accent/50 text-sm text-app-muted cursor-pointer hover:bg-app-dark/30 rounded-r -ml-2 pl-4 py-1 transition-colors"
                    onClick={() => {
                      const el = document.getElementById(`msg-${message.replyToId}`)
                      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      el?.classList.add('ring-2', 'ring-app-accent', 'ring-opacity-50')
                      setTimeout(() => el?.classList.remove('ring-2', 'ring-app-accent', 'ring-opacity-50'), 1500)
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLElement).click()}
                  >
                    <span className="font-medium text-app-accent">Reply to {message.replyTo.username ?? 'Unknown'}</span>
                    <span className="block mt-0.5 text-app-muted truncate max-w-md">
                      {message.replyTo.content || '[deleted message]'}
                    </span>
                  </div>
                )}

                {isEditing ? (
                  <div className="mt-1">
                    <input
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && saveEdit()}
                      className="w-full bg-app-dark rounded px-2 py-1 text-app-text"
                      autoFocus
                    />
                    <div className="mt-1 flex gap-2">
                      <button
                        onClick={saveEdit}
                        className="text-xs px-2 py-1 rounded bg-app-accent text-white hover:bg-app-accent-hover"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setEditContent('') }}
                        className="text-xs px-2 py-1 rounded bg-app-channel text-app-muted hover:bg-app-hover"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-app-text mt-0.5 whitespace-pre-wrap">{message.content}</p>
                )}

                {message.attachments?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {message.attachments.map((a, i) =>
                      a.type === 'video' || a.url.match(/\.(mp4|webm|mov|avi)$/i) ? (
                        <video
                          key={i}
                          src={a.url}
                          controls
                          className="max-w-[300px] max-h-[200px] rounded"
                          preload="metadata"
                        />
                      ) : a.type === 'image' || a.url.match(/\.(gif|jpe?g|png|webp|svg)$/i) ? (
                        <a key={i} href={a.url} target="_blank" rel="noreferrer">
                          <img src={a.url} alt="" className="max-w-[300px] max-h-[200px] rounded object-contain" />
                        </a>
                      ) : (
                        <a
                          key={i}
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-app-accent hover:underline"
                        >
                          📎 {a.filename || 'attachment'}
                        </a>
                      )
                    )}
                  </div>
                ) : null}

                {/* Reactions */}
                <div className="mt-1 flex flex-wrap gap-1 flex items-center">
                  {groupedReactions(message.reactions).map(({ emoji, count, userIds }) => {
                    const customEmoji = emoji.startsWith(':') && emoji.endsWith(':')
                      ? serverEmojis.find((e) => `:${e.name}:` === emoji)
                      : null
                    return (
                      <button
                        key={emoji}
                        onClick={() => toggleReaction(message.id, emoji)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-sm ${
                          userIds.includes(currentUserId) ? 'bg-app-accent/30 text-app-accent' : 'bg-app-dark text-app-muted hover:bg-app-hover'
                        }`}
                      >
                        {customEmoji ? (
                          <img src={customEmoji.image_url} alt={customEmoji.name} className="w-4 h-4 object-contain" />
                        ) : (
                          emoji
                        )}
                        {count > 1 && <span>{count}</span>}
                      </button>
                    )
                  })}
                  <div className="relative">
                    <button
                      onClick={() => setShowEmojiPicker(showEmojiPicker === message.id ? null : message.id)}
                      className="opacity-0 group-hover:opacity-100 text-app-muted hover:text-app-text transition-opacity"
                    >
                      +
                    </button>
                    {showEmojiPicker === message.id && (
                      <div className="absolute left-0 bottom-full mb-1 z-50">
                        <EmojiPicker
                          serverEmojis={serverEmojis}
                          onSelect={(emoji) => { toggleReaction(message.id, emoji); setShowEmojiPicker(null) }}
                          onClose={() => setShowEmojiPicker(null)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <form className="p-4 border-t border-app-dark" onSubmit={handleSubmit}>
        {replyTo && (
          <div className="mb-2 flex items-start gap-2 p-2 rounded bg-app-dark/50 border-l-2 border-app-accent text-sm">
            <div className="flex-1 min-w-0">
              <span className="text-app-accent font-medium">Replying to {replyTo.username ?? getUser(replyTo.userId).username}</span>
              <p className="text-app-muted mt-0.5 truncate max-w-md">{replyTo.content || '[no preview]'}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="text-red-400 hover:text-red-300 p-1">×</button>
          </div>
        )}
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((a, i) => (
              <div key={i} className="relative">
                {a.type === 'image' ? (
                  <img src={a.url} alt="" className="max-w-[80px] max-h-[60px] rounded object-cover" />
                ) : a.type === 'video' ? (
                  <span className="text-xs text-app-muted">🎬 {a.filename}</span>
                ) : (
                  <span className="text-xs text-app-muted">📎 {a.filename}</span>
                )}
                <button
                  onClick={() => removeAttachment(i)}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-xs"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.gif,.webp,.pdf,.txt,video/mp4,video/webm,video/quicktime,video/*"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-2 text-app-muted hover:text-app-text disabled:opacity-50"
            title="Upload file"
          >
            {uploading ? '⏳' : '📎'}
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowInputEmojiPicker(!showInputEmojiPicker)}
              className="p-2 text-app-muted hover:text-app-text"
              title="Add emoji"
            >
              😀
            </button>
            {showInputEmojiPicker && (
              <div className="absolute left-0 bottom-full mb-1 z-50">
                <EmojiPicker
                  serverEmojis={serverEmojis}
                  onSelect={(emoji) => { setInput((i) => i + emoji); setShowInputEmojiPicker(false) }}
                  onClose={() => setShowInputEmojiPicker(false)}
                />
              </div>
            )}
          </div>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Message #${channel.name}`}
            className="flex-1 bg-app-dark rounded-lg px-4 py-3 text-app-text placeholder-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-4 py-2 rounded-lg bg-app-accent text-white font-medium hover:bg-app-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
