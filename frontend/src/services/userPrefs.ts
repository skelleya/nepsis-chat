/**
 * Device-local user preferences (Appearance / Voice / Notifications).
 * Persisted in localStorage; applied at runtime via CSS vars + media constraints.
 */

import { HIGH_QUALITY_CAMERA, highQualityAudioBase } from './mediaQuality'

export type ThemeId = 'dark' | 'midnight' | 'amoled' | 'white'
export type AccentId = 'orange' | 'blurple' | 'green' | 'teal' | 'rose' | 'gold'
export type DensityId = 'comfortable' | 'compact'
export type FontSizeId = 'small' | 'default' | 'large'
export type CameraQualityId = '1080p' | '1440p'
export type ScreenQualityId = '1080p' | '1440p' | '4k'
export type MicProcessingLevel = 'off' | 'standard' | 'high'

export interface AppearancePrefs {
  theme: ThemeId
  accent: AccentId
  density: DensityId
  fontSize: FontSizeId
}

export interface VoicePrefs {
  audioInputId: string
  audioOutputId: string
  videoInputId: string
  outputVolume: number
  micProcessing: MicProcessingLevel
  echoCancellation: boolean
  noiseSuppression: boolean
  autoGainControl: boolean
  cameraQuality: CameraQualityId
  screenQuality: ScreenQualityId
  includeScreenShareAudio: boolean
  /** Mirror only the local self-preview; transmitted/remote video stays natural. */
  mirrorCameraPreview: boolean
}

export interface NotificationPrefs {
  messageSounds: boolean
  dmSounds: boolean
  callSounds: boolean
  voiceSounds: boolean
  browserCallNotifications: boolean
  browserDmNotifications: boolean
}

/** Stable action ids for remappable keyboard shortcuts. */
export type KeybindingActionId =
  | 'toggleMute'
  | 'toggleDeafen'
  | 'toggleCamera'
  | 'toggleScreenShare'
  | 'disconnectVoice'
  | 'answerCall'
  | 'declineCall'

export type KeybindingsPrefs = Record<KeybindingActionId, string>

export interface UserPrefs {
  appearance: AppearancePrefs
  voice: VoicePrefs
  notifications: NotificationPrefs
  keybindings: KeybindingsPrefs
  /** Per-peer mic volume multipliers (0–2 → 0%–200%). Default 1 (100%). */
  peerVolumes: Record<string, number>
  /** Per-peer screen-share audio multipliers (0–2 → 0%–200%). Default 1 (100%). */
  streamVolumes: Record<string, number>
}

const STORAGE_KEY = 'nepsis_user_prefs'
/** One-time migrate old default accent (blurple) → Nepsis orange */
const ACCENT_MIGRATE_KEY = 'nepsis_accent_orange_v1'

export const DEFAULT_PREFS: UserPrefs = {
  appearance: {
    theme: 'dark',
    accent: 'orange',
    density: 'comfortable',
    fontSize: 'default',
  },
  voice: {
    audioInputId: '',
    audioOutputId: '',
    videoInputId: '',
    outputVolume: 1,
    micProcessing: 'standard',
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    cameraQuality: '1080p',
    screenQuality: '1440p',
    includeScreenShareAudio: false,
    mirrorCameraPreview: false,
  },
  notifications: {
    messageSounds: true,
    dmSounds: true,
    callSounds: true,
    voiceSounds: true,
    browserCallNotifications: true,
    browserDmNotifications: false,
  },
  keybindings: {
    toggleMute: 'Ctrl+Shift+M',
    toggleDeafen: 'Ctrl+Shift+D',
    toggleCamera: 'Ctrl+Shift+V',
    toggleScreenShare: 'Ctrl+Shift+S',
    disconnectVoice: 'Ctrl+Shift+E',
    answerCall: 'Ctrl+Shift+A',
    declineCall: 'Ctrl+Shift+X',
  },
  peerVolumes: {},
  streamVolumes: {},
}

export const KEYBINDING_LABELS: Record<KeybindingActionId, { label: string; description: string }> = {
  toggleMute: { label: 'Toggle mute', description: 'Mute or unmute your microphone in voice.' },
  toggleDeafen: { label: 'Toggle deafen', description: 'Deafen or undeafen in voice.' },
  toggleCamera: { label: 'Toggle camera', description: 'Turn your camera on or off.' },
  toggleScreenShare: { label: 'Toggle screen share', description: 'Start or stop sharing your screen.' },
  disconnectVoice: { label: 'Disconnect from voice', description: 'Leave the current voice channel.' },
  answerCall: { label: 'Answer call', description: 'Accept an incoming DM call.' },
  declineCall: { label: 'Decline / end call', description: 'Decline ringing or end the active call.' },
}

