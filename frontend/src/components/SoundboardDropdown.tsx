import { useState, useEffect, useRef } from 'react'
import * as api from '../services/api'
import { EmojiPicker } from './EmojiPicker'

const MAX_DURATION_SECONDS = 10
const DEFAULT_EMOJI = '🔊'

interface SoundboardDropdownProps {
  userId: string
  onPlay: (soundUrl: string) => void
  anchorRef: React.RefObject<HTMLButtonElement | null>
  isOpen: boolean
  onClose: () => void
}

export function SoundboardDropdown({ userId, onPlay, anchorRef, isOpen, onClose }: SoundboardDropdownProps) {
  const [sounds, setSounds] = useState<api.SoundboardSound[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emojiForNew, setEmojiForNew] = useState(DEFAULT_EMOJI)
  const [emojiPickerFor, setEmojiPickerFor] = useState<string | 'new' | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchSounds = async () => {
    setLoading(true)
    try {
      const data = await api.getSoundboardSounds(userId)
      setSounds(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sounds')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && userId) fetchSounds()
  }, [isOpen, userId])

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

  const handleAddClick = () => fileInputRef.current?.click()

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
      if (duration > MAX_DURATION_SECONDS) {
        setError(`Audio must be 10 seconds or less. Yours is ${duration.toFixed(1)}s.`)
        e.target.value = ''
        return
      }

      setAdding(true)
      const name = file.name.replace(/\.[^/.]+$/, '').slice(0, 32) || 'Sound'
      const sound = await api.uploadSoundboardSound(userId, name, file, emojiForNew)
      setSounds((prev) => [...prev, sound])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setAdding(false)
      e.target.value = ''
    }
  }

  const handleUpdateEmoji = async (soundId: string, emoji: string) => {
    try {
      const updated = await api.updateSoundboardSound(userId, soundId, { emoji })
      setSounds((prev) => prev.map((s) => (s.id === soundId ? { ...s, emoji: updated.emoji } : s)))
      setEmojiPickerFor(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update emoji')
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

  if (!isOpen) return null

  return (
    <div
      ref={dropdownRef}
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 max-h-96 overflow-hidden rounded-xl bg-[#2b2d31] border border-app-hover shadow-xl z-50 flex flex-col"
    >
      <div className={`p-2 border-b border-app-hover flex items-center justify-between gap-2 ${emojiPickerFor === 'new' ? 'relative' : ''}`}>
        <span className="font-semibold text-app-text text-sm">Soundboard</span>
        <div className="flex items-center gap-1">
          <span className="text-xs text-app-muted">New emoji:</span>
          <button
            type="button"
            onClick={() => setEmojiPickerFor(emojiPickerFor === 'new' ? null : 'new')}
            className="text-xl p-0.5 rounded hover:bg-app-hover/80 transition-colors"
            title="Pick emoji for next sound"
          >
            {emojiForNew}
          </button>
          {emojiPickerFor === 'new' && (
            <div className="absolute right-0 bottom-full mb-1 z-[60]">
              <EmojiPicker
                onSelect={(emoji) => { setEmojiForNew(emoji); setEmojiPickerFor(null) }}
                onClose={() => setEmojiPickerFor(null)}
              />
            </div>
          )}
          <button
            onClick={handleAddClick}
            disabled={adding}
            className="px-2 py-1 rounded text-xs bg-app-accent hover:bg-app-accent-hover text-white disabled:opacity-50"
          >
            {adding ? 'Uploading...' : '+ Add'}
          </button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="p-2 overflow-y-auto flex-1">
        {error && (
          <p className="text-red-400 text-xs mb-2">{error}</p>
        )}
        {loading ? (
          <p className="text-app-muted text-sm">Loading...</p>
        ) : sounds.length === 0 ? (
          <p className="text-app-muted text-sm py-4 text-center">
            No sounds yet. Add one (max 10 seconds).
          </p>
        ) : (
          <div className="grid gap-1">
            {sounds.map((s) => (
              <div
                key={s.id}
                className={`group flex items-center gap-2 p-2 rounded-lg hover:bg-app-hover/50 ${emojiPickerFor === s.id ? 'relative' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => setEmojiPickerFor(emojiPickerFor === s.id ? null : s.id)}
                  className="text-xl w-8 h-8 flex items-center justify-center rounded hover:bg-app-channel shrink-0"
                  title="Change emoji"
                >
                  {s.emoji || DEFAULT_EMOJI}
                </button>
                {emojiPickerFor === s.id && (
                  <div className="absolute left-0 bottom-full mb-1 z-[60]">
                    <EmojiPicker
                      onSelect={(emoji) => handleUpdateEmoji(s.id, emoji)}
                      onClose={() => setEmojiPickerFor(null)}
                    />
                  </div>
                )}
                <button
                  onClick={() => onPlay(s.url)}
                  className="flex-1 text-left text-sm text-app-text truncate py-1.5 px-2 rounded bg-app-dark hover:bg-app-channel transition-colors min-w-0"
                  title={`${s.name} — click to play (spam-click restarts)`}
                >
                  <span className="truncate block">{s.name}</span>
                  <span className="text-app-muted text-xs">({s.duration_seconds}s)</span>
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="p-1 rounded text-app-muted hover:text-red-400 hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  title="Delete"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
