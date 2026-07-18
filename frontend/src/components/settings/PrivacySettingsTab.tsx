import { useEffect, useState } from 'react'
import * as api from '../../services/api'
import type { PrivacySettings } from '../../services/api'
import { SettingsDropdown } from './SettingsDropdown'
import { SettingsToggle } from './SettingsToggle'

type Audience = 'everyone' | 'friends' | 'nobody'
type AddFriendAudience = 'everyone' | 'server_members' | 'nobody'

const AUDIENCE_OPTIONS: { value: Audience; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'friends', label: 'Friends' },
  { value: 'nobody', label: 'Nobody' },
]

const ADD_FRIEND_OPTIONS: { value: AddFriendAudience; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'server_members', label: 'Server members only' },
  { value: 'nobody', label: 'Nobody' },
]

function SelectRow({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string
  description: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-app-hover/30 last:border-0">
      <div className="min-w-0">
        <div className="text-sm font-medium text-white">{label}</div>
        <p className="text-xs text-app-muted mt-0.5">{description}</p>
      </div>
      <SettingsDropdown
        value={value}
        options={options}
        onChange={onChange}
        aria-label={label}
        className="flex-shrink-0"
      />
    </div>
  )
}

export function PrivacySettingsTab({ userId }: { userId: string }) {
  const [settings, setSettings] = useState<PrivacySettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.getPrivacySettings(userId)
      .then((data) => { if (!cancelled) setSettings(data) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [userId])

  const update = <K extends keyof PrivacySettings>(key: K, value: PrivacySettings[K]) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
    setMessage(null)
  }

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const saved = await api.savePrivacySettings(userId, {
        who_can_dm: settings.who_can_dm,
        who_can_call: settings.who_can_call,
        who_can_add_friend: settings.who_can_add_friend,
        show_voice_channel: settings.show_voice_channel,
        show_online_status: settings.show_online_status,
        allow_voice_activity_indicator: settings.allow_voice_activity_indicator,
      })
      setSettings(saved)
      setMessage('Privacy settings saved')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div>
        <h3 className="text-xl font-bold text-white mb-4">Privacy & Safety</h3>
        <p className="text-app-muted text-sm">Loading…</p>
      </div>
    )
  }

  if (!settings) {
    return (
      <div>
        <h3 className="text-xl font-bold text-white mb-4">Privacy & Safety</h3>
        <p className="text-red-400 text-sm">{error || 'Could not load settings'}</p>
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-xl font-bold text-white mb-1">Privacy & Safety</h3>
      <p className="text-app-muted text-sm mb-4">
        Control who can reach you in chat and voice, and what others see about your activity.
      </p>

      <div className="bg-[#2b2d31] rounded-lg px-4 mb-4">
        <h4 className="font-semibold text-white pt-4 pb-1">Communication</h4>
        <SelectRow
          label="Direct messages"
          description="Who can send you DMs"
          value={settings.who_can_dm}
          options={AUDIENCE_OPTIONS}
          onChange={(v) => update('who_can_dm', v as Audience)}
        />
        <SelectRow
          label="Voice & video calls"
          description="Who can ring you for a 1:1 call"
          value={settings.who_can_call}
          options={AUDIENCE_OPTIONS}
          onChange={(v) => update('who_can_call', v as Audience)}
        />
        <SelectRow
          label="Friend requests"
          description="Who can send you friend requests"
          value={settings.who_can_add_friend}
          options={ADD_FRIEND_OPTIONS}
          onChange={(v) => update('who_can_add_friend', v as AddFriendAudience)}
        />
      </div>

      <div className="bg-[#2b2d31] rounded-lg px-4 mb-4">
        <h4 className="font-semibold text-white pt-4 pb-1">Voice presence</h4>
        <SelectRow
          label="Show voice channel"
          description="Who can see which voice channel you are in"
          value={settings.show_voice_channel}
          options={AUDIENCE_OPTIONS}
          onChange={(v) => update('show_voice_channel', v as Audience)}
        />
        <SelectRow
          label="Online status"
          description="Who can see whether you are online, away, or DND"
          value={settings.show_online_status}
          options={AUDIENCE_OPTIONS}
          onChange={(v) => update('show_online_status', v as Audience)}
        />
        <div className="flex items-start justify-between gap-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-white">Speaking indicator</div>
            <p className="text-xs text-app-muted mt-0.5">
              Show the green speaking glow when your mic is active in voice
            </p>
          </div>
          <SettingsToggle
            checked={settings.allow_voice_activity_indicator}
            onChange={(v) => update('allow_voice_activity_indicator', v)}
            aria-label="Speaking indicator"
          />
        </div>
      </div>

      {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
      {message && <p className="text-green-400 text-sm mb-2">{message}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 bg-app-accent hover:bg-app-accent-hover rounded text-sm text-white font-medium disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  )
}
