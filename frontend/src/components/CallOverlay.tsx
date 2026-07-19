/**
 * CallOverlay — renders call UI based on current call state.
 *
 * States:
 *  - calling:  Outgoing call screen (avatar, "Calling...", cancel)
 *  - ringing:  Incoming call screen (avatar, accept/decline)
 *  - in-call:  Compact top bar (click to expand) or full expanded panel
 *  - idle:     Nothing rendered
 */

import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import gsap from 'gsap'
import { useCall } from '../contexts/CallContext'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function CallVideo({
  stream,
  muted = false,
  mirror = false,
  className = '',
}: {
  stream: MediaStream | null
  muted?: boolean
  mirror?: boolean
  className?: string
}) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.srcObject = stream
    if (stream) el.play().catch(() => {})
  }, [stream])
  if (!stream) return null
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={`${className} ${mirror ? 'scale-x-[-1]' : ''}`}
    />
  )
}

function AnimatedCallPanel({
  children,
  className,
  y = 14,
}: {
  children: ReactNode
  className: string
  y?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    gsap.killTweensOf(el)
    gsap.fromTo(
      el,
      { opacity: 0, y },
      { opacity: 1, y: 0, duration: 0.22, ease: 'power3.out', force3D: false }
    )
    return () => {
      gsap.killTweensOf(el)
    }
  }, [y])

  return <div ref={ref} className={className}>{children}</div>
}

