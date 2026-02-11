import { useState, useRef, useEffect, useCallback } from 'react'
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
  onOpenEmojiPicker?: () => void
  onFileClick?: () => void
  uploading?: boolean
  leftButtons?: React.ReactNode
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  placeholder = 'Message',
  disabled = false,
  members,
  serverEmojis = [],
  leftButtons,
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

    // Check for @mention
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

    // Check for :emoji:
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
    const newValue = before + replacement + after
    onChange(newValue)
    setAutocomplete(null)
    setTimeout(() => {
      inputRef.current?.focus()
      const newPos = autocomplete.start + replacement.length
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
      if (item) {
        const replacement = isMention ? (item as { display: string }).display : (item as { display: string }).display
        applySuggestion(replacement)
      }
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
    <div className="flex gap-2 relative">
      {leftButtons}
      <div className="flex-1 relative">
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
          className="w-full bg-app-dark rounded-lg px-4 py-3 text-app-text placeholder-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent"
        />
        {autocomplete && matches.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1 w-full max-w-xs bg-[#2b2d31] rounded-lg shadow-xl border border-app-hover/50 overflow-hidden z-50 max-h-48 overflow-y-auto">
            {matches.map((item, i) => (
              <button
                key={autocomplete.type === 'mention' ? (item as { id: string }).id : (item as { shortcode: string }).shortcode}
                type="button"
                onClick={() => {
                  const repl = autocomplete.type === 'mention'
                    ? (item as { display: string }).display
                    : (item as { display: string }).display
                  applySuggestion(repl)
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                  i === selectedIndex ? 'bg-app-accent/30' : 'hover:bg-app-hover/60'
                }`}
              >
                {autocomplete.type === 'mention' ? (
                  <>
                    <span className="text-app-muted text-sm">@</span>
                    <span className="text-app-text font-medium">
                      {(item as { username: string }).username}
                    </span>
                  </>
                ) : (
                  <>
                    {(item as { imageUrl?: string }).imageUrl ? (
                      <img src={(item as { imageUrl: string }).imageUrl} alt="" className="w-6 h-6 object-contain" />
                    ) : (
                      <span className="text-xl">{(item as { display: string }).display}</span>
                    )}
                    <span className="text-app-muted text-sm">:{(item as { shortcode: string }).shortcode}:</span>
                  </>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
