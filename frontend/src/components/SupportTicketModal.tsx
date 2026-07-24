import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { submitSupportTicket } from '../services/api'
import { useApp } from '../contexts/AppContext'

const TOPIC_OPTIONS = [
  { value: 'account', label: 'Account & login' },
  { value: 'voice', label: 'Voice / video / screen share' },
  { value: 'billing', label: 'Nous subscription & billing' },
  { value: 'moderation', label: 'Server moderation' },
  { value: 'other', label: 'Something else' },
] as const

type SupportTicketModalProps = {
  open: boolean
  onClose: () => void
}

/**
 * Desktop Support control → support ticket form.
 * Submits through the bug-reports API with category=`support`.
 */
export function SupportTicketModal({ open, onClose }: SupportTicketModalProps) {
  const { user } = useApp()
  const titleId = useId()
  const [topic, setTopic] = useState<(typeof TOPIC_OPTIONS)[number]['value']>('other')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setMessage(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  const isGuest = !user || !!user.is_guest

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || isGuest) {
      setMessage({
        type: 'error',
        text: 'Sign in with a full account to submit a support ticket.',
      })
      return
    }
    const trimTitle = title.trim()
    const trimDesc = description.trim()
    if (!trimTitle || !trimDesc) {
      setMessage({ type: 'error', text: 'Please fill in both subject and details.' })
      return
    }
    setSubmitting(true)
    setMessage(null)
    try {
      const topicLabel = TOPIC_OPTIONS.find((t) => t.value === topic)?.label || topic
      await submitSupportTicket({
        userId: user.id,
        username: user.username,
        email: user.email,
        title: `[${topicLabel}] ${trimTitle}`.slice(0, 256),
        description: trimDesc,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
      })
      setMessage({ type: 'success', text: 'Ticket sent — we’ll get back to you as soon as we can.' })
      setTitle('')
      setDescription('')
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to submit ticket' })
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[280] flex items-start justify-center bg-black/65 p-4 pt-16 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-app-glass/15 bg-app-darker text-app-text shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-app-glass/10 px-5 py-3.5">
          <div>
            <h2 id={titleId} className="text-base font-bold">
              Support ticket
            </h2>
            <p className="text-xs text-app-muted">Tell us what’s going wrong — we’ll review it soon.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-app-muted hover:bg-app-hover hover:text-app-text"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 p-5">
          {isGuest ? (
            <p className="text-sm text-app-muted">
              Guest accounts can’t open support tickets. Sign in or create an account first.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-app-muted">Topic</label>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value as typeof topic)}
                  className="w-full rounded-lg border border-transparent bg-app-dark px-3 py-2 text-sm text-app-text focus:border-app-accent focus:outline-none"
                >
                  {TOPIC_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-app-muted">Subject</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Short summary"
                  maxLength={200}
                  className="w-full rounded-lg border border-transparent bg-app-dark px-3 py-2 text-sm text-app-text placeholder:text-app-muted focus:border-app-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-app-muted">Details</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What happened? Steps to reproduce, server name, screenshots description…"
                  rows={5}
                  maxLength={8000}
                  className="w-full resize-none rounded-lg border border-transparent bg-app-dark px-3 py-2 text-sm text-app-text placeholder:text-app-muted focus:border-app-accent focus:outline-none"
                />
              </div>
              <p className="text-xs text-app-muted">
                Your username and app page are included so we can investigate.
              </p>
              {message && (
                <p className={`text-sm ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                  {message.text}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-app-muted hover:bg-app-hover hover:text-app-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-app-accent px-4 py-2 text-sm font-semibold text-white hover:bg-app-accent-hover disabled:opacity-50"
                >
                  {submitting ? 'Sending…' : 'Submit ticket'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
