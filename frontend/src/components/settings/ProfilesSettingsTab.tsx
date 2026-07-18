import { useCallback, useEffect, useRef, useState } from 'react'
import * as api from '../../services/api'
import type { FriendListItem, ProfileType, VisibleProfiles } from '../../services/api'

interface ProfileRow {
  id: string
  profile_type: ProfileType
  display_name: string
  avatar_url?: string | null
  banner_url?: string | null
}

interface ProfilesSettingsTabProps {
  user: { id: string; username: string; display_name?: string | null; avatar_url?: string; banner_url?: string; is_guest?: boolean }
  onUserUpdate?: (data: { username?: string; display_name?: string | null; avatar_url?: string; banner_url?: string }) => void
}

function emptyProfile(type: ProfileType, user: ProfilesSettingsTabProps['user']): ProfileRow {
  return {
    id: `${user.id}-${type}`,
    profile_type: type,
    display_name: type === 'personal' ? (user.display_name || user.username) : '',
    avatar_url: type === 'personal' ? user.avatar_url || null : null,
    banner_url: type === 'personal' ? user.banner_url || null : null,
  }
}

export function ProfilesSettingsTab({ user, onUserUpdate }: ProfilesSettingsTabProps) {
  const isGuest = user.is_guest ?? true
  const [editing, setEditing] = useState<ProfileType>('personal')
  const [activeServerProfile, setActiveServerProfile] = useState<ProfileType>('personal')
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

  const current = profiles[editing]
  const hasBothProfiles = Boolean(
    profiles.personal.display_name?.trim() && profiles.work.display_name?.trim()
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rows, friendRows, userRow] = await Promise.all([
        api.getUserProfiles(user.id).catch(() => []),
        api.getFriendsList(user.id).catch(() => []),
        // active_profile comes from users row via privacy-free patch response; fetch profiles list is enough for now
        Promise.resolve(null as null),
      ])
      void userRow
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
            avatar_url: row.avatar_url,
            banner_url: row.banner_url,
          }
        }
      }
      setProfiles(next)
      setFriends(friendRows)
      // Prefer stored active profile if present on either profile payload later
      try {
        const stored = localStorage.getItem(`nepsis_active_profile_${user.id}`)
        if (stored === 'personal' || stored === 'work') setActiveServerProfile(stored)
      } catch { /* ignore */ }
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
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const saved = await api.saveUserProfile(user.id, editing, {
        display_name: current.display_name.trim() || user.username,
        avatar_url: current.avatar_url || undefined,
        banner_url: current.banner_url || undefined,
      })
      setProfiles((prev) => ({
        ...prev,
        [editing]: {
          id: saved.id,
          profile_type: editing,
          display_name: saved.display_name,
          avatar_url: saved.avatar_url,
          banner_url: saved.banner_url,
        },
      }))
      // Keep main account in sync when editing Personal
      if (editing === 'personal') {
        await api.updateUserProfile(user.id, {
          display_name: saved.display_name,
          avatar_url: saved.avatar_url || undefined,
          banner_url: saved.banner_url || undefined,
        })
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
    setActiveServerProfile(type)
    setSaving(true)
    setError(null)
    try {
      await api.setActiveProfile(user.id, type)
      try {
        localStorage.setItem(`nepsis_active_profile_${user.id}`, type)
      } catch { /* ignore */ }
      setMessage(`Servers will show your ${type === 'personal' ? 'Personal' : 'Work'} profile`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set active profile')
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
        <p className="text-app-muted">Create an account to use Personal and Work profiles.</p>
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
        Manage how you appear. Use Personal for friends and Work for professional servers — then choose what each friend can see.
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
                  {(current.display_name || user.username).charAt(0).toUpperCase()}
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
          <input
            type="text"
            value={current.display_name}
            onChange={(e) => patchCurrent({ display_name: e.target.value })}
            placeholder={user.username}
            className="w-full mt-1 mb-3 px-3 py-2 bg-[#2b2d31] rounded text-app-text border border-transparent focus:border-app-accent focus:outline-none"
          />

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
        <h4 className="font-semibold text-white mb-1">Server presentation</h4>
        <p className="text-xs text-app-muted mb-3">
          When you join or appear in servers, use this profile’s name and avatar.
        </p>
        <div className="flex gap-2">
          {(['personal', 'work'] as ProfileType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => handleSetActiveServerProfile(type)}
              disabled={saving}
              className={`px-3 py-1.5 rounded text-sm font-medium ${
                activeServerProfile === type
                  ? 'bg-app-accent text-white'
                  : 'bg-[#1e1f22] text-app-muted hover:text-app-text'
              }`}
            >
              {type === 'personal' ? 'Personal' : 'Work'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#2b2d31] rounded-lg p-4">
        <h4 className="font-semibold text-white mb-1">Friend profile visibility</h4>
        <p className="text-xs text-app-muted mb-3">
          {hasBothProfiles
            ? 'Choose which friends see Personal, Work, or both of your profiles. Also pick which list each friend belongs to.'
            : 'Save both Personal and Work profiles to control per-friend visibility. Until then, friends see your Personal profile.'}
        </p>

        {friends.length === 0 ? (
          <p className="text-sm text-app-muted">No friends yet. Add someone from the Friends page.</p>
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
                      {friend.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm text-white truncate">{friend.username}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-[10px] uppercase text-app-muted">Under</label>
                  <select
                    value={friend.friendship_profile || 'personal'}
                    onChange={(e) => handleFriendshipProfileChange(friend.id, e.target.value as ProfileType)}
                    className="bg-[#1e1f22] text-app-text text-xs rounded px-2 py-1 border border-app-hover/40 focus:border-app-accent focus:outline-none"
                  >
                    <option value="personal">Personal</option>
                    <option value="work">Work</option>
                  </select>
                  <label className="text-[10px] uppercase text-app-muted">Can see</label>
                  <select
                    value={hasBothProfiles ? (friend.visible_profiles || 'personal') : 'personal'}
                    onChange={(e) => handleVisibilityChange(friend.id, e.target.value as VisibleProfiles)}
                    disabled={!hasBothProfiles}
                    className="bg-[#1e1f22] text-app-text text-xs rounded px-2 py-1 border border-app-hover/40 focus:border-app-accent focus:outline-none disabled:opacity-50"
                    title={hasBothProfiles ? undefined : 'Save both Personal and Work profiles first'}
                  >
                    <option value="personal">Personal only</option>
                    <option value="work">Work only</option>
                    <option value="both">Both profiles</option>
                  </select>
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
