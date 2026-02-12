/**
 * Sound effects using Web Audio API — no external audio files needed.
 * All sounds are generated programmatically with pleasant tones.
 *
 * Usage:
 *   import { sounds } from '../services/sounds'
 *   sounds.messageNotification()
 *   const stop = sounds.callRinging()  // returns stop function
 *   stop()                              // stops looping sound
 */

class SoundManager {
  private ctx: AudioContext | null = null

  private getCtx(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext()
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
    return this.ctx
  }

  /** Play a tone with smooth ADSR envelope */
  private tone(
    freq: number,
    startTime: number,
    duration: number,
    opts: { type?: OscillatorType; volume?: number } = {}
  ) {
    const ctx = this.getCtx()
    const { type = 'sine', volume = 0.15 } = opts
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq

    const attack = 0.01
    gain.gain.setValueAtTime(0, startTime)
    gain.gain.linearRampToValueAtTime(volume, startTime + attack)
    gain.gain.setValueAtTime(volume, startTime + duration * 0.7)
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(startTime)
    osc.stop(startTime + duration)
    return osc
  }

  // ─── Notification ──────────────────────────────────────────────

  /** Short "ding" for new messages */
  messageNotification() {
    const ctx = this.getCtx()
    const t = ctx.currentTime
    this.tone(880, t, 0.15, { volume: 0.1 })
    this.tone(1174.66, t + 0.08, 0.18, { volume: 0.07 })
  }

  // ─── Voice channel ─────────────────────────────────────────────

  /** Someone joined voice — rising two-note chime */
  userJoin() {
    const ctx = this.getCtx()
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => this._playUserJoin())
    } else {
      this._playUserJoin()
    }
  }

  private _playUserJoin() {
    const ctx = this.getCtx()
    const t = ctx.currentTime
    this.tone(523.25, t, 0.12, { volume: 0.18, type: 'triangle' })
    this.tone(659.25, t + 0.08, 0.15, { volume: 0.18, type: 'triangle' })
  }

  /** Someone left voice — falling two-note chime */
  userLeave() {
    const ctx = this.getCtx()
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => this._playUserLeave())
    } else {
      this._playUserLeave()
    }
  }

  private _playUserLeave() {
    const ctx = this.getCtx()
    const t = ctx.currentTime
    this.tone(659.25, t, 0.12, { volume: 0.18, type: 'triangle' })
    this.tone(523.25, t + 0.08, 0.15, { volume: 0.18, type: 'triangle' })
  }

  /** Connected to voice channel — rising chord */
  voiceConnected() {
    const ctx = this.getCtx()
    const t = ctx.currentTime
    this.tone(523.25, t, 0.18, { volume: 0.1 })
    this.tone(659.25, t + 0.1, 0.18, { volume: 0.1 })
    this.tone(783.99, t + 0.2, 0.3, { volume: 0.1 })
  }

  /** Disconnected from voice channel — falling tone */
  voiceDisconnected() {
    const ctx = this.getCtx()
    const t = ctx.currentTime
    this.tone(440, t, 0.2, { volume: 0.1 })
    this.tone(349.23, t + 0.12, 0.25, { volume: 0.08 })
  }

  // ─── Calls ─────────────────────────────────────────────────────

  /** Call connected — success chime */
  callConnected() {
    const ctx = this.getCtx()
    const t = ctx.currentTime
    this.tone(523.25, t, 0.18, { volume: 0.12 })
    this.tone(659.25, t + 0.1, 0.18, { volume: 0.12 })
    this.tone(783.99, t + 0.2, 0.35, { volume: 0.12 })
  }

  /** Call ended / declined — low disconnect tone */
  callDisconnected() {
    const ctx = this.getCtx()
    const t = ctx.currentTime
    this.tone(440, t, 0.2, { volume: 0.1 })
    this.tone(349.23, t + 0.12, 0.3, { volume: 0.08 })
  }

  /** Incoming call ring (loops) — returns stop function */
  callRinging(): () => void {
    let stopped = false
    const timeouts: number[] = []

    const ring = () => {
      if (stopped) return
      const ctx = this.getCtx()
      const t = ctx.currentTime
      // Two-burst ring pattern
      this.tone(440, t, 0.3, { volume: 0.14 })
      this.tone(480, t, 0.3, { volume: 0.14 })
      this.tone(440, t + 0.4, 0.3, { volume: 0.14 })
      this.tone(480, t + 0.4, 0.3, { volume: 0.14 })
      timeouts.push(window.setTimeout(ring, 2500))
    }
    ring()

    return () => {
      stopped = true
      timeouts.forEach(clearTimeout)
    }
  }

  /** Outgoing ring-back tone (loops) — returns stop function */
  callOutgoing(): () => void {
    let stopped = false
    const timeouts: number[] = []

    const ring = () => {
      if (stopped) return
      const ctx = this.getCtx()
      const t = ctx.currentTime
      this.tone(440, t, 0.8, { volume: 0.06 })
      this.tone(480, t, 0.8, { volume: 0.06 })
      timeouts.push(window.setTimeout(ring, 3500))
    }
    ring()

    return () => {
      stopped = true
      timeouts.forEach(clearTimeout)
    }
  }
}

export const sounds = new SoundManager()