/** Clamp user/stream volume sliders to 0–200% (stored as 0–2). */
export function clampUserVolume(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(2, Math.max(0, value))
}

function normalizeVolumeMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = clampUserVolume(value)
    }
  }
  return out
}

/** Hex → "R G B" channel string for Tailwind `rgb(var(--x) / <alpha-value>)`. */
function hexToRgbChannels(hex: string): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}

const THEMES: Record<ThemeId, Record<string, string>> = {
  dark: {
    '--app-dark': hexToRgbChannels('#1e1f22'),
    '--app-darker': hexToRgbChannels('#111214'),
    '--app-channel': hexToRgbChannels('#2b2d31'),
    '--app-hover': hexToRgbChannels('#35373c'),
    '--app-text': hexToRgbChannels('#dbdee1'),
    '--app-muted': hexToRgbChannels('#b5bac1'),
    '--app-glass': hexToRgbChannels('#ffffff'),
    '--app-panel': hexToRgbChannels('#16171a'),
  },
  midnight: {
    '--app-dark': hexToRgbChannels('#1a1b2e'),
    '--app-darker': hexToRgbChannels('#0f1020'),
    '--app-channel': hexToRgbChannels('#22243a'),
    '--app-hover': hexToRgbChannels('#2e3150'),
    '--app-text': hexToRgbChannels('#e2e4f0'),
    '--app-muted': hexToRgbChannels('#a8adc4'),
    '--app-glass': hexToRgbChannels('#ffffff'),
    '--app-panel': hexToRgbChannels('#16171a'),
  },
  amoled: {
    '--app-dark': hexToRgbChannels('#0a0a0a'),
    '--app-darker': hexToRgbChannels('#000000'),
    '--app-channel': hexToRgbChannels('#121212'),
    '--app-hover': hexToRgbChannels('#1c1c1c'),
    '--app-text': hexToRgbChannels('#e8e8e8'),
    '--app-muted': hexToRgbChannels('#9a9a9a'),
    '--app-glass': hexToRgbChannels('#ffffff'),
    '--app-panel': hexToRgbChannels('#0a0a0a'),
  },
  /** Bright white / light surfaces — glass overlays use black ink */
  white: {
    '--app-dark': hexToRgbChannels('#f2f3f5'),
    '--app-darker': hexToRgbChannels('#e3e5e8'),
    '--app-channel': hexToRgbChannels('#ffffff'),
    '--app-hover': hexToRgbChannels('#e8e9ed'),
    '--app-text': hexToRgbChannels('#1e1f22'),
    '--app-muted': hexToRgbChannels('#5c5e66'),
    '--app-glass': hexToRgbChannels('#000000'),
    '--app-panel': hexToRgbChannels('#ffffff'),
  },
}

const ACCENTS: Record<AccentId, { accent: string; hover: string }> = {
  orange: { accent: hexToRgbChannels('#FF5A1F'), hover: hexToRgbChannels('#E04E1A') },
  blurple: { accent: hexToRgbChannels('#5865f2'), hover: hexToRgbChannels('#4752c4') },
  green: { accent: hexToRgbChannels('#23a559'), hover: hexToRgbChannels('#1a7f43') },
  teal: { accent: hexToRgbChannels('#1abc9c'), hover: hexToRgbChannels('#159a80') },
  rose: { accent: hexToRgbChannels('#eb459e'), hover: hexToRgbChannels('#c73b85') },
  gold: { accent: hexToRgbChannels('#f0b232'), hover: hexToRgbChannels('#c9951f') },
}

const FONT_SIZES: Record<FontSizeId, string> = {
  small: '14px',
  default: '16px',
  large: '18px',
}

type Listener = (prefs: UserPrefs) => void
const listeners = new Set<Listener>()

const VALID_THEMES = new Set<ThemeId>(['dark', 'midnight', 'amoled', 'white'])
const VALID_MIC_PROCESSING = new Set<MicProcessingLevel>(['off', 'standard', 'high'])

function getMicProcessingBooleans(level: MicProcessingLevel): Pick<
  VoicePrefs,
  'echoCancellation' | 'noiseSuppression' | 'autoGainControl'
> {
  if (level === 'off') {
    return {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    }
  }
  return {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  }
}

function normalizeVoicePrefs(raw: Partial<VoicePrefs> | undefined, base = DEFAULT_PREFS.voice): VoicePrefs {
  const merged = { ...base, ...(raw || {}) }
  const derivedMicProcessing =
    merged.echoCancellation === false &&
    merged.noiseSuppression === false &&
    merged.autoGainControl === false
      ? 'off'
      : 'standard'
  const micProcessing = VALID_MIC_PROCESSING.has(merged.micProcessing)
    ? merged.micProcessing
    : derivedMicProcessing
  return {
    ...merged,
    micProcessing,
    ...getMicProcessingBooleans(micProcessing),
  }
}

