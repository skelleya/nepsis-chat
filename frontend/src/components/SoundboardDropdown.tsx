import { useState, useEffect, useRef } from 'react'
import * as api from '../services/api'
import { EmojiPicker } from './EmojiPicker'
import { useGsapMenu } from '../hooks/useGsapMenu'
import { clipAudioToWav } from '../utils/audioClip'

const MAX_DURATION_SECONDS = 10
const DEFAULT_EMOJI = '🔊'

interface SoundboardDropdownProps {
  userId: string
  /** When set, sounds are shared with every member of this server. */
  serverId?: string
  /** Current user can delete others' sounds when admin/owner. */
  canModerate?: boolean
  onPlay: (soundUrl: string) => void
  anchorRef: React.RefObject<HTMLButtonElement | null>
  isOpen: boolean
  onClose: () => void
}

function defaultNameFromFile(file: File) {
  return file.name.replace(/\.[^/.]+$/, '').replace(/-clip$/i, '').trim().slice(0, 48) || 'Sound'
}

export function SoundboardDropdown({
  userId,
  serverId,
  canModerate = false,
  onPlay,
  anchorRef,
  isOpen,
  onClose,
}: SoundboardDropdownProps) {
  const [sounds, setSounds] = useState<api.SoundboardSound[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emojiForNew, setEmojiForNew] = useState(DEFAULT_EMOJI)
  const [nameForNew, setNameForNew] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [emojiPickerFor, setEmojiPickerFor] = useState<string | 'new' | null>(null)
  const [emojiAnchorRect, setEmojiAnchorRect] = useState<DOMRect | null>(null)
  const [clipSource, setClipSource] = useState<{ file: File; url: string; duration: number } | null>(null)
  const [clipStart, setClipStart] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLAudioElement | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const shouldRender = useGsapMenu(isOpen, dropdownRef, {
    enterY: 10,
    exitY: 8,
    transformOrigin: 'bottom center',
  })

  const fetchSounds = async () => {
    setLoading(true)
    try {
      const data = await api.getSoundboardSounds(userId, { serverId })
      setSounds(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sounds')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && userId) void fetchSounds()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, userId, serverId])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target
      if (
        isOpen &&
        dropdownRef.current &&
        anchorRef.current &&
        target instanceof Node &&
        !dropdownRef.current.contains(target) &&
        !anchorRef.current.contains(target)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose, anchorRef])

  useEffect(() => () => {
    if (clipSource) URL.revokeObjectURL(clipSource.url)
    previewRef.current?.pause()
  }, [clipSource])

  useEffect(() => {
    if (editingId) renameInputRef.current?.focus()
  }, [editingId])

  const resetComposer = () => {
    setPendingFile(null)
    setNameForNew('')
    setEmojiForNew(DEFAULT_EMOJI)
  }

  const handleAddClick = () => fileInputRef.current?.click()

  const uploadSound = async (file: File, displayName: string) => {
    setAdding(true)
    try {
      const sound = await api.uploadSoundboardSound(userId, displayName.trim() || defaultNameFromFile(file), file, {
        emoji: emojiForNew,
        serverId,
      })
      setSounds((prev) => [...prev.filter((s) => s.id !== sound.id), sound])
      resetComposer()
      setError(null)
    } finally {
      setAdding(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    const audio = new Audio()
    audio.src = URL.createObjectURL(file)

    const checkDuration = (): Promise<number> =>
      new Promise((resolve, reject) => {
        audio.onloadedmetadata = () => {
          URL.revokeObjectURL(audio.src)
          resolve(audio.duration)
        }
        audio.onerror = () => reject(new Error('Could not read audio file'))
      })

    try {
      const duration = await checkDuration()
      if (!Number.isFinite(duration) || duration <= 0) {
        setError('Could not read audio duration. Try converting the file to MP3 or WAV.')
        e.target.value = ''
        return
      }
      if (duration > MAX_DURATION_SECONDS) {
        const url = URL.createObjectURL(file)
        setClipSource({ file, url, duration })
        setClipStart(0)
        setPendingFile(null)
        setNameForNew(defaultNameFromFile(file))
        e.target.value = ''
        return
      }

      setPendingFile(file)
      setNameForNew(defaultNameFromFile(file))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      e.target.value = ''
    }
  }

  const previewClip = () => {
    previewRef.current?.pause()
    const audio = new Audio(clipSource?.url)
    previewRef.current = audio
    audio.currentTime = clipStart
    void audio.play()
    window.setTimeout(() => audio.pause(), MAX_DURATION_SECONDS * 1000)
  }

  const saveClip = async () => {
    if (!clipSource) return
    setError(null)
    try {
      setAdding(true)
      const clipped = await clipAudioToWav(clipSource.file, clipStart, MAX_DURATION_SECONDS)
      URL.revokeObjectURL(clipSource.url)
      setClipSource(null)
      setClipStart(0)
      setPendingFile(clipped)
      if (!nameForNew.trim()) setNameForNew(defaultNameFromFile(clipSource.file))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create clip')
    } finally {
      setAdding(false)
    }
  }

  const confirmUpload = async () => {
    if (!pendingFile) return
    const label = nameForNew.trim()
    if (!label) {
      setError('Give this sound a name')
      return
    }
    try {
      await uploadSound(pendingFile, label)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  const canEditSound = (sound: api.SoundboardSound) =>
    sound.user_id === userId || canModerate

  const handleUpdateEmoji = async (soundId: string, emoji: string) => {
    try {
      const updated = await api.updateSoundboardSound(userId, soundId, { emoji, serverId })
      setSounds((prev) => prev.map((s) => (s.id === soundId ? { ...s, ...updated } : s)))
      setEmojiPickerFor(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update emoji')
    }
  }

  const startRename = (sound: api.SoundboardSound) => {
    if (!canEditSound(sound)) return
    setEditingId(sound.id)
    setEditingName(sound.name)
  }

  const saveRename = async () => {
    if (!editingId) return
    const next = editingName.trim()
    if (!next) {
      setError('Name cannot be empty')
      return
    }
    try {
      const updated = await api.updateSoundboardSound(userId, editingId, { name: next, serverId })
      setSounds((prev) => prev.map((s) => (s.id === editingId ? { ...s, ...updated } : s)))
      setEditingId(null)
      setEditingName('')
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename sound')
    }
  }

  const handleDelete = async (soundId: string) => {
    try {
      await api.deleteSoundboardSound(userId, soundId)
      setSounds((prev) => prev.filter((s) => s.id !== soundId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const shareLegacyToServer = async (sound: api.SoundboardSound) => {
    if (!serverId || sound.server_id || sound.user_id !== userId) return
    try {
      const updated = await api.updateSoundboardSound(userId, sound.id, {
        name: sound.name,
        serverId,
      })
      setSounds((prev) => prev.map((s) => (s.id === sound.id ? { ...s, ...updated } : s)))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share sound')
    }
  }

  if (!shouldRender) return null

  return (
    <div
      ref={dropdownRef}
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[22rem] max-h-[26rem] overflow-hidden rounded-2xl bg-app-channel border border-app-hover/80 shadow-2xl shadow-black/40 z-50 flex flex-col"
    >
      <div className="px-3 pt-3 pb-2 border-b border-app-hover/70">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-app-text text-sm">Soundboard</p>
            <p className="text-[11px] text-app-muted leading-snug mt-0.5">
              {serverId
                ? 'Custom-named sounds appear for everyone in this server.'
                : 'Add short clips to play in voice.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddClick}
            disabled={adding || !!pendingFile || !!clipSource}
            className="shrink-0 px-2.5 py-1 rounded-md text-xs font-medium bg-app-accent hover:bg-app-accent-hover text-white disabled:opacity-50"
          >
            + Add
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,.wav,.ogg,.webm,.m4a,.mp4,.aac,.flac,audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/webm,audio/mp4,audio/aac,audio/flac"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="p-2.5 overflow-y-auto flex-1 space-y-2">
        {clipSource && (
          <div className="rounded-xl border border-app-accent/35 bg-app-dark/80 p-3 space-y-2">
            <div>
              <p className="text-sm font-semibold text-app-text">Trim to 10 seconds</p>
              <p className="text-xs text-app-muted truncate">{clipSource.file.name}</p>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(0, clipSource.duration - MAX_DURATION_SECONDS)}
              step={0.1}
              value={clipStart}
              onChange={(event) => setClipStart(Number(event.target.value))}
              className="w-full accent-[rgb(var(--app-accent))]"
              aria-label="Clip start time"
            />
            <p className="text-[11px] text-app-muted">
              {clipStart.toFixed(1)}s – {Math.min(clipStart + 10, clipSource.duration).toFixed(1)}s
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={previewClip} className="flex-1 px-2 py-1.5 rounded-md text-xs bg-app-hover text-app-text">
                Preview
              </button>
              <button type="button" disabled={adding} onClick={() => void saveClip()} className="flex-1 px-2 py-1.5 rounded-md text-xs bg-app-accent text-white disabled:opacity-50">
                {adding ? 'Clipping…' : 'Continue'}
              </button>
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(clipSource.url)
                  setClipSource(null)
                }}
                className="px-2 py-1.5 rounded-md text-xs text-app-muted hover:text-app-text"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {pendingFile && !clipSource && (
          <div className="rounded-xl border border-app-hover bg-app-dark/80 p-3 space-y-2.5">
            <p className="text-sm font-semibold text-app-text">Name this sound</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  if (emojiPickerFor === 'new') {
                    setEmojiPickerFor(null)
                    setEmojiAnchorRect(null)
                  } else {
                    setEmojiPickerFor('new')
                    setEmojiAnchorRect(e.currentTarget.getBoundingClientRect())
                  }
                }}
                className="w-10 h-10 rounded-xl bg-app-channel text-xl flex items-center justify-center hover:bg-app-hover shrink-0"
                title="Pick emoji"
              >
                {emojiForNew}
              </button>
              {emojiPickerFor === 'new' && (
                <EmojiPicker
                  anchorRect={emojiAnchorRect ?? undefined}
                  onSelect={(emoji) => {
                    setEmojiForNew(emoji)
                    setEmojiPickerFor(null)
                    setEmojiAnchorRect(null)
                  }}
                  onClose={() => {
                    setEmojiPickerFor(null)
                    setEmojiAnchorRect(null)
                  }}
                />
              )}
              <input
                value={nameForNew}
                onChange={(e) => setNameForNew(e.target.value.slice(0, 48))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void confirmUpload()
                  }
                }}
                maxLength={48}
                placeholder="Custom name"
                className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-app-channel border border-app-hover text-sm text-app-text placeholder:text-app-muted focus:outline-none focus:border-app-accent"
              />
            </div>
            <p className="text-[11px] text-app-muted truncate">File: {pendingFile.name}</p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={adding}
                onClick={() => void confirmUpload()}
                className="flex-1 px-2 py-1.5 rounded-md text-xs font-medium bg-app-accent text-white disabled:opacity-50"
              >
                {adding ? 'Uploading…' : serverId ? 'Add to server' : 'Save sound'}
              </button>
              <button
                type="button"
                disabled={adding}
                onClick={resetComposer}
                className="px-2 py-1.5 rounded-md text-xs text-app-muted hover:text-app-text"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {error && <p className="text-red-400 text-xs px-0.5">{error}</p>}

        {loading ? (
          <p className="text-app-muted text-sm py-6 text-center">Loading…</p>
        ) : sounds.length === 0 && !pendingFile && !clipSource ? (
          <div className="py-8 px-3 text-center space-y-1">
            <p className="text-sm text-app-text font-medium">No sounds yet</p>
            <p className="text-xs text-app-muted">
              Add a clip (max 10s) with a custom name
              {serverId ? ' — it shows for all server members.' : '.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-1">
            {sounds.map((s) => {
              const editable = canEditSound(s)
              const isEditing = editingId === s.id
              return (
                <div
                  key={s.id}
                  className="group flex items-center gap-2 rounded-xl px-1.5 py-1.5 hover:bg-app-hover/40 transition-colors"
                >
                  <button
                    type="button"
                    disabled={!editable}
                    onClick={(e) => {
                      if (!editable) return
                      if (emojiPickerFor === s.id) {
                        setEmojiPickerFor(null)
                        setEmojiAnchorRect(null)
                      } else {
                        setEmojiPickerFor(s.id)
                        setEmojiAnchorRect(e.currentTarget.getBoundingClientRect())
                      }
                    }}
                    className={`w-9 h-9 rounded-xl bg-app-dark text-lg flex items-center justify-center shrink-0 ${
                      editable ? 'hover:bg-app-hover' : 'opacity-90 cursor-default'
                    }`}
                    title={editable ? 'Change emoji' : s.name}
                  >
                    {s.emoji || DEFAULT_EMOJI}
                  </button>
                  {emojiPickerFor === s.id && (
                    <EmojiPicker
                      anchorRect={emojiAnchorRect ?? undefined}
                      onSelect={(emoji) => {
                        void handleUpdateEmoji(s.id, emoji)
                        setEmojiAnchorRect(null)
                      }}
                      onClose={() => {
                        setEmojiPickerFor(null)
                        setEmojiAnchorRect(null)
                      }}
                    />
                  )}

                  {isEditing ? (
                    <div className="flex-1 min-w-0 flex items-center gap-1.5">
                      <input
                        ref={renameInputRef}
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value.slice(0, 48))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            void saveRename()
                          }
                          if (e.key === 'Escape') {
                            setEditingId(null)
                            setEditingName('')
                          }
                        }}
                        maxLength={48}
                        className="flex-1 min-w-0 px-2 py-1.5 rounded-md bg-app-dark border border-app-accent text-sm text-app-text focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void saveRename()}
                        className="px-2 py-1 rounded-md text-[11px] bg-app-accent text-white"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onPlay(s.url)}
                      onDoubleClick={() => startRename(s)}
                      className="flex-1 min-w-0 text-left rounded-lg px-2 py-1.5 hover:bg-app-dark/70 transition-colors"
                      title="Click to play · double-click to rename"
                    >
                      <span className="block text-sm text-app-text font-medium truncate">{s.name}</span>
                      <span className="block text-[11px] text-app-muted">
                        {Number(s.duration_seconds).toFixed(1)}s
                        {!s.server_id && serverId ? ' · only you' : ''}
                      </span>
                    </button>
                  )}

                  {!s.server_id && serverId && s.user_id === userId && !isEditing && (
                    <button
                      type="button"
                      onClick={() => void shareLegacyToServer(s)}
                      className="shrink-0 px-2 py-1 rounded-md text-[11px] font-medium bg-app-accent/20 text-app-accent hover:bg-app-accent hover:text-white transition-colors"
                      title="Share with everyone in this server"
                    >
                      Share
                    </button>
                  )}

                  {editable && !isEditing && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        type="button"
                        onClick={() => startRename(s)}
                        className="p-1.5 rounded-md text-app-muted hover:text-app-text hover:bg-app-hover"
                        title="Rename"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(s.id)}
                        className="p-1.5 rounded-md text-app-muted hover:text-red-400 hover:bg-red-900/30"
                        title="Delete"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
