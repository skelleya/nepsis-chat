import { useState, useRef, useEffect } from 'react'
import { QUICK_EMOJIS, EMOJI_CATEGORIES } from '../data/emojis'

export interface ServerEmoji {
  id: string
  name: string
  image_url: string
}

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  onClose?: () => void
  className?: string
  serverEmojis?: ServerEmoji[]
}

export function EmojiPicker({ onSelect, onClose, className = '', serverEmojis = [] }: EmojiPickerProps) {
  const baseCategories = Object.keys(EMOJI_CATEGORIES)
  const categories = serverEmojis.length > 0 ? ['Server', ...baseCategories] : baseCategories
  const [category, setCategory] = useState<string>(categories[0])
  const pickerRef = useRef<HTMLDivElement>(null)

  // Close when clicking outside
  useEffect(() => {
    if (!onClose) return
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => {
      clearTimeout(id)
      document.removeEventListener('mousedown', handler)
    }
  }, [onClose])

  return (
    <div
      ref={pickerRef}
      className={`bg-[#2b2d31] rounded-xl shadow-2xl border border-app-hover/50 overflow-hidden max-w-[280px] max-h-[320px] flex flex-col backdrop-blur-sm ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Quick emojis row */}
      <div className="p-3 border-b border-app-hover/40">
        <p className="text-[11px] font-semibold text-app-muted uppercase tracking-wider mb-2">Quick</p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onSelect(emoji)}
              className="text-xl p-2 hover:bg-app-hover/80 rounded-lg transition-colors active:scale-95"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 p-2 border-b border-app-hover/40 overflow-x-auto">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`text-xs px-2.5 py-1.5 rounded-md whitespace-nowrap font-medium transition-colors ${
              category === cat ? 'bg-app-accent text-white' : 'text-app-muted hover:bg-app-hover/60 hover:text-app-text'
            }`}
          >
            {cat.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Emoji grid */}
      <div className="flex-1 overflow-y-auto p-2 grid grid-cols-8 gap-0.5 min-h-[140px]">
        {category === 'Server'
          ? serverEmojis.map((e) => (
              <button
                key={e.id}
                onClick={() => onSelect(`:${e.name}:`)}
                className="p-2 hover:bg-app-hover/80 rounded-lg transition-colors active:scale-95"
              >
                <img src={e.image_url} alt={e.name} className="w-6 h-6 object-contain" />
              </button>
            ))
          : (EMOJI_CATEGORIES[category as keyof typeof EMOJI_CATEGORIES] || []).map((emoji) => (
              <button
                key={emoji}
                onClick={() => onSelect(emoji)}
                className="text-xl p-2 hover:bg-app-hover/80 rounded-lg transition-colors active:scale-95"
              >
                {emoji}
              </button>
            ))}
      </div>
    </div>
  )
}
