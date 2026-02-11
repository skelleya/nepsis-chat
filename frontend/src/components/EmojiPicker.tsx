import { useState } from 'react'
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

export function EmojiPicker({ onSelect, className = '', serverEmojis = [] }: EmojiPickerProps) {
  const baseCategories = Object.keys(EMOJI_CATEGORIES)
  const categories = serverEmojis.length > 0 ? ['Server', ...baseCategories] : baseCategories
  const [category, setCategory] = useState<string>(categories[0])

  return (
    <div
      className={`bg-app-dark rounded-lg shadow-xl border border-app-channel overflow-hidden max-w-xs max-h-80 flex flex-col ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Quick emojis row */}
      <div className="p-2 border-b border-app-channel">
        <p className="text-xs text-app-muted mb-1">Quick</p>
        <div className="flex flex-wrap gap-1">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onSelect(emoji)}
              className="text-xl p-1.5 hover:bg-app-hover rounded transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 p-2 border-b border-app-channel overflow-x-auto">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`text-xs px-2 py-1 rounded whitespace-nowrap ${
              category === cat ? 'bg-app-accent text-white' : 'bg-app-channel text-app-muted hover:bg-app-hover'
            }`}
          >
            {cat.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Emoji grid */}
      <div className="flex-1 overflow-y-auto p-2 grid grid-cols-8 gap-1">
        {category === 'Server'
          ? serverEmojis.map((e) => (
              <button
                key={e.id}
                onClick={() => onSelect(`:${e.name}:`)}
                className="p-1.5 hover:bg-app-hover rounded transition-colors"
              >
                <img src={e.image_url} alt={e.name} className="w-6 h-6 object-contain" />
              </button>
            ))
          : (EMOJI_CATEGORIES[category as keyof typeof EMOJI_CATEGORIES] || []).map((emoji) => (
              <button
                key={emoji}
                onClick={() => onSelect(emoji)}
                className="text-xl p-1.5 hover:bg-app-hover rounded transition-colors"
              >
                {emoji}
              </button>
            ))}
      </div>
    </div>
  )
}
