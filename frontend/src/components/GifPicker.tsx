import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import * as api from '../services/api'

interface GifPickerProps {
  onSelect: (gif: api.GifSearchResult) => Promise<void>
  onClose: () => void
}

export function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [query, setQuery] = useState('popular')
  const [results, setResults] = useState<api.GifSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectingId, setSelectingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      return
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const rows = await api.searchGifs(trimmed)
        if (!cancelled) setResults(rows)
      } catch (err) {
        if (!cancelled) {
          setResults([])
          setError(err instanceof Error ? err.message : 'GIF search failed')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !selectingId) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, selectingId])

  return createPortal(
    <div
      className="fixed inset-0 z-[340] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Choose a GIF"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !selectingId) onClose()
      }}
    >
      <div className="w-full max-w-2xl h-[min(78vh,620px)] rounded-2xl bg-app-dark border border-app-glass/[0.08] shadow-2xl flex flex-col overflow-hidden">
        <div className="p-4 border-b border-app-glass/[0.07] flex items-center gap-3">
          <div className="flex-1">
            <h2 className="font-display text-lg font-semibold text-app-text">Choose a GIF</h2>
            <p className="text-xs text-app-muted">Search Tenor and add the GIF to your message.</p>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg text-app-muted hover:text-app-text hover:bg-app-hover">×</button>
        </div>
        <div className="p-3 border-b border-app-glass/[0.06]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
            placeholder="Search GIFs"
            className="w-full px-3 py-2.5 rounded-xl bg-app-channel/80 border border-app-glass/[0.07] text-app-text outline-none focus:border-app-accent/50"
          />
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto p-3">
          {loading && results.length === 0 ? (
            <p className="text-center text-sm text-app-muted py-12">Searching GIFs…</p>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-sm text-red-400">{error}</p>
              <p className="text-xs text-app-muted mt-2">You can still upload a .gif file with the + button.</p>
            </div>
          ) : results.length === 0 ? (
            <p className="text-center text-sm text-app-muted py-12">No GIFs found.</p>
          ) : (
            <div className="columns-2 sm:columns-3 gap-2">
              {results.map((gif) => (
                <button
                  key={gif.id}
                  type="button"
                  disabled={!!selectingId}
                  onClick={async () => {
                    setSelectingId(gif.id)
                    setError(null)
                    try {
                      await onSelect(gif)
                      onClose()
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Failed to add GIF')
                    } finally {
                      setSelectingId(null)
                    }
                  }}
                  className="relative block w-full mb-2 rounded-xl overflow-hidden bg-app-channel hover:ring-2 hover:ring-app-accent/60 disabled:opacity-60 transition"
                  title={gif.title}
                >
                  <img src={gif.previewUrl} alt={gif.title} loading="lazy" className="w-full h-auto block" />
                  {selectingId === gif.id && (
                    <span className="absolute inset-0 bg-black/55 flex items-center justify-center text-xs font-semibold text-white">Adding…</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="px-4 py-2 border-t border-app-glass/[0.06] text-[10px] text-app-muted text-right">
          Powered by Tenor
        </div>
      </div>
    </div>,
    document.body
  )
}
