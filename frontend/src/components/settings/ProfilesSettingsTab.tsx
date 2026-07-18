import { useCallback, useEffect, useRef, useState } from 'react'
import * as api from '../../services/api'
import type { FriendListItem, ProfileType, VisibleProfiles } from '../../services/api'
import { SettingsDropdown } from './SettingsDropdown'
import { SettingsToggle } from './SettingsToggle'

interface ProfileRow {
  id: string
  profile_type: ProfileType
  display_name: string
  bio?: string
  avatar_url?: string | null
  banner_url?: string | null
  discoverable?: boolean
}

type ProfilePreview = {
  display_name: string
  avatar_url?: string | null
  banner_url?: string | null
}

interface ProfilesSettingsTabProps {
  user: { id: string; username: string; display_name?: string | null; avatar_url?: string; banner_url?: string; is_guest?: boolean }
  onUserUpdate?: (data: { username?: string; display_name?: string | null; avatar_url?: string; banner_url?: string }) => void
  /** When set from My Account, highlight this as the server default */
  defaultProfile?: ProfileType
  onDefaultProfileChange?: (type: ProfileType) => void
  /** Keep My Account labels / presentation in sync when profiles load or save */
  onProfilesChange?: (previews: Record<ProfileType, ProfilePreview>, active?: ProfileType) => void
}

function emptyProfile(type: ProfileType, user: ProfilesSettingsTabProps['user']): ProfileRow {
  return {
    id: `${user.id}-${type}`,
    profile_type: type,
    display_name: type === 'personal' ? (user.display_name || user.username || '') : '',
    bio: '',
    avatar_url: type === 'personal' ? user.avatar_url || null : null,
    banner_url: type === 'personal' ? user.banner_url || null : null,
    discoverable: type === 'personal',
  }
}

function toPreviews(profiles: Record<ProfileType, ProfileRow>): Record<ProfileType, ProfilePreview> {
  return {
    personal: {
      display_name: profiles.personal.display_name || '',
      avatar_url: profiles.personal.avatar_url,
      banner_url: profiles.personal.banner_url,
    },
    work: {
      display_name: profiles.work.display_name || '',
      avatar_url: profiles.work.avatar_url,
      banner_url: profiles.work.banner_url,
    },
  }
}