export function CallOverlay() {
  const call = useCall()

  if (call.callState === 'idle') {
    if (call.unavailableReason) {
      return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-red-600/90 text-white text-sm font-medium z-[100] shadow-lg">
          {call.unavailableReason}
        </div>
      )
    }
    return null
  }

  // ─── Outgoing call ────────────────────────────────────────────
  if (call.callState === 'calling') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <AnimatedCallPanel className="bg-app-darker rounded-2xl p-8 w-80 flex flex-col items-center gap-6 shadow-2xl border border-white/5">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center text-white font-bold text-3xl animate-pulse shadow-lg overflow-hidden ${call.remoteAvatarUrl ? 'bg-transparent' : 'bg-app-accent shadow-app-accent/30'}`}>
            {call.remoteAvatarUrl ? (
              <img src={call.remoteAvatarUrl} alt={call.remoteUsername ?? ''} className="w-full h-full object-cover" />
            ) : (
              call.remoteUsername?.charAt(0).toUpperCase()
            )}
          </div>
          <div className="text-center">
            <h2 className="text-xl font-semibold text-white">
              {call.remoteUsername}
            </h2>
            <p className="text-app-muted text-sm mt-1">
              {call.isVideoCall ? 'Video calling...' : 'Calling...'}
            </p>
          </div>
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-app-accent animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-app-accent animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-app-accent animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <button
            onClick={call.endCall}
            className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors shadow-lg"
            title="Cancel call"
          >
            <PhoneOffIcon />
          </button>
        </AnimatedCallPanel>
      </div>
    )
  }

  // ─── Incoming call ────────────────────────────────────────────
  if (call.callState === 'ringing') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <AnimatedCallPanel className="bg-app-darker rounded-2xl p-8 w-80 flex flex-col items-center gap-6 shadow-2xl border border-white/5">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-24 h-24 rounded-full bg-app-accent/20 animate-ping" />
            <div className="absolute w-28 h-28 rounded-full border-2 border-app-accent/30 animate-pulse" />
            <div className={`w-24 h-24 rounded-full flex items-center justify-center text-white font-bold text-3xl relative shadow-lg overflow-hidden ${call.remoteAvatarUrl ? 'bg-transparent' : 'bg-app-accent shadow-app-accent/30'}`}>
              {call.remoteAvatarUrl ? (
                <img src={call.remoteAvatarUrl} alt={call.remoteUsername ?? ''} className="w-full h-full object-cover" />
              ) : (
                call.remoteUsername?.charAt(0).toUpperCase()
              )}
            </div>
          </div>
          <div className="text-center">
            <h2 className="text-xl font-semibold text-white">
              {call.remoteUsername}
            </h2>
            <p className="text-app-muted text-sm mt-1">
              {call.isVideoCall ? 'Incoming video call...' : 'Incoming call...'}
            </p>
          </div>
          <div className="flex gap-8">
            <button
              onClick={call.declineCall}
              className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors shadow-lg"
              title="Decline"
            >
              <PhoneOffIcon />
            </button>
            <button
              onClick={call.acceptCall}
              className="w-14 h-14 rounded-full bg-[#23a559] hover:opacity-90 flex items-center justify-center transition-colors shadow-lg"
              title="Accept"
            >
              <PhoneIcon />
            </button>
          </div>
        </AnimatedCallPanel>
      </div>
    )
  }

  // ─── Active call ──────────────────────────────────────────────
  if (call.callState === 'in-call') {
    if (call.callExpanded) {
      return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <AnimatedCallPanel className="bg-app-darker rounded-2xl w-full max-w-3xl shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-4 py-3 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold overflow-hidden shrink-0 ${call.remoteAvatarUrl ? 'bg-transparent' : 'bg-app-accent'}`}>
                  {call.remoteAvatarUrl ? (
                    <img src={call.remoteAvatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    call.remoteUsername?.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-white font-semibold truncate">{call.remoteUsername}</div>
                  <div className="text-white/60 text-xs font-mono">{formatDuration(call.callDuration)}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={call.minimizeCall}
                className="px-3 py-1.5 rounded-lg text-sm text-white/80 hover:bg-white/10"
                title="Minimize"
              >
                Minimize
              </button>
            </div>

            <div className="relative flex-1 min-h-[280px] bg-[#111214] flex items-center justify-center">
              {call.isVideoCall && call.remoteVideoStream ? (
                <CallVideo
                  stream={call.remoteVideoStream}
                  className="w-full h-full max-h-[60vh] object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 py-16">
                  <div className={`w-28 h-28 rounded-full flex items-center justify-center text-white font-bold text-4xl overflow-hidden ${call.remoteAvatarUrl ? 'bg-transparent' : 'bg-app-accent'}`}>
                    {call.remoteAvatarUrl ? (
                      <img src={call.remoteAvatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      call.remoteUsername?.charAt(0).toUpperCase()
                    )}
                  </div>
                  <p className="text-app-muted text-sm">
                    {call.isVideoCall ? 'Waiting for video…' : 'Voice call'}
                  </p>
                </div>
              )}
              {call.isVideoCall && call.localVideoStream && (
                <div className="absolute bottom-3 right-3 w-36 sm:w-44 aspect-video rounded-lg overflow-hidden ring-2 ring-white/20 shadow-xl bg-black">
                  <CallVideo
                    stream={call.localVideoStream}
                    muted
                    mirror
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>

            <div className="px-4 py-4 flex items-center justify-center gap-3 bg-app-channel">
              <button
                onClick={call.toggleMute}
                className={`p-3 rounded-full transition-colors ${
                  call.isMuted ? 'bg-red-500/80 text-white' : 'bg-white/15 text-white hover:bg-white/25'
                }`}
                title={call.isMuted ? 'Unmute' : 'Mute'}
              >
                {call.isMuted ? <MicOffSmall /> : <MicSmall />}
              </button>
              <button
                onClick={call.toggleDeafen}
                className={`p-3 rounded-full transition-colors ${
                  call.isDeafened ? 'bg-red-500/80 text-white' : 'bg-white/15 text-white hover:bg-white/25'
                }`}
                title={call.isDeafened ? 'Undeafen' : 'Deafen'}
              >
                {call.isDeafened ? <HeadphonesOffSmall /> : <HeadphonesSmall />}
              </button>
              <button
                onClick={call.endCall}
                className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors"
                title="End call"
              >
                <PhoneOffSmall />
              </button>
            </div>
          </AnimatedCallPanel>
        </div>
      )
    }

    // Compact bar — click left side to expand
    return (
      <div className="fixed top-0 left-0 right-0 z-[100] flex justify-center pointer-events-none">
        <AnimatedCallPanel y={-12} className="bg-[#23a559] rounded-b-xl px-4 py-2.5 flex items-center gap-3 shadow-lg pointer-events-auto">
          <button
            type="button"
            onClick={call.expandCall}
            className="flex items-center gap-2.5 hover:opacity-90 transition-opacity"
            title="Click to expand call"
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden ${call.remoteAvatarUrl ? 'bg-transparent' : 'bg-white/20'}`}>
              {call.remoteAvatarUrl ? (
                <img src={call.remoteAvatarUrl} alt={call.remoteUsername ?? ''} className="w-full h-full object-cover" />
              ) : (
                call.remoteUsername?.charAt(0).toUpperCase()
              )}
            </div>
            <span className="text-white text-sm font-medium">
              {call.remoteUsername}
            </span>
            <span className="text-white/70 text-xs font-mono">
              {formatDuration(call.callDuration)}
            </span>
            {call.isVideoCall && (
              <span className="text-[10px] uppercase font-bold text-white/80 bg-white/15 px-1.5 py-0.5 rounded">
                Video
              </span>
            )}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/80 ml-0.5">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </button>
          <div className="w-px h-5 bg-white/20" />
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={call.toggleMute}
              className={`p-2 rounded-full transition-colors ${
                call.isMuted
                  ? 'bg-red-500/80 text-white'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
              title={call.isMuted ? 'Unmute' : 'Mute'}
            >
              {call.isMuted ? <MicOffSmall /> : <MicSmall />}
            </button>
            <button
              type="button"
              onClick={call.toggleDeafen}
              className={`p-2 rounded-full transition-colors ${
                call.isDeafened
                  ? 'bg-red-500/80 text-white'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
              title={call.isDeafened ? 'Undeafen' : 'Deafen'}
            >
              {call.isDeafened ? <HeadphonesOffSmall /> : <HeadphonesSmall />}
            </button>
            <button
              type="button"
              onClick={call.endCall}
              className="p-2 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors"
              title="End call"
            >
              <PhoneOffSmall />
            </button>
          </div>
        </AnimatedCallPanel>
      </div>
    )
  }

  return null
}

function PhoneIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
    </svg>
  )
}

function PhoneOffIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
      <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
    </svg>
  )
}

function MicSmall() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" />
    </svg>
  )
}

function MicOffSmall() {
  return (
    <svg width="16" height="16" viewBox="-1 -1 26 26" fill="currentColor">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 .29.04.56.11.82L12 14z" />
      <path d="M3.27 3L2 4.27l7.72 7.72c-.57.63-1.41 1.01-2.33 1.01H6.52c-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V22c0 .55.45 1 1 1s1-.45 1-1v-2.08c.82-.12 1.6-.38 2.32-.73L20.73 24 22 22.73 3.27 3z" />
      <line x1="3" y1="3" x2="22" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function HeadphonesSmall() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3C7.03 3 3 7.03 3 12v7c0 1.1.9 2 2 2h1c1.1 0 2-.9 2-2v-3c0-1.1-.9-2-2-2H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-1c-1.1 0-2 .9-2 2v3c0 1.1.9 2 2 2h1c1.1 0 2-.9 2-2v-7c0-4.97-4.03-9-9-9z" />
    </svg>
  )
}

function HeadphonesOffSmall() {
  return (
    <svg width="16" height="16" viewBox="-1 -1 26 26" fill="currentColor">
      <path d="M12 3C7.03 3 3 7.03 3 12v7c0 1.1.9 2 2 2h1c1.1 0 2-.9 2-2v-3c0-1.1-.9-2-2-2H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-1c-1.1 0-2 .9-2 2v3c0 1.1.9 2 2 2h1c1.1 0 2-.9 2-2v-7c0-4.97-4.03-9-9-9z" />
      <line x1="3" y1="3" x2="22" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function PhoneOffSmall() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
    </svg>
  )
}