function normalizeKeybindings(raw: Partial<KeybindingsPrefs> | undefined, base = DEFAULT_PREFS.keybindings): KeybindingsPrefs {
  const merged = { ...base, ...(raw || {}) }
  const out = { ...base }
  for (const key of Object.keys(base) as KeybindingActionId[]) {
    const value = merged[key]
    if (typeof value === 'string' && value.trim()) out[key] = value.trim()
  }
  return out
}

function mergePrefs(raw: unknown): UserPrefs {
  const base = structuredClone(DEFAULT_PREFS)
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<UserPrefs>
  const appearance = { ...base.appearance, ...(r.appearance || {}) }
  if (!VALID_THEMES.has(appearance.theme)) {
    appearance.theme = base.appearance.theme
  }
  return {
    appearance,
    voice: normalizeVoicePrefs(r.voice, base.voice),
    notifications: { ...base.notifications, ...(r.notifications || {}) },
    keybindings: normalizeKeybindings(r.keybindings, base.keybindings),
    peerVolumes: normalizeVolumeMap(r.peerVolumes),
    streamVolumes: normalizeVolumeMap(r.streamVolumes),
  }
}

export function loadPrefs(): UserPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return structuredClone(DEFAULT_PREFS)
    const prefs = mergePrefs(JSON.parse(raw))
    // Old installs defaulted to Discord blurple — move to orange once (can re-pick Blurple in Appearance)
    if (!localStorage.getItem(ACCENT_MIGRATE_KEY) && prefs.appearance.accent === 'blurple') {
      prefs.appearance.accent = 'orange'
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
      localStorage.setItem(ACCENT_MIGRATE_KEY, '1')
    }
    return prefs
  } catch {
    return structuredClone(DEFAULT_PREFS)
  }
}

export function savePrefs(prefs: UserPrefs): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  applyAppearancePrefs(prefs.appearance)
  listeners.forEach((fn) => fn(prefs))
}

export function updatePrefs(patch: {
  appearance?: Partial<AppearancePrefs>
  voice?: Partial<VoicePrefs>
  notifications?: Partial<NotificationPrefs>
  keybindings?: Partial<KeybindingsPrefs>
  peerVolumes?: Record<string, number>
  streamVolumes?: Record<string, number>
}): UserPrefs {
  const current = loadPrefs()
  const next: UserPrefs = {
    appearance: { ...current.appearance, ...patch.appearance },
    voice: normalizeVoicePrefs({ ...current.voice, ...patch.voice }, current.voice),
    notifications: { ...current.notifications, ...patch.notifications },
    keybindings: normalizeKeybindings(
      { ...current.keybindings, ...patch.keybindings },
      current.keybindings
    ),
    peerVolumes:
      patch.peerVolumes !== undefined
        ? normalizeVolumeMap(patch.peerVolumes)
        : current.peerVolumes,
    streamVolumes:
      patch.streamVolumes !== undefined
        ? normalizeVolumeMap(patch.streamVolumes)
        : current.streamVolumes,
  }
  savePrefs(next)
  return next
}

/** Serialize a KeyboardEvent into a stable shortcut string (e.g. Ctrl+Shift+M). */
export function formatKeyCombo(e: KeyboardEvent): string | null {
  if (e.key === 'Control' || e.key === 'Shift' || e.key === 'Alt' || e.key === 'Meta') return null
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  let key = e.key
  if (key === ' ') key = 'Space'
  else if (key.length === 1) key = key.toUpperCase()
  else key = key.length ? key[0].toUpperCase() + key.slice(1) : key
  if (!key) return null
  parts.push(key)
  return parts.join('+')
}

/** Match a KeyboardEvent against a stored combo like `Ctrl+Shift+M`. */
export function eventMatchesCombo(e: KeyboardEvent, combo: string): boolean {
  if (!combo) return false
  const parts = combo.split('+').map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return false
  const wantCtrl = parts.includes('Ctrl') || parts.includes('Meta') || parts.includes('Cmd')
  const wantAlt = parts.includes('Alt')
  const wantShift = parts.includes('Shift')
  const keyPart = parts.filter((p) => !['Ctrl', 'Meta', 'Cmd', 'Alt', 'Shift'].includes(p)).pop()
  if (!keyPart) return false
  if (!!wantCtrl !== (e.ctrlKey || e.metaKey)) return false
  if (!!wantAlt !== e.altKey) return false
  if (!!wantShift !== e.shiftKey) return false
  let key = e.key
  if (key === ' ') key = 'Space'
  else if (key.length === 1) key = key.toUpperCase()
  else key = key.length ? key[0].toUpperCase() + key.slice(1) : key
  return key.toLowerCase() === keyPart.toLowerCase()
}

