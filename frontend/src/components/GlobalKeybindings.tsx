import { useEffect, useRef } from 'react'
import { useVoice } from '../contexts/VoiceContext'
import { useCall } from '../contexts/CallContext'
import {
  eventMatchesCombo,
  loadPrefs,
  subscribePrefs,
  type KeybindingsPrefs,
} from '../services/userPrefs'

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return !!target.closest('[contenteditable="true"], [role="textbox"]')
}

/**
 * Applies remappable voice/call shortcuts from user prefs.
 * Must mount under VoiceProvider + CallProvider.
 */
export function GlobalKeybindings() {
  const voice = useVoice()
  const call = useCall()
  const bindingsRef = useRef<KeybindingsPrefs>(loadPrefs().keybindings)
  const voiceRef = useRef(voice)
  const callRef = useRef(call)
  voiceRef.current = voice
  callRef.current = call

  useEffect(() => subscribePrefs((next) => {
    bindingsRef.current = next.keybindings
  }), [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (isEditableTarget(e.target)) return
      const bindings = bindingsRef.current
      const v = voiceRef.current
      const c = callRef.current

      if (eventMatchesCombo(e, bindings.toggleMute)) {
        if (!v.voiceChannelId) return
        e.preventDefault()
        v.setIsMuted(!v.isMuted)
        return
      }
      if (eventMatchesCombo(e, bindings.toggleDeafen)) {
        if (!v.voiceChannelId) return
        e.preventDefault()
        v.setIsDeafened(!v.isDeafened)
        return
      }
      if (eventMatchesCombo(e, bindings.toggleCamera)) {
        if (!v.voiceChannelId) return
        e.preventDefault()
        void v.toggleCamera()
        return
      }
      if (eventMatchesCombo(e, bindings.toggleScreenShare)) {
        if (!v.voiceChannelId) return
        e.preventDefault()
        void v.toggleScreenShare()
        return
      }
      if (eventMatchesCombo(e, bindings.disconnectVoice)) {
        if (!v.voiceChannelId) return
        e.preventDefault()
        v.leaveVoice()
        return
      }
      if (eventMatchesCombo(e, bindings.answerCall)) {
        if (c.callState !== 'ringing') return
        e.preventDefault()
        c.acceptCall()
        return
      }
      if (eventMatchesCombo(e, bindings.declineCall)) {
        if (c.callState === 'ringing') {
          e.preventDefault()
          c.declineCall()
          return
        }
        if (c.callState === 'in-call' || c.callState === 'calling') {
          e.preventDefault()
          c.endCall()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return null
}
