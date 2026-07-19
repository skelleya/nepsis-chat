import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import { EMOJI_SHORTCODES } from '../data/emojis'

interface MentionableUser {
  id: string
  username: string
}

interface ServerEmoji {
  id: string
  name: string
  image_url: string
}

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  placeholder?: string
  disabled?: boolean
  members: MentionableUser[]
  serverEmojis?: ServerEmoji[]
  /** Discord-style + button inside the field (left) */
  onAttachClick?: () => void
  attachMenu?: ReactNode
  attachOpen?: boolean
  uploading?: boolean
  /** Optional control on the right inside the field (e.g. emoji) */
  rightSlot?: ReactNode
}

/**
 * Discord-like message composer: rounded bar, + inside the field, Enter to send.
 * No external send button.
 */
export function ChatInput({
  value,
  onChange,
  onSubmit,
  placeholder = 'Message',
  disabled = false,
  members,
  serverEmojis = [],
  onAttachClick,
  attachMenu,
  attachOpen = false,
  uploading = false,
  rightSlot,
}: ChatInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const cursorPosRef = useRef(0)
  const [autocomplete, setAutocomplete] = useState<{
    type: 'mention' | 'emoji'
    query: string
    start: number
    end: number
    selectedIndex: number
  } | null>(null)

  const getEmojiMatches = useCallback((query: string) => {
    const q = query.toLowerCase()
    const matches: { shortcode: string; display: string; imageUrl?: string }[] = []
    for (const [shortcode, emoji] of Object.entries(EMOJI_SHORTCODES)) {
      if (shortcode.startsWith(q) && !matches.some((m) => m.shortcode === shortcode)) {
        matches.push({ shortcode, display: emoji })
      }
    }
    for (const e of serverEmojis) {
      if (e.name.toLowerCase().startsWith(q)) {
        matches.push({ shortcode: e.name, display: `:${e.name}:`, imageUrl: e.image_url })
      }
    }
    return matches.slice(0, 8)
  }, [serverEmojis])

  const getMentionMatches = useCallback((query: string) => {
    const q = query.toLowerCase()
    const results: { id: string; username: string; display: string }[] = []
    if (q === '' || 'everyone'.startsWith(q)) {
      results.push({ id: 'everyone', username: 'everyone', display: '@everyone' })
    }
    for (const m of members) {
      if (m.username.toLowerCase().startsWith(q)) {
        results.push({ ...m, display: `@${m.username}` })
      }
    }
    return results.slice(0, 8)
  }, [members])

  useEffect(() => {
    const pos = cursorPosRef.current
    const textBefore = value.slice(0, pos)

    const atMatch = textBefore.match(/@(\w*)$/)
    if (atMatch) {
      const query = atMatch[1]
      const matches = getMentionMatches(query)
      if (matches.length > 0) {
        setAutocomplete({
          type: 'mention',
          query,
          start: textBefore.length - atMatch[0].length,
          end: pos,
          selectedIndex: 0,
        })
        return
      }
    }

    const colonMatch = textBefore.match(/:([a-zA-Z0-9_]*)$/)
    if (colonMatch) {
      const query = colonMatch[1]
      const matches = getEmojiMatches(query)
      if (matches.length > 0) {
        setAutocomplete({
          type: 'emoji',
          query,
          start: textBefore.length - colonMatch[0].length,
          end: pos,
          selectedIndex: 0,
        })
        return
      }
    }

    setAutocomplete(null)
  }, [value, getMentionMatches, getEmojiMatches])

  const applySuggestion = useCallback((replacement: string) => {
    if (!autocomplete) return
    const before = value.slice(0, autocomplete.start)
    const after = value.slice(autocomplete.end)
    const newValue = before + replacement + ' ' + after
    onChange(newValue)
    setAutocomplete(null)
    setTimeout(() => {
      inputRef.current?.focus()
      const newPos = autocomplete.start + replacement.length + 1
      inputRef.current?.setSelectionRange(newPos, newPos)
    }, 0)
  }, [autocomplete, value, onChange])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!autocomplete) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        onSubmit()
      }
      return
    }

    const isMention = autocomplete.type === 'mention'
    const matches = isMention ? getMentionMatches(autocomplete.query) : getEmojiMatches(autocomplete.query)

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAutocomplete((a) => a && { ...a, selectedIndex: Math.min(a.selectedIndex + 1, matches.length - 1) })
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAutocomplete((a) => a && { ...a, selectedIndex: Math.max(a.selectedIndex - 1, 0) })
      return
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const item = matches[autocomplete.selectedIndex]
      if (item) applySuggestion((item as { display: string }).display)
      return
    }
    if (e.key === 'Escape') {
      setAutocomplete(null)
    }
  }

  const mentionMatches = autocomplete?.type === 'mention' ? getMentionMatches(autocomplete.query) : []
  const emojiMatches = autocomplete?.type === 'emoji' ? getEmojiMatches(autocomplete.query) : []
  const matches = autocomplete?.type === 'mention' ? mentionMatches : emojiMatches
  const selectedIndex = autocomplete?.selectedIndex ?? 0

  return (
    <div className="relative w-full min-w-0">
      <div className="flex items-center gap-1 bg-[#383a40] rounded-lg min-h-[44px] px-1.5 focus-within:ring-1 focus-within:ring-white/10">
        {onAttachClick && (
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={onAttachClick}
              disabled={disabled || uploading}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#b5bac1] hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
              title={attachOpen ? 'Close' : 'Upload a file'}
              aria-label={attachOpen ? 'Close attach menu' : 'Attach file'}
            >
              {uploading ? (
                <span className="text-xs">…</span>
              ) : attachOpen ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
                </svg>
              )}
            </button>
            {attachMenu}
          </div>
        )}

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            cursorPosRef.current = e.target.selectionStart ?? e.target.value.length
            onChange(e.target.value)
          }}
          onKeyDown={handleKeyDown}
          onSelect={(e) => { cursorPosRef.current = (e.target as HTMLInputElement).selectionStart ?? 0 }}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[15px] text-[#dbdee1] placeholder:text-[#949ba4] py-2.5 px-1"
        />

        {rightSlot && <div className="flex-shrink-0 flex items-center pr-0.5">{rightSlot}</div>}
      </div>

      {autocomplete && matches.length > 0 && (
        <div className="absolute bottom-full left-0 mb-2 w-full max-w-sm bg-[#2b2d31] rounded-lg shadow-xl border border-white/10 overflow-hidden z-50 max-h-52 overflow-y-auto">
          {matches.map((item, i) => (
            <button
              key={autocomplete.type === 'mention' ? (item as { id: string }).id : (item as { shortcode: string }).shortcode}
              type="button"
              onClick={() => applySuggestion((item as { display: string }).display)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                i === selectedIndex ? 'bg-[#404249]' : 'hover:bg-[#35373c]'
              }`}
            >
              {autocomplete.type === 'mention' ? (
                <>
                  <span className="text-[#949ba4] text-sm">@</span>
                  <span className="text-[#f2f3f5] font-medium text-sm">
                    {(item as { username: string }).username}
                  </span>
                </>
              ) : (
                <>
                  {(item as { imageUrl?: string }).imageUrl ? (
                    <img src={(item as { imageUrl: string }).imageUrl} alt="" className="w-5 h-5 object-contain" />
                  ) : (
                    <span className="text-lg leading-none">{(item as { display: string }).display}</span>
                  )}
                  <span className="text-[#949ba4] text-sm">:{(item as { shortcode: string }).shortcode}:</span>
                </>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
