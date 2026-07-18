import { useEffect, useState } from 'react'
import { loadPrefs, updatePrefs, type NotificationPrefs } from '../../services/userPrefs'

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-app-hover/30 last:border-0">
      <div className="min-w-0">
        <div className="text-sm font-medium text-white">{label}</div>
        <p className="text-xs text-app-muted mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
          checked ? 'bg-app-accent' : 'bg-[#1e1f22]'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  )
}

export function NotificationsSettingsTab() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => loadPrefs().notifications)
  const [saved, setSaved] = useState(false)
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>('default')

  useEffect(() => {
    if (typeof Notification === 'undefined') setPerm('unsupported')
    else setPerm(Notification.permission)
  }, [])

  const persist = (patch: Partial<NotificationPrefs>) => {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    updatePrefs({ notifications: patch })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1500)
  }

  const requestBrowserPermission = async () => {
    if (typeof Notification === 'undefined') return
    const result = await Notification.requestPermission()
    setPerm(result)
  }

  return (
    <div>
      <h3 className="text-xl font-bold text-white mb-1">Notifications</h3>
      <p className="text-app-muted text-sm mb-4">
        Control sounds and desktop alerts on this device.
      </p>

      <div className="bg-[#2b2d31] rounded-lg px-4 mb-4">
        <h4 className="font-semibold text-white pt-4 pb-1">Sounds</h4>
        <Toggle
          label="Message sounds"
          description="Play a sound for new messages in the channel you are viewing"
          checked={prefs.messageSounds}
          onChange={(v) => persist({ messageSounds: v })}
        />
        <Toggle
          label="Direct message sounds"
          description="Play a sound for new DMs (including when another chat is open)"
          checked={prefs.dmSounds}
          onChange={(v) => persist({ dmSounds: v })}
        />
        <Toggle
          label="Call sounds"
          description="Ringing and connect/disconnect tones for 1:1 calls"
          checked={prefs.callSounds}
          onChange={(v) => persist({ callSounds: v })}
        />
        <Toggle
          label="Voice channel sounds"
          description="Join, leave, and connect tones in voice channels"
          checked={prefs.voiceSounds}
          onChange={(v) => persist({ voiceSounds: v })}
        />
      </div>

      <div className="bg-[#2b2d31] rounded-lg px-4 mb-4">
        <h4 className="font-semibold text-white pt-4 pb-1">Desktop notifications</h4>
        <Toggle
          label="Incoming call alerts"
          description="Show a system notification when someone calls and the tab is in the background"
          checked={prefs.browserCallNotifications}
          onChange={(v) => persist({ browserCallNotifications: v })}
        />
        <Toggle
          label="DM alerts when away"
          description="Show a system notification for new DMs when this tab is hidden"
          checked={prefs.browserDmNotifications}
          onChange={(v) => persist({ browserDmNotifications: v })}
        />
        <div className="py-3">
          <p className="text-xs text-app-muted mb-2">
            Browser permission:{' '}
            <span className="text-app-text font-medium">
              {perm === 'unsupported' ? 'not supported' : perm}
            </span>
          </p>
          {perm !== 'granted' && perm !== 'unsupported' && (
            <button
              type="button"
              onClick={requestBrowserPermission}
              className="px-3 py-2 rounded-md text-sm font-medium bg-app-accent hover:bg-app-accent-hover text-white"
            >
              Enable browser notifications
            </button>
          )}
        </div>
      </div>

      {saved && <p className="text-green-400 text-sm">Notification settings saved</p>}
    </div>
  )
}
