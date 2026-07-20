import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  loadPrefs,
  subscribePrefs,
  updatePrefs,
  type AccentId,
  type AppearancePrefs,
  type FontSizeId,
  type ThemeId,
} from '../../services/userPrefs'
import { SettingsDropdown, type SettingsDropdownOption } from './SettingsDropdown'
import { SettingsToggle } from './SettingsToggle'

const THEME_OPTIONS: SettingsDropdownOption[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'midnight', label: 'Midnight' },
  { value: 'amoled', label: 'AMOLED' },
  { value: 'white', label: 'White' },
]

const ACCENT_OPTIONS: SettingsDropdownOption[] = [
  { value: 'orange', label: 'Nepsis Orange' },
  { value: 'blurple', label: 'Blurple' },
  { value: 'green', label: 'Green' },
  { value: 'teal', label: 'Teal' },
  { value: 'rose', label: 'Rose' },
  { value: 'gold', label: 'Gold' },
]

const FONT_SIZE_OPTIONS: SettingsDropdownOption[] = [
  { value: 'small', label: 'Small' },
  { value: 'default', label: 'Default' },
  { value: 'large', label: 'Large' },
]

function Field({
  label,
  description,
  children,
}: {
  label: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-app-hover/30 last:border-0">
      <div className="min-w-0">
        <div className="text-sm font-medium text-app-text">{label}</div>
        <p className="text-xs text-app-muted mt-0.5">{description}</p>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

export function AppearanceSettingsTab() {
  const [prefs, setPrefs] = useState<AppearancePrefs>(() => loadPrefs().appearance)
  const [saved, setSaved] = useState(false)
  const savedTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return subscribePrefs((next) => setPrefs(next.appearance))
  }, [])

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current)
    }
  }, [])

  const persist = (patch: Partial<AppearancePrefs>) => {
    const next = updatePrefs({ appearance: patch }).appearance
    setPrefs(next)
    setSaved(true)
    if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current)
    savedTimerRef.current = window.setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div>
      <h3 className="text-xl font-bold text-app-text mb-1">Appearance</h3>
      <p className="text-app-muted text-sm mb-4">
        Customize the local look and feel of Nepsis Chat.
      </p>

      <div className="bg-app-channel rounded-lg px-4 mb-4">
        <h4 className="font-semibold text-app-text pt-4 pb-1">Theme</h4>
        <Field label="Color theme" description="Choose the base surface palette.">
          <SettingsDropdown
            value={prefs.theme}
            onChange={(v) => persist({ theme: v as ThemeId })}
            options={THEME_OPTIONS}
            aria-label="Color theme"
          />
        </Field>
        <Field label="Accent color" description="Applies to buttons, focus states, and highlights.">
          <SettingsDropdown
            value={prefs.accent}
            onChange={(v) => persist({ accent: v as AccentId })}
            options={ACCENT_OPTIONS}
            aria-label="Accent color"
          />
        </Field>
      </div>

      <div className="bg-app-channel rounded-lg px-4 mb-4">
        <h4 className="font-semibold text-app-text pt-4 pb-1">Layout</h4>
        <Field label="Compact density" description="Reduces vertical spacing in message lists.">
          <SettingsToggle
            checked={prefs.density === 'compact'}
            onChange={(checked) => persist({ density: checked ? 'compact' : 'comfortable' })}
            aria-label="Compact density"
          />
        </Field>
        <Field label="Font size" description="Adjusts the app text scale on this device.">
          <SettingsDropdown
            value={prefs.fontSize}
            onChange={(v) => persist({ fontSize: v as FontSizeId })}
            options={FONT_SIZE_OPTIONS}
            aria-label="Font size"
          />
        </Field>
      </div>

      {saved && <p className="text-green-400 text-sm">Appearance settings saved</p>}
    </div>
  )
}
