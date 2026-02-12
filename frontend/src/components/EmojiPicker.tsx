import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { EMOJI_CATEGORIES, EMOJI_SHORTCODES } from '../data/emojis'

export interface ServerEmoji {
  id: string
  name: string
  image_url: string
}

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  onClose?: () => void
  serverEmojis?: ServerEmoji[]
  /** Bounding rect of the trigger button – used for smart positioning via portal */
  anchorRect?: DOMRect | { top: number; left: number; bottom: number; right: number; width: number; height: number }
}

/* ── Category icon mapping ─────────────────────────────────── */
const CATEGORY_ICONS: Record<string, string> = {
  'Frequently Used': '🕐',
  'Server':          '🏠',
  'Smileys & People': '😀',
  'Gestures & Hands': '👋',
  'Hearts & Emotion': '❤️',
  'Animals & Nature': '🐾',
  'Food & Drink':    '🍔',
  'Activities & Sports': '⚽',
  'Travel & Places': '🚗',
  'Objects & Symbols': '💡',
}

/* ── Reverse look-up: emoji → shortcode name ───────────────── */
const EMOJI_NAMES: Record<string, string> = {}
for (const [name, emoji] of Object.entries(EMOJI_SHORTCODES)) {
  if (!EMOJI_NAMES[emoji]) EMOJI_NAMES[emoji] = name
}

/* ── Recently-used emojis (persisted in localStorage) ──────── */
function getRecentEmojis(): string[] {
  try { return JSON.parse(localStorage.getItem('recentEmojis') || '[]') }
  catch { return [] }
}
function addRecentEmoji(emoji: string) {
  const recent = getRecentEmojis().filter(e => e !== emoji)
  recent.unshift(emoji)
  localStorage.setItem('recentEmojis', JSON.stringify(recent.slice(0, 16)))
}

/* ── Constants ─────────────────────────────────────────────── */
const PICKER_W = 352
const PICKER_H = 435

/* ═══════════════════════════════════════════════════════════════
   EmojiPicker – portal-based, smart-positioned, searchable
   ═══════════════════════════════════════════════════════════════ */