export function subscribePrefs(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getPeerVolume(userId: string, prefs: UserPrefs = loadPrefs()): number {
  const v = prefs.peerVolumes[userId]
  return typeof v === 'number' ? clampUserVolume(v) : 1
}

export function getStreamVolume(userId: string, prefs: UserPrefs = loadPrefs()): number {
  const v = prefs.streamVolumes[userId]
  return typeof v === 'number' ? clampUserVolume(v) : 1
}

export function setPeerVolume(userId: string, volume: number): UserPrefs {
  const current = loadPrefs()
  return updatePrefs({
    peerVolumes: { ...current.peerVolumes, [userId]: clampUserVolume(volume) },
  })
}

export function setStreamVolume(userId: string, volume: number): UserPrefs {
  const current = loadPrefs()
  return updatePrefs({
    streamVolumes: { ...current.streamVolumes, [userId]: clampUserVolume(volume) },
  })
}

export function applyAppearancePrefs(appearance: AppearancePrefs = loadPrefs().appearance): void {
  const root = document.documentElement
  const theme = THEMES[appearance.theme] || THEMES.dark
  Object.entries(theme).forEach(([k, v]) => root.style.setProperty(k, v))

  const accent = ACCENTS[appearance.accent] || ACCENTS.orange
  root.style.setProperty('--app-accent', accent.accent)
  root.style.setProperty('--app-accent-hover', accent.hover)
  root.style.setProperty('--app-font-size', FONT_SIZES[appearance.fontSize] || FONT_SIZES.default)

  root.dataset.theme = appearance.theme
  root.dataset.density = appearance.density
  root.dataset.fontSize = appearance.fontSize
  root.style.colorScheme = appearance.theme === 'white' ? 'light' : 'dark'
}

/** Media constraints for mic capture — high-quality defaults + user processing preset */
export function getAudioConstraints(prefs: VoicePrefs = loadPrefs().voice): MediaTrackConstraints {
  const normalizedPrefs = normalizeVoicePrefs(prefs)
  const c: MediaTrackConstraints & { voiceIsolation?: boolean } = {
    ...highQualityAudioBase(),
  }
  if (normalizedPrefs.micProcessing === 'off') {
    c.echoCancellation = false
    c.noiseSuppression = false
    c.autoGainControl = false
  } else {
    c.echoCancellation = true
    c.noiseSuppression = true
    c.autoGainControl = true
    const supported = navigator.mediaDevices?.getSupportedConstraints?.() as MediaTrackSupportedConstraints & {
      voiceIsolation?: boolean
    }
    if (normalizedPrefs.micProcessing === 'high' && supported?.voiceIsolation) {
      c.voiceIsolation = true
    }
  }
  if (normalizedPrefs.audioInputId) {
    c.deviceId = { exact: normalizedPrefs.audioInputId }
  }
  return c
}

export function getVideoConstraints(prefs: VoicePrefs = loadPrefs().voice): MediaTrackConstraints {
  const size = prefs.cameraQuality === '1440p'
    ? { width: 2560, height: 1440 }
    : { width: 1920, height: 1080 }
  const c: MediaTrackConstraints = {
    ...HIGH_QUALITY_CAMERA,
    width: { ideal: size.width, max: size.width },
    height: { ideal: size.height, max: size.height },
  }
  if (prefs.videoInputId) {
    c.deviceId = { exact: prefs.videoInputId }
  }
  return c
}

export function getScreenConstraints(prefs: VoicePrefs = loadPrefs().voice): MediaTrackConstraints {
  const size =
    prefs.screenQuality === '4k'
      ? { width: 3840, height: 2160 }
      : prefs.screenQuality === '1440p'
        ? { width: 2560, height: 1440 }
        : { width: 1920, height: 1080 }
  return {
    width: { ideal: size.width, max: size.width },
    height: { ideal: size.height, max: size.height },
    frameRate: { ideal: 30, max: 60 },
  }
}

export async function applyAudioOutputDevice(
  el: HTMLMediaElement | null | undefined,
  deviceId: string = loadPrefs().voice.audioOutputId
): Promise<void> {
  if (!el || !deviceId) return
  const anyEl = el as HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> }
  if (typeof anyEl.setSinkId === 'function') {
    try {
      await anyEl.setSinkId(deviceId)
    } catch {
      /* unsupported / permission */
    }
  }
}