export function ProfilesSettingsTab({
  user,
  onUserUpdate,
  defaultProfile,
  onDefaultProfileChange,
  onProfilesChange,
}: ProfilesSettingsTabProps) {
  const isGuest = user.is_guest ?? true
  const [editing, setEditing] = useState<ProfileType>('personal')
  const [activeServerProfile, setActiveServerProfile] = useState<ProfileType>(defaultProfile || 'personal')
  const [profiles, setProfiles] = useState<Record<ProfileType, ProfileRow>>({
    personal: emptyProfile('personal', user),
    work: emptyProfile('work', user),
  })
  const [friends, setFriends] = useState<FriendListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const onProfilesChangeRef = useRef(onProfilesChange)
  onProfilesChangeRef.current = onProfilesChange

  const current = profiles[editing]
  const hasBothProfiles = Boolean(
    profiles.personal.display_name?.trim() && profiles.work.display_name?.trim()
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rows, friendRows, account] = await Promise.all([
        api.getUserProfiles(user.id).catch(() => []),
        api.getFriendsList(user.id).catch(() => []),
        api.getAccount(user.id).catch(() => null),
      ])
      const next = {
        personal: emptyProfile('personal', user),
        work: emptyProfile('work', user),
      }
      for (const row of rows as ProfileRow[]) {
        if (row.profile_type === 'personal' || row.profile_type === 'work') {
          next[row.profile_type] = {
            id: row.id,
            profile_type: row.profile_type,
            display_name: row.display_name || '',
            bio: row.bio || '',
            avatar_url: row.avatar_url,
            banner_url: row.banner_url,
            discoverable: row.discoverable !== false,
          }
        }
      }
      // Seed empty Personal with signup username (temporary until onboarding)
      if (!next.personal.display_name.trim()) {
        next.personal.display_name = user.username
      }
      setProfiles(next)
      setFriends(friendRows)
      const workReady = Boolean(next.work.display_name.trim())
      let active: ProfileType =
        account?.active_profile === 'work' ? 'work' : 'personal'
      if (active === 'work' && !workReady) active = 'personal'
      setActiveServerProfile(active)
      onProfilesChangeRef.current?.(toPreviews(next), active)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load profiles')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!isGuest) load()
    else setLoading(false)
  }, [isGuest, load])

  useEffect(() => {
    if (defaultProfile) setActiveServerProfile(defaultProfile)
  }, [defaultProfile])

  const patchCurrent = (patch: Partial<ProfileRow>) => {
    setProfiles((prev) => ({
      ...prev,
      [editing]: { ...prev[editing], ...patch },
    }))
    setMessage(null)
  }

  const handleUpload = async (file: File, kind: 'avatar' | 'banner') => {
    setSaving(true)
    setError(null)
    try {
      const { url } = await api.uploadFile(file)
      if (kind === 'avatar') patchCurrent({ avatar_url: url })
      else patchCurrent({ banner_url: url })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!current.display_name.trim()) {
      setError('Each profile needs a display name — this is what others see.')
      return
    }
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const saved = await api.saveUserProfile(user.id, editing, {
        display_name: current.display_name.trim(),
        avatar_url: current.avatar_url || undefined,
        banner_url: current.banner_url || undefined,
        bio: current.bio || '',
        discoverable: !!current.discoverable,
      })
      const updatedRow: ProfileRow = {
        id: saved.id,
        profile_type: editing,
        display_name: saved.display_name,
        bio: saved.bio || '',
        avatar_url: saved.avatar_url,
        banner_url: saved.banner_url,
        discoverable: saved.discoverable !== false,
      }
      const nextProfiles = { ...profiles, [editing]: updatedRow }
      setProfiles(nextProfiles)
      onProfilesChange?.(toPreviews(nextProfiles), activeServerProfile)
      if (editing === activeServerProfile) {
        onUserUpdate?.({
          display_name: saved.display_name,
          avatar_url: saved.avatar_url || undefined,
          banner_url: saved.banner_url || undefined,
        })
      }
      setMessage(`${editing === 'personal' ? 'Personal' : 'Work'} profile saved`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const handleSetActiveServerProfile = async (type: ProfileType) => {
    if (type === 'work' && !profiles.work.display_name.trim()) {
      setError('Save a Work display name before switching to Work.')
      return
    }
    setActiveServerProfile(type)
    onDefaultProfileChange?.(type)
    const p = profiles[type]
    if (p.display_name.trim()) {
      onUserUpdate?.({
        display_name: p.display_name,
        avatar_url: p.avatar_url || undefined,
        banner_url: p.banner_url || undefined,
      })
    }
    onProfilesChange?.(toPreviews(profiles), type)
    setSaving(true)
    setError(null)
    try {
      const updated = await api.setActiveProfile(user.id, type)
      if (updated?.display_name != null) {
        onUserUpdate?.({
          display_name: updated.display_name,
          avatar_url: updated.avatar_url || undefined,
          banner_url: updated.banner_url || undefined,
        })
      }
      setMessage(`New servers will use your ${type === 'personal' ? 'Personal' : 'Work'} profile`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set default profile')
    } finally {
      setSaving(false)
    }
  }

  const handleVisibilityChange = async (friendId: string, visibleProfiles: VisibleProfiles) => {
    setFriends((prev) =>
      prev.map((f) => (f.id === friendId ? { ...f, visible_profiles: visibleProfiles } : f))
    )
    try {
      await api.updateFriendVisibility(user.id, friendId, { visibleProfiles })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update visibility')
      load()
    }
  }

  const handleFriendshipProfileChange = async (friendId: string, friendshipProfile: ProfileType) => {
    setFriends((prev) =>
      prev.map((f) => (f.id === friendId ? { ...f, friendship_profile: friendshipProfile } : f))
    )
    try {
      await api.updateFriendVisibility(user.id, friendId, { friendshipProfile })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update friend profile')
      load()
    }
  }

  if (isGuest) {
    return (
      <div>
        <h3 className="text-xl font-bold text-white mb-4">Profiles</h3>
        <p className="text-app-muted">
          Create an account to use Personal and Work profiles. Guests have a single public identity.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div>
        <h3 className="text-xl font-bold text-white mb-4">Profiles</h3>
        <p className="text-app-muted text-sm">Loading…</p>
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-xl font-bold text-white mb-1">Profiles</h3>
      <p className="text-app-muted text-sm mb-4">
        Personal and Work are separate public identities — display name, bio, photo, and banner.
        Your login username is private and never shown to others.
      </p>

      <div className="flex gap-2 mb-4">
        {(['personal', 'work'] as ProfileType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setEditing(type)}
            className={`px-4 py-2 rounded text-sm font-medium ${
              editing === type ? 'bg-app-accent text-white' : 'bg-app-hover/40 text-app-muted hover:text-app-text'
            }`}
          >
            {type === 'personal' ? 'Personal' : 'Work'}
          </button>
        ))}
      </div>

      <div className="bg-[#111214] rounded-lg overflow-hidden mb-4">
        <div className="relative h-24">
          {current.banner_url ? (
            <img src={current.banner_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full ${editing === 'work' ? 'bg-[#5865f2]' : 'bg-app-accent'}`} />
          )}
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleUpload(file, 'banner')
              e.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => bannerInputRef.current?.click()}
            disabled={saving}
            className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity text-white text-sm font-medium"
          >
            Change Banner
          </button>
        </div>
        <div className="px-4 pb-4">
          <div className="flex items-end gap-4 -mt-10 mb-4">
            <div className="relative">
              {current.avatar_url ? (
                <img
                  src={current.avatar_url}
                  alt=""
                  className="w-20 h-20 rounded-full object-cover border-4 border-[#111214]"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-app-accent flex items-center justify-center text-white font-bold text-2xl border-4 border-[#111214]">
                  {(current.display_name || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleUpload(file, 'avatar')
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={saving}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 hover:opacity-100 transition-opacity text-white text-xs"
              >
                Change
              </button>
            </div>
          </div>

          <label className="text-xs font-bold text-app-muted uppercase">Display name</label>
          <p className="text-xs text-app-muted mt-0.5 mb-1">Public name for this identity — not your login.</p>
          <input
            type="text"
            value={current.display_name}
            onChange={(e) => patchCurrent({ display_name: e.target.value })}
            placeholder={editing === 'personal' ? 'Personal name' : 'Work name'}
            className="w-full mt-1 mb-3 px-3 py-2 bg-[#2b2d31] rounded text-app-text border border-transparent focus:border-app-accent focus:outline-none"
          />

          <label className="text-xs font-bold text-app-muted uppercase">Bio</label>
          <textarea
            value={current.bio || ''}
            onChange={(e) => patchCurrent({ bio: e.target.value.slice(0, 190) })}
            rows={2}
            maxLength={190}
            placeholder="Short public bio"
            className="w-full mt-1 mb-3 px-3 py-2 bg-[#2b2d31] rounded text-app-text border border-transparent focus:border-app-accent focus:outline-none resize-none"
          />

          <div className="flex items-start justify-between gap-4 mb-4 py-2">
            <div>
              <div className="text-sm font-medium text-white">Discoverable in search</div>
              <p className="text-xs text-app-muted mt-0.5">
                When on, others can find this identity by display name when adding friends.
                Work is off by default.
              </p>
            </div>
            <SettingsToggle
              checked={!!current.discoverable}
              onChange={(v) => patchCurrent({ discoverable: v })}
              aria-label="Discoverable in search"
            />
          </div>

          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={saving}
            className="px-4 py-2 bg-app-accent hover:bg-app-accent-hover rounded text-sm text-white font-medium disabled:opacity-50"
          >
            {saving ? 'Saving…' : `Save ${editing === 'personal' ? 'Personal' : 'Work'} Profile`}
          </button>
        </div>
      </div>

      <div className="bg-[#2b2d31] rounded-lg p-4 mb-4">
        <h4 className="font-semibold text-white mb-1">Default for new servers</h4>
        <p className="text-xs text-app-muted mb-3">
          First time you join a server, this identity is used. You can change the preset per server later.
        </p>
        <div className="flex gap-2">
          {(['personal', 'work'] as ProfileType[]).map((type) => {
            const locked = type === 'work' && !profiles.work.display_name.trim()
            const label = profiles[type].display_name.trim()
              || (type === 'personal' ? user.username : '')
            return (
              <button
                key={type}
                type="button"
                onClick={() => handleSetActiveServerProfile(type)}
                disabled={saving || locked}
                title={locked ? 'Save a Work display name to unlock' : undefined}
                className={`px-3 py-1.5 rounded text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed ${
                  activeServerProfile === type
                    ? 'bg-app-accent text-white'
                    : 'bg-[#1e1f22] text-app-muted hover:text-app-text'
                }`}
              >
                {type === 'personal' ? 'Personal' : 'Work'}
                {locked ? ' · locked' : label ? ` · ${label}` : ''}
              </button>
            )
          })}
        </div>
      </div>

      <div className="bg-[#2b2d31] rounded-lg p-4">
        <h4 className="font-semibold text-white mb-1">Friend profile visibility</h4>
        <p className="text-xs text-app-muted mb-3">
          {hasBothProfiles
            ? 'Choose which friends see Personal, Work, or both. Also pick which list each friend belongs to.'
            : 'Save both Personal and Work display names to unlock per-friend visibility controls.'}
        </p>

        {friends.length === 0 ? (
          <p className="text-sm text-app-muted">No friends yet. Search a display name on the Friends page.</p>
        ) : (
          <ul className="space-y-2">
            {friends.map((friend) => (
              <li
                key={friend.id}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-2 border-b border-app-hover/30 last:border-0"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {friend.avatar_url ? (
                    <img src={friend.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-app-accent flex items-center justify-center text-white text-xs font-bold">
                      {(friend.display_name || friend.username).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm text-white truncate">{friend.display_name || friend.username}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-[10px] uppercase text-app-muted">Under</label>
                  <SettingsDropdown
                    value={friend.friendship_profile || 'personal'}
                    onChange={(v) => handleFriendshipProfileChange(friend.id, v as ProfileType)}
                    aria-label={`Friendship list for ${friend.display_name || friend.username}`}
                    options={[
                      { value: 'personal', label: 'Personal' },
                      { value: 'work', label: 'Work' },
                    ]}
                  />
                  <label className="text-[10px] uppercase text-app-muted">Can see</label>
                  <SettingsDropdown
                    value={hasBothProfiles ? (friend.visible_profiles || 'personal') : 'personal'}
                    onChange={(v) => handleVisibilityChange(friend.id, v as VisibleProfiles)}
                    disabled={!hasBothProfiles}
                    aria-label={`Visible profiles for ${friend.display_name || friend.username}`}
                    options={[
                      { value: 'personal', label: 'Personal only' },
                      { value: 'work', label: 'Work only' },
                      { value: 'both', label: 'Both profiles' },
                    ]}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      {message && <p className="text-green-400 text-sm mt-3">{message}</p>}
    </div>
  )
}
