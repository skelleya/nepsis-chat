import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import gsap from 'gsap'
import type { ServerMember } from './MembersSidebar'
import type { Channel } from '../types'

interface MemberProfilePanelProps {
  member: ServerMember
  currentUserId: string
  voiceChannels?: Channel[]
  /** Clicked member row — popout anchors relative to this rect */
  anchorRect: DOMRect
  anchorRef?: React.RefObject<HTMLElement | null>
  /** Prefer left of row (members list) or below (DM header) */
  placement?: 'left' | 'below'
  canKick?: boolean
  canBan?: boolean
  onClose: () => void
  onMessage?: (userId: string, username: string) => void
  onAddFriend?: (userId: string, username: string) => void
  onCall?: (userId: string, username: string, avatarUrl?: string) => void
  onKick?: (userId: string) => Promise<void>
  onBan?: (userId: string) => Promise<void>
}

const POPOUT_WIDTH = 320
const POPOUT_GAP = 10
const VIEW_PAD = 12

export function MemberProfilePanel({
  member,
  currentUserId,
  voiceChannels = [],
  anchorRect,
  anchorRef,
  placement = 'left',
  canKick = false,
  canBan = false,
  onClose,
  onMessage,
  onAddFriend,
  onCall,
  onKick,
  onBan,
}: MemberProfilePanelProps) {
  const isCurrentUser = member.userId === currentUserId
  const cardRef = useRef<HTMLDivElement>(null)
  const closingRef = useRef(false)
  const [busy, setBusy] = useState<'kick' | 'ban' | null>(null)
  const [confirm, setConfirm] = useState<'kick' | 'ban' | null>(null)
  const [actionError, setActionError] = useState('')

  const isInVoiceOnThisServer =
    member.status === 'in-voice' &&
    member.voiceChannelId &&
    voiceChannels.some((ch) => ch.id === member.voiceChannelId)

  const displayStatus = isInVoiceOnThisServer
    ? 'in-voice'
    : member.status === 'online' || member.status === 'away' || member.status === 'dnd'
      ? member.status
      : 'offline'

  const statusLabel =
    displayStatus === 'in-voice'
      ? 'In a voice channel'
      : displayStatus === 'online'
        ? 'Online'
        : displayStatus === 'away'
          ? 'Away'
          : displayStatus === 'dnd'
            ? 'Do Not Disturb'
            : 'Offline'

  const statusColor =
    displayStatus === 'online' || displayStatus === 'in-voice'
      ? 'bg-[#23a559]'
      : displayStatus === 'away'
        ? 'bg-[#f0b232]'
        : displayStatus === 'dnd'
          ? 'bg-red-500'
          : 'bg-[#80848e]'

  const position = useMemo(() => {
    const heightEstimate = 420
    const maxTop = window.innerHeight - heightEstimate - VIEW_PAD
    const maxLeft = window.innerWidth - POPOUT_WIDTH - VIEW_PAD

    if (placement === 'below') {
      let left = Math.min(Math.max(VIEW_PAD, anchorRect.left), maxLeft)
      let top = anchorRect.bottom + POPOUT_GAP
      if (top > maxTop) top = Math.max(VIEW_PAD, anchorRect.top - heightEstimate - POPOUT_GAP)
      return { left, top }
    }

    let left = anchorRect.left - POPOUT_WIDTH - POPOUT_GAP
    if (left < VIEW_PAD) {
      // Not enough room on the left — try right of anchor, else clamp
      left = Math.min(maxLeft, Math.max(VIEW_PAD, anchorRect.right + POPOUT_GAP))
    }
    let top = anchorRect.top - 8
    if (top > maxTop) top = Math.max(VIEW_PAD, maxTop)
    if (top < VIEW_PAD) top = VIEW_PAD
    return { left, top }
  }, [anchorRect, placement])

  const requestClose = useCallback((afterClose?: () => void) => {
    if (closingRef.current) return
    closingRef.current = true
    const card = cardRef.current
    if (!card) {
      onClose()
      afterClose?.()
      return
    }
    gsap.killTweensOf(card)
    gsap.to(card, {
      opacity: 0,
      x: 16,
      scale: 0.97,
      duration: 0.18,
      ease: 'power2.in',
      onComplete: () => {
        onClose()
        afterClose?.()
      },
    })
  }, [onClose])

  useLayoutEffect(() => {
    const card = cardRef.current
    if (!card) return
    closingRef.current = false
    gsap.killTweensOf(card)
    gsap.fromTo(
      card,
      { opacity: 0, x: 28, scale: 0.96 },
      {
        opacity: 1,
        x: 0,
        scale: 1,
        duration: 0.28,
        ease: 'power3.out',
        clearProps: 'transform',
      }
    )
    return () => {
      gsap.killTweensOf(card)
    }
  }, [member.userId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose()
    }
    const onPointer = (e: MouseEvent) => {
      const card = cardRef.current
      if (!card) return
      const target = e.target as Node
      if (card.contains(target) || anchorRef?.current?.contains(target)) return
      requestClose()
    }
    window.addEventListener('keydown', onKey)
    // Delay so the opening click does not immediately close
    const t = window.setTimeout(() => window.addEventListener('mousedown', onPointer), 0)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointer)
    }
  }, [requestClose, anchorRef])

  const runModerate = async (kind: 'kick' | 'ban') => {
    setActionError('')
    setBusy(kind)
    try {
      if (kind === 'kick') await onKick?.(member.userId)
      else await onBan?.(member.userId)
      requestClose()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : `Failed to ${kind}`)
      setConfirm(null)
    } finally {
      setBusy(null)
    }
  }

  const roleBadge =
    member.role === 'owner' ? (
      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-600/40 text-amber-200 font-medium">
        Server Owner
      </span>
    ) : member.role === 'admin' ? (
      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-600/40 text-blue-200 font-medium">
        Admin
      </span>
    ) : null

  const showModeration = !isCurrentUser && (canKick || canBan)

  return createPortal(
    <div
      ref={cardRef}
      role="dialog"
      aria-label={`${member.username} profile`}
      className="fixed z-[80] w-[320px] rounded-xl overflow-hidden shadow-2xl border border-app-glass/10 bg-app-darker text-app-text"
      style={{ left: position.left, top: position.top }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Banner */}
      <div className="relative h-[72px] bg-app-accent">
        {member.bannerUrl ? (
          <img src={member.bannerUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-app-accent to-app-darker/80" />
        )}
        <button
          type="button"
          onClick={() => requestClose()}
          className="absolute top-2 right-2 p-1 rounded-md bg-black/35 text-white/80 hover:text-white hover:bg-black/50 transition-colors"
          title="Close"
          aria-label="Close profile"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      </div>

      <div className="px-4 pb-4">
        {/* Avatar overlapping banner */}
        <div className="relative -mt-10 mb-3 w-fit">
          <div className="w-[80px] h-[80px] rounded-full bg-app-accent flex items-center justify-center text-white font-bold text-2xl overflow-hidden ring-[6px] ring-app-darker">
            {member.avatarUrl ? (
              <img src={member.avatarUrl} alt={member.username} className="w-full h-full object-cover" />
            ) : (
              member.username.charAt(0).toUpperCase()
            )}
          </div>
          <div
            className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-[3px] border-app-darker ${statusColor}`}
            title={statusLabel}
          />
        </div>

        <div className="rounded-lg bg-app-panel p-3 space-y-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-app-text leading-tight">{member.username}</h2>
              {roleBadge}
            </div>
            <p className="text-sm text-app-muted mt-0.5">{statusLabel}</p>
          </div>

          {!isCurrentUser && (onMessage || onCall || onAddFriend) && (
            <div className="flex flex-col gap-1.5 pt-1 border-t border-app-glass/5">
              {onMessage && (
                <button
                  type="button"
                  onClick={() => requestClose(() => onMessage(member.userId, member.username))}
                  className="w-full px-3 py-2 rounded-md bg-app-accent hover:bg-app-accent-hover text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
                  </svg>
                  Message
                </button>
              )}
              {onCall && (
                <button
                  type="button"
                  onClick={() => requestClose(() => onCall(member.userId, member.username, member.avatarUrl))}
                  className="w-full px-3 py-2 rounded-md bg-[#23a559] hover:bg-[#1e8f4c] text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                  </svg>
                  Call
                </button>
              )}
              {onAddFriend && (
                <button
                  type="button"
                  onClick={() => requestClose(() => onAddFriend(member.userId, member.username))}
                  className="w-full px-3 py-2 rounded-md bg-app-channel hover:bg-app-hover text-app-text text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                  Add Friend
                </button>
              )}
            </div>
          )}

          {showModeration && (
            <div className="pt-2 border-t border-white/5 space-y-1.5">
              <p className="text-[11px] uppercase tracking-wide text-app-muted font-semibold px-0.5">
                Server moderation
              </p>

              {confirm ? (
                <div className="rounded-md bg-app-channel p-2.5 space-y-2">
                  <p className="text-xs text-app-text leading-snug">
                    {confirm === 'ban'
                      ? `Ban ${member.username}? They will be removed and cannot rejoin.`
                      : `Kick ${member.username}? They can rejoin with an invite.`}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => setConfirm(null)}
                      className="flex-1 px-2 py-1.5 rounded-md text-xs font-medium bg-app-darker text-app-text hover:bg-app-hover disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => runModerate(confirm)}
                      className="flex-1 px-2 py-1.5 rounded-md text-xs font-medium bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
                    >
                      {busy ? '…' : confirm === 'ban' ? 'Ban' : 'Kick'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {canKick && (
                    <button
                      type="button"
                      onClick={() => setConfirm('kick')}
                      className="w-full px-3 py-2 rounded-md text-sm font-medium text-red-400 hover:bg-red-500/15 flex items-center gap-2 transition-colors"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                      </svg>
                      Kick from Server
                    </button>
                  )}
                  {canBan && (
                    <button
                      type="button"
                      onClick={() => setConfirm('ban')}
                      className="w-full px-3 py-2 rounded-md text-sm font-medium text-red-400 hover:bg-red-500/15 flex items-center gap-2 transition-colors"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31A7.902 7.902 0 0112 20zm6.31-3.1L7.1 5.69A7.902 7.902 0 0112 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z" />
                      </svg>
                      Ban from Server
                    </button>
                  )}
                </>
              )}

              {actionError && (
                <p className="text-xs text-red-400 px-0.5" role="alert">
                  {actionError}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
