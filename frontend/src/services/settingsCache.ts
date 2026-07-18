import type { ProfileType } from './api'

export type CachedProfilePreview = {
  display_name: string
  avatar_url?: string | null
  banner_url?: string | null
}

export type SettingsProfilesCache = {
  activeProfile: ProfileType
  personal: CachedProfilePreview
  work: CachedProfilePreview
  updatedAt: number
}

function key(userId: string) {
  return `nepsis_settings_profiles_${userId}`
}

export function loadSettingsProfilesCache(userId: string): SettingsProfilesCache | null {
  try {
    const raw = localStorage.getItem(key(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as SettingsProfilesCache
    if (!parsed?.personal || !parsed?.work) return null
    return parsed
  } catch {
    return null
  }
}

export function saveSettingsProfilesCache(
  userId: string,
  data: {
    activeProfile: ProfileType
    personal: CachedProfilePreview
    work: CachedProfilePreview
  }
): void {
  try {
    const payload: SettingsProfilesCache = {
      ...data,
      updatedAt: Date.now(),
    }
    localStorage.setItem(key(userId), JSON.stringify(payload))
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearSettingsProfilesCache(userId?: string): void {
  try {
    if (userId) {
      localStorage.removeItem(key(userId))
      return
    }
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith('nepsis_settings_profiles_')) toRemove.push(k)
    }
    toRemove.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* ignore */
  }
}
