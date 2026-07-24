import { useEffect, useRef, useState } from 'react'
import {
  DEFAULT_PREFS,
  KEYBINDING_LABELS,
  formatKeyCombo,
  loadPrefs,
  subscribePrefs,
  updatePrefs,
  type KeybindingActionId,
  type KeybindingsPrefs,
} from '../../services/userPrefs'

const ACTION_ORDER: KeybindingActionId[] = [
  'toggleMute',
  'toggleDeafen',
  'toggleCamera',
  'toggleScreenShare',
  'disconnectVoice',
  'answerCall',
  'declineCall',
]

/**
 * Settings → Keybindings — remappable shortcuts persisted in local prefs.
 */
export function KeybindingsSettingsTab() {
  const [bindings, setBindings] = useState<KeybindingsPrefs>(() => loadPrefs().keybindings)
  const [listening, setListening] = useState<KeybindingActionId | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savedTimerRef = useRef<number | null>(null)

  useEffect(() => subscribePrefs((next) => setBindings(next.keybindings)), [])

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!listening) return
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        setListening(null)
        return
      }
      const combo = formatKeyCombo(e)
      if (!combo) return
      const conflict = (Object.keys(bindings) as KeybindingActionId[]).find(
        (id) => id !== listening && bindings[id] === combo
      )
      if (conflict) {
        setError(`Already used by ${KEYBINDING_LABELS[conflict].label}`)
        return
      }
      setError(null)
      const next = updatePrefs({ keybindings: { [listening]: combo } }).keybindings
      setBindings(next)
      setListening(null)
      setSaved(true)
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current)
      savedTimerRef.current = window.setTimeout(() => setSaved(false), 1500)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [listening, bindings])

  const resetDefaults = () => {
    const next = updatePrefs({ keybindings: { ...DEFAULT_PREFS.keybindings } }).keybindings
    setBindings(next)
    setListening(null)
    setError(null)
    setSaved(true)
    if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current)
    savedTimerRef.current = window.setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-app-text">Keybindings</h3>
          <p className="mt-1 text-sm text-app-muted">
            Click a shortcut, then press the new keys. Esc cancels. Shortcuts are ignored while typing in inputs.
          </p>
        </div>
        <button
          type="button"
          onClick={resetDefaults}
          className="rounded-md px-2.5 py-1.5 text-xs font-medium text-app-muted hover:bg-app-hover hover:text-app-text"
        >
          Reset defaults
        </button>
      </div>

      {saved && <p className="mb-2 text-xs text-green-400">Saved</p>}
      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}

      <div className="rounded-lg bg-app-channel px-3">
        {ACTION_ORDER.map((id) => {
          const meta = KEYBINDING_LABELS[id]
          const isListening = listening === id
          return (
            <div
              key={id}
              className="flex items-center justify-between gap-4 border-b border-app-hover/30 py-3 last:border-0"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-app-text">{meta.label}</div>
                <p className="mt-0.5 text-xs text-app-muted">{meta.description}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setListening(isListening ? null : id)
                }}
                className={`min-w-[7.5rem] rounded-md border px-2.5 py-1.5 font-mono text-xs font-semibold transition-colors ${
                  isListening
                    ? 'border-app-accent bg-app-accent/15 text-app-accent'
                    : 'border-app-glass/15 bg-app-darker text-app-text hover:border-app-accent/40'
                }`}
              >
                {isListening ? 'Press keys…' : bindings[id] || 'None'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