export function EmojiPicker({
  onSelect,
  onClose = () => {},
  serverEmojis = [],
  anchorRect,
}: EmojiPickerProps) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('')
  const pickerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const searchRef = useRef<HTMLInputElement>(null)
  const [recentEmojis] = useState(getRecentEmojis)
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 })
  const [hover, setHover] = useState<{ emoji?: string; imageUrl?: string; name: string } | null>(null)

  /* ── Build ordered category list ───────────────────────────── */
  const categories = useMemo(() => {
    const cats: string[] = []
    if (recentEmojis.length > 0) cats.push('Frequently Used')
    if (serverEmojis.length > 0) cats.push('Server')
    cats.push(...Object.keys(EMOJI_CATEGORIES))
    return cats
  }, [recentEmojis.length, serverEmojis.length])

  // Set initial active category
  useEffect(() => {
    if (categories.length > 0 && !activeCategory) setActiveCategory(categories[0])
  }, [categories, activeCategory])

  /* ── Search results ────────────────────────────────────────── */
  const searchResults = useMemo(() => {
    if (!search.trim()) return null
    const q = search.toLowerCase()
    const emojis: string[] = []

    // Match shortcodes
    for (const [name, emoji] of Object.entries(EMOJI_SHORTCODES)) {
      if (name.includes(q) && !emojis.includes(emoji)) emojis.push(emoji)
    }
    // Match category names (e.g. "food" shows all Food emojis)
    for (const [catName, catEmojis] of Object.entries(EMOJI_CATEGORIES)) {
      if (catName.toLowerCase().includes(q)) {
        for (const emoji of catEmojis) {
          if (!emojis.includes(emoji)) emojis.push(emoji)
        }
      }
    }

    const serverResults = serverEmojis.filter(e => e.name.toLowerCase().includes(q))
    return { emojis, serverEmojis: serverResults }
  }, [search, serverEmojis])

  /* ── Smart positioning ─────────────────────────────────────── */
  useEffect(() => {
    if (!anchorRect) {
      // Centre in viewport when no anchor
      setPosition({
        top: Math.max(8, (window.innerHeight - PICKER_H) / 2),
        left: Math.max(8, (window.innerWidth - PICKER_W) / 2),
      })
      return
    }

    const r = anchorRect as DOMRect
    let top = r.top - PICKER_H - 8          // prefer above the trigger
    let left = r.left

    // Flip below if overflows top
    if (top < 8) top = r.bottom + 8
    // Clamp right
    if (left + PICKER_W > window.innerWidth - 8) left = window.innerWidth - PICKER_W - 8
    // Clamp left
    if (left < 8) left = 8
    // Clamp bottom
    if (top + PICKER_H > window.innerHeight - 8) top = window.innerHeight - PICKER_H - 8

    setPosition({ top, left })
  }, [anchorRect])

  /* ── Block native mousedown propagation so parent click-outside
       handlers (e.g. SoundboardDropdown) don't fire ───────────── */
  useEffect(() => {
    const el = pickerRef.current
    if (!el) return
    const stop = (e: Event) => e.stopPropagation()
    el.addEventListener('mousedown', stop)
    return () => el.removeEventListener('mousedown', stop)
  }, [])

  /* ── Click outside → close ─────────────────────────────────── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) onClose()
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 10)
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler) }
  }, [onClose])

  /* ── Escape → close ────────────────────────────────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  /* ── Auto-focus search on mount ────────────────────────────── */
  useEffect(() => { setTimeout(() => searchRef.current?.focus(), 50) }, [])

  /* ── Track scroll for active category highlight ────────────── */
  const handleScroll = useCallback(() => {
    if (!scrollRef.current || search) return
    const scrollTop = scrollRef.current.scrollTop
    let current = categories[0]
    for (const cat of categories) {
      const el = categoryRefs.current[cat]
      if (el && el.offsetTop <= scrollTop + 48) current = cat
    }
    setActiveCategory(current)
  }, [categories, search])

  /* ── Scroll to a specific category ─────────────────────────── */
  const scrollToCategory = (cat: string) => {
    setSearch('')
    setActiveCategory(cat)
    setTimeout(() => {
      const el = categoryRefs.current[cat]
      if (el && scrollRef.current) {
        scrollRef.current.scrollTo({ top: el.offsetTop - 4, behavior: 'smooth' })
      }
    }, 0)
  }

  /* ── Select handler (also saves to recent) ─────────────────── */
  const handleSelect = (emoji: string) => {
    addRecentEmoji(emoji)
    onSelect(emoji)
  }

  /* ── Shared button classes ─────────────────────────────────── */
  const emojiBtn = 'aspect-square flex items-center justify-center text-2xl rounded-md transition-colors duration-100 hover:bg-white/[0.06] active:scale-90'
  const serverEmojiBtn = 'aspect-square flex items-center justify-center rounded-md transition-colors duration-100 hover:bg-white/[0.06] active:scale-90'

  /* ── Render ─────────────────────────────────────────────────── */
  const picker = (
    <div
      ref={pickerRef}
      className="fixed z-[9999]"
      style={{ top: position.top, left: position.left }}
      onClick={e => e.stopPropagation()}
    >
      <div
        className="flex flex-col overflow-hidden rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.45)] border border-white/[0.06]"
        style={{
          width: PICKER_W,
          height: PICKER_H,
          background: '#2b2d31',
        }}
      >
        {/* ───── Search bar ───── */}
        <div className="px-3 pt-3 pb-2 flex-shrink-0">
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#949ba4]"
              viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search emoji…"
              className="w-full bg-[#1e1f22] text-[#dbdee1] text-sm rounded-md pl-9 pr-3 py-[7px] placeholder:text-[#949ba4]/70 outline-none border border-transparent focus:border-[#5865f2]/50 transition-colors"
            />
          </div>
        </div>

        {/* ───── Category icon tabs ───── */}
        {!search && (
          <div className="flex items-center gap-px px-1.5 pb-1 flex-shrink-0 overflow-x-auto scrollbar-none">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => scrollToCategory(cat)}
                className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-md text-[15px] transition-all duration-150 ${
                  activeCategory === cat
                    ? 'bg-white/[0.08] text-white'
                    : 'text-[#949ba4] hover:bg-white/[0.04] hover:text-[#dbdee1]'
                }`}
                title={cat}
              >
                {CATEGORY_ICONS[cat] || '❓'}
              </button>
            ))}
          </div>
        )}

        {/* ───── Divider ───── */}
        <div className="h-px bg-white/[0.04] mx-2 flex-shrink-0" />

        {/* ───── Emoji grid ───── */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-1.5 py-1"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#3f4147 transparent' }}
        >
          {searchResults ? (
            /* ── Search results view ── */
            <div>
              {searchResults.serverEmojis.length > 0 && (
                <div className="mb-1">
                  <p className="cat-header">Server</p>
                  <div className="grid grid-cols-8 gap-px">
                    {searchResults.serverEmojis.map(e => (
                      <button
                        key={e.id}
                        onClick={() => handleSelect(`:${e.name}:`)}
                        onMouseEnter={() => setHover({ imageUrl: e.image_url, name: e.name })}
                        onMouseLeave={() => setHover(null)}
                        className={serverEmojiBtn}
                        title={e.name}
                      >
                        <img src={e.image_url} alt={e.name} className="w-7 h-7 object-contain" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.emojis.length > 0 && (
                <div>
                  <p className="cat-header">Search Results</p>
                  <div className="grid grid-cols-8 gap-px">
                    {searchResults.emojis.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => handleSelect(emoji)}
                        onMouseEnter={() => setHover({ emoji, name: EMOJI_NAMES[emoji] || '' })}
                        onMouseLeave={() => setHover(null)}
                        className={emojiBtn}
                        title={EMOJI_NAMES[emoji] || emoji}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.emojis.length === 0 && searchResults.serverEmojis.length === 0 && (
                <div className="flex flex-col items-center justify-center py-14 text-[#949ba4] select-none">
                  <span className="text-4xl mb-3 opacity-60">😕</span>
                  <p className="text-sm font-medium">No results found</p>
                  <p className="text-xs mt-1 opacity-70">Try a different search term</p>
                </div>
              )}
            </div>
          ) : (
            /* ── Category browsing view ── */
            categories.map(cat => (
              <div key={cat} ref={el => { categoryRefs.current[cat] = el }}>
                <p className="text-[11px] font-bold text-[#949ba4]/80 uppercase tracking-wider px-1 py-1.5 sticky top-0 bg-[#2b2d31]/[0.97] backdrop-blur-[2px] z-10 select-none">
                  {cat}
                </p>
                <div className="grid grid-cols-8 gap-px">
                  {cat === 'Frequently Used'
                    ? recentEmojis.map((emoji, i) => (
                        <button
                          key={`recent-${i}`}
                          onClick={() => handleSelect(emoji)}
                          onMouseEnter={() => setHover({ emoji, name: EMOJI_NAMES[emoji] || '' })}
                          onMouseLeave={() => setHover(null)}
                          className={emojiBtn}
                          title={EMOJI_NAMES[emoji] || emoji}
                        >
                          {emoji.startsWith(':')
                            ? (() => {
                                const se = serverEmojis.find(s => `:${s.name}:` === emoji)
                                return se
                                  ? <img src={se.image_url} alt={se.name} className="w-7 h-7 object-contain" />
                                  : emoji
                              })()
                            : emoji}
                        </button>
                      ))
                    : cat === 'Server'
                    ? serverEmojis.map(e => (
                        <button
                          key={e.id}
                          onClick={() => handleSelect(`:${e.name}:`)}
                          onMouseEnter={() => setHover({ imageUrl: e.image_url, name: e.name })}
                          onMouseLeave={() => setHover(null)}
                          className={serverEmojiBtn}
                          title={e.name}
                        >
                          <img src={e.image_url} alt={e.name} className="w-7 h-7 object-contain" />
                        </button>
                      ))
                    : (EMOJI_CATEGORIES[cat as keyof typeof EMOJI_CATEGORIES] || []).map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => handleSelect(emoji)}
                          onMouseEnter={() => setHover({ emoji, name: EMOJI_NAMES[emoji] || '' })}
                          onMouseLeave={() => setHover(null)}
                          className={emojiBtn}
                          title={EMOJI_NAMES[emoji] || emoji}
                        >
                          {emoji}
                        </button>
                      ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ───── Preview bar ───── */}
        <div className="h-[42px] border-t border-white/[0.04] px-3 flex items-center gap-2.5 flex-shrink-0 bg-[#232428]">
          {hover ? (
            <>
              <span className="text-2xl flex-shrink-0 leading-none">
                {hover.imageUrl
                  ? <img src={hover.imageUrl} alt={hover.name} className="w-7 h-7 object-contain" />
                  : hover.emoji}
              </span>
              {hover.name && (
                <span className="text-sm text-[#dbdee1] font-medium truncate">
                  :{hover.name}:
                </span>
              )}
            </>
          ) : (
            <span className="text-xs text-[#949ba4] select-none">Pick an emoji…</span>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(picker, document.body)
}
