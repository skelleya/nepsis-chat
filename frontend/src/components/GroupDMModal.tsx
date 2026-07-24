import { useEffect, useMemo, useState } from 'react'
import * as api from '../services/api'

interface GroupDMModalProps {
  userId: string
  mode: 'create' | 'add'
  excludedUserIds?: string[]
  onClose: () => void
  onConfirm: (memberIds: string[], name?: string) => Promise<void>
}

export function GroupDMModal({
  userId,
  mode,
  excludedUserIds = [],
  onClose,
  onConfirm,
}: GroupDMModalProps) {
  const [friends, setFriends] = useState<api.FriendListItem[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [name, setName] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const excludedKey = [...excludedUserIds].sort().join('|')
  const excluded = useMemo(() => new Set([userId, ...excludedUserIds]), [userId, excludedKey])

  useEffect(() => {
    let cancelled = false
    api.getFriendsList(userId)
      .then((rows) => {
        if (!cancelled) setFriends(rows.filter((friend) => !excluded.has(friend.id)))
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load friends')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [userId, excluded])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  const visible = friends.filter((friend) => {
    const label = (friend.display_name || friend.username).toLowerCase()
    return label.includes(query.trim().toLowerCase())
  })
  const minimum = mode === 'create' ? 2 : 1

  const submit = async () => {
    if (selected.size < minimum) {
      setError(mode === 'create' ? 'Choose at least two friends' : 'Choose at least one friend')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onConfirm([...selected], mode === 'create' ? name.trim() || undefined : undefined)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save group message')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[320] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="group-dm-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose()
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-app-dark border border-app-hover/60 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-app-hover/50">
          <h2 id="group-dm-title" className="text-lg font-semibold text-app-text">
            {mode === 'create' ? 'Create group message' : 'Add people'}
          </h2>
          <p className="text-sm text-app-muted mt-1">
            {mode === 'create' ? 'Choose at least two friends. Groups support up to 10 people.' : 'Invite more friends to this group.'}
          </p>
        </div>

        <div className="p-5 space-y-3">
          {mode === 'create' && (
            <input
              value={name}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              placeholder="Group name (optional)"
              className="w-full px-3 py-2.5 rounded-lg bg-app-darker border border-app-hover text-app-text outline-none focus:border-app-accent"
            />
          )}
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search friends"
            autoFocus
            className="w-full px-3 py-2.5 rounded-lg bg-app-darker border border-app-hover text-app-text outline-none focus:border-app-accent"
          />

          <div className="max-h-64 overflow-y-auto rounded-lg border border-app-hover/50 bg-app-channel p-1">
            {loading ? (
              <p className="p-4 text-center text-sm text-app-muted">Loading friends…</p>
            ) : visible.length === 0 ? (
              <p className="p-4 text-center text-sm text-app-muted">No available friends</p>
            ) : (
              visible.map((friend) => {
                const checked = selected.has(friend.id)
                const label = friend.display_name || friend.username
                return (
                  <button
                    key={friend.id}
                    type="button"
                    onClick={() => {
                      setSelected((current) => {
                        const next = new Set(current)
                        if (next.has(friend.id)) next.delete(friend.id)
                        else if (next.size < (mode === 'create' ? 9 : 10)) next.add(friend.id)
                        return next
                      })
                    }}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg text-left ${
                      checked ? 'bg-app-accent/20' : 'hover:bg-app-hover/60'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-app-accent flex items-center justify-center text-white font-semibold">
                      {friend.avatar_url ? <img src={friend.avatar_url} alt="" className="w-full h-full object-cover" /> : label.charAt(0).toUpperCase()}
                    </div>
                    <span className="flex-1 min-w-0 text-sm text-app-text truncate">{label}</span>
                    <span className={`w-5 h-5 rounded border flex items-center justify-center ${checked ? 'bg-app-accent border-app-accent text-white' : 'border-app-muted'}`}>
                      {checked ? '✓' : ''}
                    </span>
                  </button>
                )
              })
            )}
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="px-5 py-4 bg-app-darker flex items-center justify-between gap-3">
          <span className="text-xs text-app-muted">{selected.size} selected</span>
          <div className="flex gap-2">
            <button type="button" disabled={saving} onClick={onClose} className="px-3 py-2 text-sm text-app-muted hover:text-app-text">
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || selected.size < minimum}
              onClick={submit}
              className="px-4 py-2 rounded-lg bg-app-accent hover:bg-app-accent-hover text-white text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Saving…' : mode === 'create' ? 'Create group' : 'Add people'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
