/**
 * CallOverlay — renders call UI based on current call state.
 *
 * States:
 *  - calling:  Outgoing call screen (avatar, "Calling...", cancel)
 *  - ringing:  Incoming call screen (avatar, accept/decline)
 *  - in-call:  Compact top bar (username, duration, mute, deafen, end)
 *  - idle:     Nothing rendered
 */

import { useCall } from '../contexts/CallContext'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function CallOverlay() {
  const call = useCall()

  if (call.callState === 'idle') {
    // Show brief "unavailable" toast if needed
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
        <div className="bg-[#1e1f22] rounded-2xl p-8 w-80 flex flex-col items-center gap-6 shadow-2xl border border-white/5">
          {/* Avatar */}
          <div className="w-24 h-24 rounded-full bg-app-accent flex items-center justify-center text-white font-bold text-3xl animate-pulse shadow-lg shadow-app-accent/30">
            {call.remoteUsername?.charAt(0).toUpperCase()}
          </div>
          <div className="text-center">
            <h2 className="text-xl font-semibold text-white">
              {call.remoteUsername}
            </h2>
            <p className="text-app-muted text-sm mt-1">Calling...</p>
          </div>
          {/* Animated dots */}
          <div className="flex gap-1.5">
            <div
              className="w-2 h-2 rounded-full bg-app-accent animate-bounce"
              style={{ animationDelay: '0ms' }}
            />
            <div
              className="w-2 h-2 rounded-full bg-app-accent animate-bounce"
              style={{ animationDelay: '150ms' }}
            />
            <div
              className="w-2 h-2 rounded-full bg-app-accent animate-bounce"
              style={{ animationDelay: '300ms' }}
            />
          </div>
          {/* Cancel */}
          <button
            onClick={call.endCall}
            className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors shadow-lg"
            title="Cancel call"
          >
            <PhoneOffIcon />
          </button>
        </div>
      </div>
    )
  }

  // ─── Incoming call ────────────────────────────────────────────
  if (call.callState === 'ringing') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-[#1e1f22] rounded-2xl p-8 w-80 flex flex-col items-center gap-6 shadow-2xl border border-white/5">
          {/* Avatar with ring animation */}
          <div className="relative flex items-center justify-center">
            <div className="absolute w-24 h-24 rounded-full bg-app-accent/20 animate-ping" />
            <div className="absolute w-28 h-28 rounded-full border-2 border-app-accent/30 animate-pulse" />
            <div className="w-24 h-24 rounded-full bg-app-accent flex items-center justify-center text-white font-bold text-3xl relative shadow-lg shadow-app-accent/30">
              {call.remoteUsername?.charAt(0).toUpperCase()}
            </div>
          </div>
          <div className="text-center">
            <h2 className="text-xl font-semibold text-white">
              {call.remoteUsername}
            </h2>
            <p className="text-app-muted text-sm mt-1">Incoming call...</p>
          </div>
          {/* Accept / Decline */}
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
              className="w-14 h-14 rounded-full bg-green-600 hover:bg-green-700 flex items-center justify-center transition-colors shadow-lg"
              title="Accept"
            >
              <PhoneIcon />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Active call bar ──────────────────────────────────────────
  if (call.callState === 'in-call') {
    return (
      <div className="fixed top-0 left-0 right-0 z-[100] flex justify-center pointer-events-none">
        <div className="bg-green-600 rounded-b-xl px-6 py-2.5 flex items-center gap-4 shadow-lg pointer-events-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold">
              {call.remoteUsername?.charAt(0).toUpperCase()}
            </div>
            <span className="text-white text-sm font-medium">
              {call.remoteUsername}
            </span>
            <span className="text-white/70 text-xs font-mono">
              {formatDuration(call.callDuration)}
            </span>
          </div>
          <div className="w-px h-5 bg-white/20" />
          <div className="flex items-center gap-1.5">
            {/* Mute */}
            <button
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
            {/* Deafen */}
            <button
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
            {/* End call */}
            <button
              onClick={call.endCall}
              className="p-2 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors"
              title="End call"
            >
              <PhoneOffSmall />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}

// ─── Icons ──────────────────────────────────────────────────────

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
      <path d="M18.59 10.52c1.05-.51 2.04-1.15 2.96-1.89l-1.41-1.41c-.73.6-1.52 1.14-2.36 1.59-.34.17-.56.52-.56.9v3.07c-1.44.49-2.97.76-4.57.76h-.05L21 21.73l1.41-1.41L4.27 3 2.86 4.41l3.77 3.77C4.3 10.07 2.62 12.35 1.71 15c-.15.45.08.92.5 1.15.38.21.84.1 1.11-.22C5.53 13.13 8.6 11.3 12 11.3c.48 0 .95.03 1.41.08l1.61 1.61c-.53-.02-1.02-.09-1.54-.09-2.44 0-4.68.73-6.56 1.98l-.02.01c-.36.24-.52.72-.34 1.12.18.4.6.62 1.03.49A10.6 10.6 0 0 1 12 15.77c.98 0 1.92.12 2.83.35l1.61 1.61a12.48 12.48 0 0 0-4.44-.66c-1.57 0-3.06.32-4.42.89-.37.16-.56.56-.44.95.12.38.51.61.91.53A10.3 10.3 0 0 1 12 18.77c1.05 0 2.06.16 3.02.44l3.57 3.57V20c0-.55.45-1 1-1 .34 0 .67.03 1 .08V16.7c0-.39-.23-.74-.56-.9-.87-.42-1.79-.75-2.74-.98l-2.2-2.2c2.01-.07 3.91-.5 5.67-1.24.38-.16.6-.55.5-.95-.1-.4-.48-.66-.89-.57-.46.1-.92.22-1.37.37V10.52z" />
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
