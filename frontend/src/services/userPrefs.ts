/**
 * Device-local user preferences (Appearance / Voice / Notifications).
 * Persisted in localStorage; applied at runtime via CSS vars + media constraints.
 */

export type ThemeId = 'dark' | 'midnight' | 'amoled'
export type AccentId = 'orange' | 'blurple' | 'green' | 'teal' | 'rose' | 'gold'
export type DensityId = 'comfortable' | 'compact'
export type FontSizeId = 'small' | 'default' | 'large'

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
  echoCancellation: boolean
  noiseSuppression: boolean
  autoGainControl: boolean
}

export interface NotificationPrefs {
  messageSounds: boolean
  dmSounds: boolean
  callSounds: boolean
  voiceSounds: boolean
  browserCallNotifications: boolean
  browserDmNotifications: boolean
}

export interface UserPrefs {
  appearance: AppearancePrefs
  voice: VoicePrefs
  notifications: NotificationPrefs
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
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  notifications: {
    messageSounds: true,
    dmSounds: true,
    callSounds: true,
    voiceSounds: true,
    browserCallNotifications: true,
    browserDmNotifications: false,
  },
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
  },
  midnight: {
    '--app-dark': hexToRgbChannels('#1a1b2e'),
    '--app-darker': hexToRgbChannels('#0f1020'),
    '--app-channel': hexToRgbChannels('#22243a'),
    '--app-hover': hexToRgbChannels('#2e3150'),
    '--app-text': hexToRgbChannels('#e2e4f0'),
    '--app-muted': hexToRgbChannels('#a8adc4'),
  },
  amoled: {
    '--app-dark': hexToRgbChannels('#0a0a0a'),
    '--app-darker': hexToRgbChannels('#000000'),
    '--app-channel': hexToRgbChannels('#121212'),
    '--app-hover': hexToRgbChannels('#1c1c1c'),
    '--app-text': hexToRgbChannels('#e8e8e8'),
    '--app-muted': hexToRgbChannels('#9a9a9a'),
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

function mergePrefs(raw: unknown): UserPrefs {
  const base = structuredClone(DEFAULT_PREFS)
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<UserPrefs>
  return {
    appearance: { ...base.appearance, ...(r.appearance || {}) },
    voice: { ...base.voice, ...(r.voice || {}) },
    notifications: { ...base.notifications, ...(r.notifications || {}) },
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
}): UserPrefs {
  const current = loadPrefs()
  const next: UserPrefs = {
    appearance: { ...current.appearance, ...patch.appearance },
    voice: { ...current.voice, ...patch.voice },
    notifications: { ...current.notifications, ...patch.notifications },
  }
  savePrefs(next)
  return next
}

export function subscribePrefs(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
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
}

/** Media constraints for mic capture from saved prefs */
export function getAudioConstraints(prefs: VoicePrefs = loadPrefs().voice): MediaTrackConstraints {
  const c: MediaTrackConstraints = {
    echoCancellation: prefs.echoCancellation,
    noiseSuppression: prefs.noiseSuppression,
    autoGainControl: prefs.autoGainControl,
  }
  if (prefs.audioInputId) {
    c.deviceId = { exact: prefs.audioInputId }
  }
  return c
}

export function getVideoConstraints(prefs: VoicePrefs = loadPrefs().voice): MediaTrackConstraints {
  const c: MediaTrackConstraints = {}
  if (prefs.videoInputId) {
    c.deviceId = { exact: prefs.videoInputId }
  }
  return c
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
