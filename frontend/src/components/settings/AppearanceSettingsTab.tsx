import { useEffect, useState } from 'react'
import {
  loadPrefs,
  updatePrefs,
  type AccentId,
  type DensityId,
  type FontSizeId,
  type ThemeId,
} from '../../services/userPrefs'

const THEMES: { id: ThemeId; label: string; desc: string }[] = [
  { id: 'dark', label: 'Dark', desc: 'Classic Discord-style charcoal' },
  { id: 'midnight', label: 'Midnight', desc: 'Cool blue-tinted night theme' },
  { id: 'amoled', label: 'AMOLED', desc: 'True black for OLED screens' },
]

const ACCENTS: { id: AccentId; label: string; swatch: string }[] = [
  { id: 'blurple', label: 'Blurple', swatch: '#5865f2' },
  { id: 'green', label: 'Green', swatch: '#23a559' },
  { id: 'teal', label: 'Teal', swatch: '#1abc9c' },
  { id: 'rose', label: 'Rose', swatch: '#eb459e' },
  { id: 'gold', label: 'Gold', swatch: '#f0b232' },
]

export function AppearanceSettingsTab() {
  const [theme, setTheme] = useState<ThemeId>('dark')
  const [accent, setAccent] = useState<AccentId>('blurple')
  const [density, setDensity] = useState<DensityId>('comfortable')
  const [fontSize, setFontSize] = useState<FontSizeId>('default')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const p = loadPrefs().appearance
    setTheme(p.theme)
    setAccent(p.accent)
    setDensity(p.density)
    setFontSize(p.fontSize)
  }, [])

  const apply = (patch: {
    theme?: ThemeId
    accent?: AccentId
    density?: DensityId
    fontSize?: FontSizeId
  }) => {
    if (patch.theme) setTheme(patch.theme)
    if (patch.accent) setAccent(patch.accent)
    if (patch.density) setDensity(patch.density)
    if (patch.fontSize) setFontSize(patch.fontSize)
    updatePrefs({ appearance: patch })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div>
      <h3 className="text-xl font-bold text-white mb-1">Appearance</h3>
      <p className="text-app-muted text-sm mb-4">
        Theme, accent color, and chat density. Changes apply instantly on this device.
      </p>

      <div className="bg-[#2b2d31] rounded-lg p-4 mb-4 space-y-3">
        <h4 className="font-semibold text-white">Theme</h4>
        <div className="grid gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => apply({ theme: t.id })}
              className={`w-full text-left px-3 py-2.5 rounded-md border transition-colors ${
                theme === t.id
                  ? 'border-app-accent bg-app-accent/20 text-white'
                  : 'border-transparent bg-[#1e1f22] text-app-muted hover:text-app-text'
              }`}
            >
              <div className="text-sm font-medium">{t.label}</div>
              <div className="text-xs opacity-80 mt-0.5">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#2b2d31] rounded-lg p-4 mb-4 space-y-3">
        <h4 className="font-semibold text-white">Accent color</h4>
        <div className="flex flex-wrap gap-2">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => apply({ accent: a.id })}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                accent === a.id
                  ? 'border-white/40 text-white'
                  : 'border-transparent text-app-muted hover:text-app-text'
              }`}
              style={{ background: `${a.swatch}33` }}
            >
              <span className="w-3.5 h-3.5 rounded-full" style={{ background: a.swatch }} />
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#2b2d31] rounded-lg p-4 mb-4 space-y-4">
        <div>
          <h4 className="font-semibold text-white mb-2">Chat density</h4>
          <div className="flex gap-2">
            {([
              ['comfortable', 'Comfortable'],
              ['compact', 'Compact'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => apply({ density: id })}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  density === id
                    ? 'bg-app-accent text-white'
                    : 'bg-[#1e1f22] text-app-muted hover:text-app-text'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-semibold text-white mb-2">UI font size</h4>
          <div className="flex gap-2">
            {([
              ['small', 'Small'],
              ['default', 'Default'],
              ['large', 'Large'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => apply({ fontSize: id })}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  fontSize === id
                    ? 'bg-app-accent text-white'
                    : 'bg-[#1e1f22] text-app-muted hover:text-app-text'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {saved && <p className="text-green-400 text-sm">Appearance updated</p>}
    </div>
  )
}
