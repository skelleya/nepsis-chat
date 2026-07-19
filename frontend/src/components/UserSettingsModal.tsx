import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import gsap from 'gsap'
import * as api from '../services/api'
import type { ProfileType } from '../services/api'
import {
  loadSettingsProfilesCache,
  saveSettingsProfilesCache,
} from '../services/settingsCache'
import { useApp } from '../contexts/AppContext'
import { PrivacySettingsTab } from './settings/PrivacySettingsTab'
import { ProfilesSettingsTab } from './settings/ProfilesSettingsTab'
import { AppearanceSettingsTab } from './settings/AppearanceSettingsTab'
import { VoiceVideoSettingsTab } from './settings/VoiceVideoSettingsTab'
import { NotificationsSettingsTab } from './settings/NotificationsSettingsTab'

type ProfilePreview = {
  display_name: string
  avatar_url?: string | null
  banner_url?: string | null
}

type TabId = 'account' | 'profiles' | 'privacy' | 'appearance' | 'voice' | 'notifications' | 'help'

const TAB_ORDER: Record<TabId, number> = {
  account: 0,
  profiles: 1,
  privacy: 2,
  appearance: 3,
  voice: 4,
  notifications: 5,
  help: 6,
}

function HelpTab({ user }: { user: { id: string; username: string; is_guest?: boolean } }) {
  const isGuest = user.is_guest ?? true
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isGuest) {
      setMessage({ type: 'error', text: 'Guest accounts cannot submit bug reports. Sign in or create an account first.' })
      return
    }
    const trimTitle = title.trim()
    const trimDesc = description.trim()
    if (!trimTitle || !trimDesc) {
      setMessage({ type: 'error', text: 'Please fill in both title and description.' })
      return
    }
    setSubmitting(true)
    setMessage(null)
    try {
      await api.submitBugReport({
        userId: user.id,
        username: user.username,
        title: trimTitle,
        description: trimDesc,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
      })
      setMessage({ type: 'success', text: 'Thank you! Your bug report has been sent to the developers.' })
      setTitle('')
      setDescription('')
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to submit report' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h3 className="text-xl font-bold text-app-text mb-4">Help & Support</h3>
      <div className="bg-app-channel rounded-lg p-4 space-y-4">
        <h4 className="font-semibold text-app-text">Report a Bug</h4>
        {isGuest ? (
          <p className="text-app-muted text-sm">
            Guest accounts can’t submit bug reports. Sign in or create an account to send feedback to the developers.
          </p>
        ) : (
          <>
            <p className="text-app-muted text-sm">
              Found a bug? Let us know! Your report will be sent to the development team. Include as much detail as you can.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-app-muted uppercase mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Brief summary of the issue"
                  maxLength={256}
                  className="w-full px-3 py-2 bg-app-darker rounded text-app-text border border-transparent focus:border-app-accent focus:outline-none placeholder:text-app-muted"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-app-muted uppercase mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Steps to reproduce, what you expected, what happened..."
                  rows={4}
                  maxLength={8000}
                  className="w-full px-3 py-2 bg-app-darker rounded text-app-text border border-transparent focus:border-app-accent focus:outline-none placeholder:text-app-muted resize-none"
                />
              </div>
              <p className="text-app-muted text-xs">
                Your username and current page URL will be included to help us investigate.
              </p>
              {message && (
                <p className={`text-sm ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                  {message.text}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-app-accent hover:bg-app-accent-hover rounded text-sm text-white font-medium disabled:opacity-50"
              >
                {submitting ? 'Sending...' : 'Send Report'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

interface UserSettingsModalProps {
  user: { id: string; username: string; display_name?: string | null; avatar_url?: string; banner_url?: string; is_guest?: boolean }
  onClose: () => void
  onLogout: () => void
  onUserUpdate?: (data: { username?: string; display_name?: string | null; avatar_url?: string; banner_url?: string }) => void
}

export function UserSettingsModal({ user, onClose, onLogout, onUserUpdate }: UserSettingsModalProps) {
  const { deleteAccount } = useApp()
  const isGuest = user.is_guest ?? true
  const cachedProfiles = !isGuest ? loadSettingsProfilesCache(user.id) : null

  const [activeTab, setActiveTab] = useState<TabId>('account')
  const [displayedTab, setDisplayedTab] = useState<TabId>('account')
  const [switching, setSwitching] = useState(false)
  const [username, setUsername] = useState(user.username)
  const [displayName, setDisplayName] = useState(user.display_name ?? '')
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url || '')
  const [bannerUrl, setBannerUrl] = useState(user.banner_url || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [profilesReady, setProfilesReady] = useState(() => Boolean(cachedProfiles))
  const [defaultProfile, setDefaultProfile] = useState<ProfileType>(() => {
    if (!cachedProfiles) return 'personal'
    const workOk = Boolean(cachedProfiles.work.display_name?.trim())
    if (cachedProfiles.activeProfile === 'work' && workOk) return 'work'
    return 'personal'
  })
  const [profilePreviews, setProfilePreviews] = useState<Record<ProfileType, ProfilePreview>>(() => {
    if (cachedProfiles) {
      return {
        personal: {
          display_name: cachedProfiles.personal.display_name || user.username,
          avatar_url: cachedProfiles.personal.avatar_url,
          banner_url: cachedProfiles.personal.banner_url,
        },
        work: { ...cachedProfiles.work },
      }
    }
    return {
      personal: { display_name: user.username, avatar_url: user.avatar_url || null, banner_url: user.banner_url || null },
      work: { display_name: '' },
    }
  })
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const seededPersonalRef = useRef(Boolean(cachedProfiles?.personal.display_name?.trim()))

  const personalLabel = profilePreviews.personal.display_name.trim() || user.username
  const workLabel = profilePreviews.work.display_name.trim()
  const workReady = Boolean(workLabel)
  /** Avoid flashing "locked" before cache/network resolves */
  const workLocked = profilesReady && !workReady
  const profileLabels = { personal: personalLabel, work: workLabel }

  const persistProfilesCache = useCallback((
    next: Record<ProfileType, ProfilePreview>,
    active: ProfileType,
  ) => {
    saveSettingsProfilesCache(user.id, {
      activeProfile: active,
      personal: next.personal,
      work: next.work,
    })
  }, [user.id])
  const overlayRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const contentTweenRef = useRef<gsap.core.Tween | null>(null)
  const navRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLDivElement>(null)
  const tabBtnRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({})
  const closingRef = useRef(false)
  const navIndicatorReadyRef = useRef(false)
  const slideDirectionRef = useRef(1)
  const pendingEnterRef = useRef(false)
  const targetTabRef = useRef<TabId>('account')

  useLayoutEffect(() => {
    const overlay = overlayRef.current
    const panel = panelRef.current
    if (!overlay || !panel) return

    gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'sine.out' })
    gsap.fromTo(
      panel,
      { opacity: 0, y: 18, scale: 0.98 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.4,
        ease: 'power3.out',
        force3D: false,
        clearProps: 'transform',
      }
    )
  }, [])

  const moveNavIndicator = useCallback((animate: boolean) => {
    const track = navRef.current
    const indicator = indicatorRef.current
    const btn = tabBtnRefs.current[activeTab]
    if (!track || !indicator || !btn) return

    const y = btn.offsetTop
    const height = btn.offsetHeight

    gsap.killTweensOf(indicator)
    if (!animate || !navIndicatorReadyRef.current) {
      gsap.set(indicator, { y, height, opacity: 1 })
      navIndicatorReadyRef.current = true
      return
    }

    gsap.to(indicator, {
      y,
      height,
      duration: 0.4,
      ease: 'power3.inOut',
      force3D: false,
    })
  }, [activeTab])

  useLayoutEffect(() => {
    moveNavIndicator(true)
  }, [moveNavIndicator])

  useLayoutEffect(() => {
    const onResize = () => moveNavIndicator(false)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [moveNavIndicator])

  useLayoutEffect(() => {
    const content = contentRef.current
    if (!content || !pendingEnterRef.current) return
    pendingEnterRef.current = false

    const direction = slideDirectionRef.current
    contentTweenRef.current?.kill()
    contentTweenRef.current = gsap.fromTo(
      content,
      { x: 56 * direction, opacity: 0 },
      {
        x: 0,
        opacity: 1,
        duration: 0.4,
        ease: 'power3.out',
        overwrite: true,
        onComplete: () => setSwitching(false),
      }
    )
  }, [displayedTab])

  const switchTab = (next: TabId) => {
    if (next === activeTab || switching) return
    const direction = TAB_ORDER[next] > TAB_ORDER[activeTab] ? 1 : -1
    slideDirectionRef.current = direction
    targetTabRef.current = next
    setActiveTab(next)

    const content = contentRef.current
    if (!content || next === displayedTab) {
      setDisplayedTab(next)
      setSwitching(false)
      return
    }

    setSwitching(true)
    contentTweenRef.current?.kill()
    contentTweenRef.current = gsap.to(content, {
      x: -56 * direction,
      opacity: 0,
      duration: 0.28,
      ease: 'power3.in',
      overwrite: true,
      onComplete: () => {
        pendingEnterRef.current = true
        setDisplayedTab(targetTabRef.current)
      },
    })
  }

  const requestClose = () => {
    if (closingRef.current) return
    closingRef.current = true
    const overlay = overlayRef.current
    const panel = panelRef.current
    const content = contentRef.current
    if (!overlay || !panel) {
      onClose()
      return
    }
    gsap.killTweensOf([overlay, panel, content].filter(Boolean))
    gsap.to(overlay, { opacity: 0, duration: 0.2, ease: 'sine.in' })
    gsap.to(panel, {
      opacity: 0,
      y: 12,
      scale: 0.98,
      duration: 0.22,
      ease: 'power2.in',
      onComplete: onClose,
    })
  }

  useEffect(() => {
    setUsername(user.username)
    setDisplayName(user.display_name ?? '')
    setAvatarUrl(user.avatar_url || '')
    setBannerUrl(user.banner_url || '')
  }, [user])

  const pushPresentation = useCallback((
    type: ProfileType,
    preview: { display_name: string; avatar_url?: string | null; banner_url?: string | null },
  ) => {
    const name = (preview.display_name || '').trim() || (type === 'personal' ? user.username : '')
    if (!name && type === 'work') return
    setDisplayName(name)
    setAvatarUrl(preview.avatar_url || '')
    setBannerUrl(preview.banner_url || '')
    onUserUpdate?.({
      display_name: name,
      avatar_url: preview.avatar_url || undefined,
      banner_url: preview.banner_url || undefined,
    })
  }, [onUserUpdate, user.username])

  const handleProfilesSynced = useCallback((next: Record<ProfileType, ProfilePreview>, active?: ProfileType) => {
    setProfilePreviews(next)
    setProfilesReady(true)
    setDefaultProfile((prev) => {
      const activeType = active || prev
      const workHasName = Boolean(next.work.display_name?.trim())
      const resolved: ProfileType = activeType === 'work' && !workHasName ? 'personal' : activeType
      pushPresentation(resolved, next[resolved])
      persistProfilesCache(next, resolved)
      return resolved
    })
  }, [pushPresentation, persistProfilesCache])

  useEffect(() => {
    if (isGuest) {
      setProfilesReady(true)
      return
    }
    let cancelled = false
    ;(async () => {
      const [account, profiles] = await Promise.all([
        api.getAccount(user.id).catch(() => null),
        api.getUserProfiles(user.id).catch(() => []),
      ])
      if (cancelled) return

      const next: Record<ProfileType, ProfilePreview> = {
        personal: { display_name: '', avatar_url: null, banner_url: null },
        work: { display_name: '', avatar_url: null, banner_url: null },
      }
      for (const p of profiles as {
        profile_type: string
        display_name?: string
        avatar_url?: string | null
        banner_url?: string | null
      }[]) {
        if (p.profile_type === 'personal' || p.profile_type === 'work') {
          next[p.profile_type] = {
            display_name: p.display_name || '',
            avatar_url: p.avatar_url ?? null,
            banner_url: p.banner_url ?? null,
          }
        }
      }

      // Until onboarding exists: auto Personal = signup username when unset
      if (!next.personal.display_name.trim() && !seededPersonalRef.current) {
        seededPersonalRef.current = true
        try {
          const saved = await api.saveUserProfile(user.id, 'personal', {
            display_name: user.username,
            avatar_url: user.avatar_url,
            banner_url: user.banner_url,
            discoverable: true,
          })
          if (cancelled) return
          next.personal = {
            display_name: saved.display_name || user.username,
            avatar_url: saved.avatar_url ?? null,
            banner_url: saved.banner_url ?? null,
          }
          await api.setActiveProfile(user.id, 'personal').catch(() => null)
        } catch {
          next.personal.display_name = user.username
        }
      } else if (!next.personal.display_name.trim()) {
        next.personal.display_name = user.username
      }

      if (cancelled) return
      setProfilePreviews(next)

      const workHasName = Boolean(next.work.display_name.trim())
      let active: ProfileType =
        account?.active_profile === 'work' || account?.active_profile === 'personal'
          ? account.active_profile
          : 'personal'
      if (active === 'work' && !workHasName) active = 'personal'
      setDefaultProfile(active)
      setProfilesReady(true)
      persistProfilesCache(next, active)
      // Only push presentation if cache was missing / differs — avoid flicker when cache already shown
      const cached = loadSettingsProfilesCache(user.id)
      const sameActive = cached?.activeProfile === active
      const samePersonal = (cached?.personal.display_name || '') === (next.personal.display_name || '')
      const sameWork = (cached?.work.display_name || '') === (next.work.display_name || '')
      if (!cached || !sameActive || !samePersonal || !sameWork) {
        pushPresentation(active, next[active])
      }
    })()
    return () => { cancelled = true }
    // Only re-run when account identity changes — not on every presentation push
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, user.username, isGuest])

  const handleSetDefaultProfile = async (type: ProfileType) => {
    if (type === 'work' && workLocked) {
      setError('Set up a Work profile under Profiles first.')
      return
    }
    setDefaultProfile(type)
    pushPresentation(type, profilePreviews[type])
    persistProfilesCache(profilePreviews, type)
    setSaving(true)
    setError('')
    try {
      const updated = await api.setActiveProfile(user.id, type)
      if (updated?.display_name != null) {
        setDisplayName(updated.display_name)
        setAvatarUrl(updated.avatar_url || '')
        setBannerUrl(updated.banner_url || '')
        onUserUpdate?.({
          display_name: updated.display_name,
          avatar_url: updated.avatar_url || undefined,
          banner_url: updated.banner_url || undefined,
        })
        persistProfilesCache(
          {
            ...profilePreviews,
            [type]: {
              display_name: updated.display_name || profilePreviews[type].display_name,
              avatar_url: updated.avatar_url ?? profilePreviews[type].avatar_url,
              banner_url: updated.banner_url ?? profilePreviews[type].banner_url,
            },
          },
          type,
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set default profile')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Use an image file for your profile picture')
      e.target.value = ''
      return
    }
    setSaving(true)
    setError('')
    try {
      const { url } = await api.uploadFile(file)
      await api.updateUserProfile(user.id, { avatar_url: url })
      setAvatarUrl(url)
      onUserUpdate?.({ avatar_url: url })
      // Keep My Account preview + Profiles cache aligned with active default
      if (!isGuest) {
        const next = {
          ...profilePreviews,
          [defaultProfile]: { ...profilePreviews[defaultProfile], avatar_url: url },
        }
        setProfilePreviews(next)
        persistProfilesCache(next, defaultProfile)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setSaving(false)
      e.target.value = ''
    }
  }

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Use an image file for your banner')
      e.target.value = ''
      return
    }
    setSaving(true)
    setError('')
    try {
      const { url } = await api.uploadFile(file)
      await api.updateUserProfile(user.id, { banner_url: url })
      setBannerUrl(url)
      onUserUpdate?.({ banner_url: url })
      if (!isGuest) {
        const next = {
          ...profilePreviews,
          [defaultProfile]: { ...profilePreviews[defaultProfile], banner_url: url },
        }
        setProfilePreviews(next)
        persistProfilesCache(next, defaultProfile)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setSaving(false)
      e.target.value = ''
    }
  }

  const handleSaveUsername = async () => {
    const trimmed = username.trim()
    if (!trimmed || trimmed === user.username) return
    setSaving(true)
    setError('')
    try {
      await api.updateUserProfile(user.id, { username: trimmed })
      onUserUpdate?.({ username: trimmed })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update username')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveDisplayName = async () => {
    const trimmed = displayName.trim()
    const currentVal = user.display_name ?? ''
    if (trimmed === currentVal) return
    setSaving(true)
    setError('')
    try {
      await api.updateUserProfile(user.id, { display_name: trimmed || null })
      onUserUpdate?.({ display_name: trimmed ? trimmed : null })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update display name')
    } finally {
      setSaving(false)
    }
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'account', label: 'My Account' },
    { id: 'profiles', label: 'Profiles' },
    { id: 'privacy', label: 'Privacy & Safety' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'voice', label: 'Voice & Video' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'help', label: 'Help & Support' },
  ]

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && requestClose()}
      role="dialog"
      aria-modal="true"
      aria-label="User Settings"
    >
      <div
        ref={panelRef}
        className="relative bg-app-dark rounded-lg shadow-2xl w-full max-w-[740px] h-[min(640px,90vh)] flex overflow-hidden"
      >
        {/* Left sidebar */}
        <div className="w-[218px] bg-app-channel flex-shrink-0 flex flex-col min-h-0">
          <div className="px-4 pt-4 pb-3 flex-shrink-0">
            <h2 className="text-xs font-bold uppercase tracking-wide text-app-muted">
              User Settings
            </h2>
          </div>
          <div ref={navRef} className="relative flex-1 min-h-0 overflow-y-auto px-2 pb-2 settings-scroll">
            <div
              ref={indicatorRef}
              className="absolute left-2 right-2 rounded-md bg-app-accent/30 pointer-events-none opacity-0 will-change-transform"
              aria-hidden
            />
            <div className="flex flex-col gap-0.5">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  ref={(el) => { tabBtnRefs.current[tab.id] = el }}
                  onClick={() => switchTab(tab.id)}
                  className={`relative z-10 w-full px-2.5 py-1.5 rounded-md text-[15px] font-medium leading-6 text-left transition-colors ${
                    activeTab === tab.id
                      ? 'text-app-text'
                      : 'text-app-muted hover:text-app-text'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-shrink-0 px-2 pb-3 pt-2 mt-auto border-t border-[#3f4147]">
            <button
              type="button"
              onClick={onLogout}
              className="w-full px-2.5 py-1.5 rounded-md text-[15px] font-medium leading-6 text-red-400 hover:text-red-300 hover:bg-white/5 text-left flex items-center justify-between gap-2"
            >
              <span>Log Out</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="shrink-0 opacity-90">
                <path d="M17 7L15.59 8.41L18.17 11H8V13H18.17L15.59 15.58L17 17L22 12L17 7ZM4 5H12V3H4C2.9 3 2 3.9 2 5V19C2 20.1 2.9 21 4 21H12V19H4V5Z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Main content — directional horizontal slide between pages; thin scrollbar under close */}
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden relative">
          <div className="h-full overflow-x-hidden overflow-y-auto p-6 pr-5 settings-scroll">
          <div
            ref={contentRef}
            className="will-change-transform"
          >
              {displayedTab === 'account' && (
              <div>
                <h3 className="text-xl font-bold text-app-text mb-4">My Account</h3>
                <div className="bg-app-panel rounded-lg overflow-hidden">
                  <div className="relative h-24">
                    {bannerUrl ? (
                      <img key={bannerUrl} src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-app-accent" />
                    )}
                    <input
                      ref={bannerInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleBannerUpload}
                    />
                    <button
                      onClick={() => bannerInputRef.current?.click()}
                      disabled={saving}
                      className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity text-white text-sm font-medium"
                    >
                      Change Banner
                    </button>
                  </div>
                  <div className="px-4 pb-4">
                    <div className="flex items-end gap-4 -mt-10">
                      <div className="relative">
                        {avatarUrl ? (
                          <img key={avatarUrl} src={avatarUrl} alt={(user.display_name || user.username)} className="w-20 h-20 rounded-full object-cover border-4 border-[#111214]" />
                        ) : (
                          <div className="w-20 h-20 rounded-full bg-app-accent flex items-center justify-center text-white font-bold text-2xl border-4 border-app-darker">
                            {(user.display_name || user.username).charAt(0).toUpperCase()}
                          </div>
                        )}
                        <input
                          ref={avatarInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarUpload}
                        />
                        <button
                          onClick={() => avatarInputRef.current?.click()}
                          disabled={saving}
                          className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 hover:opacity-100 transition-opacity text-white text-xs"
                        >
                          Change
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 space-y-4">
                      {isGuest ? (
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <label className="text-xs font-bold text-app-muted uppercase">Display name</label>
                            <p className="text-xs text-app-muted mt-0.5 mb-1">How others see you as a guest.</p>
                            <input
                              type="text"
                              value={displayName}
                              onChange={(e) => setDisplayName(e.target.value)}
                              placeholder={user.username}
                              className="w-full mt-1 px-3 py-2 bg-app-channel rounded text-app-text border border-transparent focus:border-app-accent focus:outline-none placeholder:text-app-muted/60"
                            />
                          </div>
                          <button
                            onClick={handleSaveDisplayName}
                            disabled={saving || (displayName.trim() || '') === (user.display_name ?? '')}
                            className="px-4 py-2 bg-app-accent hover:bg-app-accent-hover rounded text-sm text-white font-medium disabled:opacity-50 self-end"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <div>
                          <label className="text-xs font-bold text-app-muted uppercase">Default profile for new servers</label>
                          <p className="text-xs text-app-muted mt-0.5 mb-2">
                            Choose which public identity is used the first time you join a server.
                            Edit names, bios, and photos under Profiles. Login username stays private.
                          </p>
                          <div className="flex gap-2 flex-wrap">
                            {(['personal', 'work'] as ProfileType[]).map((type) => {
                              const locked = type === 'work' && workLocked
                              return (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => handleSetDefaultProfile(type)}
                                  disabled={saving || locked || !profilesReady}
                                  title={locked ? 'Save a Work profile under Profiles to unlock' : undefined}
                                  className={`px-3 py-2 rounded text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed ${
                                    defaultProfile === type
                                      ? 'bg-app-accent text-white'
                                      : 'bg-app-channel text-app-muted hover:text-app-text'
                                  }`}
                                >
                                  {type === 'personal' ? 'Personal' : 'Work'}
                                  {locked
                                    ? ' · locked'
                                    : profileLabels[type]
                                      ? ` · ${profileLabels[type]}`
                                      : profilesReady
                                        ? ' · set in Profiles'
                                        : ''}
                                </button>
                              )
                            })}
                          </div>
                          {workLocked && (
                            <p className="text-xs text-app-muted mt-2">
                              Work stays locked until you save a Work display name in Profiles. Personal uses your username until then.
                            </p>
                          )}
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <label className="text-xs font-bold text-app-muted uppercase">Login username</label>
                          <p className="text-xs text-app-muted mt-0.5 mb-1">
                            Private — used only to sign in. Others never see this.
                          </p>
                          <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            disabled={isGuest}
                            className="w-full mt-1 px-3 py-2 bg-app-channel rounded text-app-text border border-transparent focus:border-app-accent focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                          />
                        </div>
                        {!isGuest && (
                          <button
                            onClick={handleSaveUsername}
                            disabled={saving || username.trim() === user.username}
                            className="px-4 py-2 bg-app-accent hover:bg-app-accent-hover rounded text-sm text-white font-medium disabled:opacity-50 self-end"
                          >
                            Save
                          </button>
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-app-muted uppercase">User ID</div>
                        <div className="text-sm text-app-muted font-mono mt-0.5">{user.id}</div>
                      </div>
                    </div>
                    {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
                  </div>
                </div>

                <div className="mt-8">
                  <h4 className="text-xs font-bold text-red-400 uppercase tracking-wide mb-2">Danger Zone</h4>
                  <div className="rounded-lg border border-red-500/40 bg-app-panel p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-app-text">Delete Account</p>
                        <p className="text-xs text-app-muted mt-1">
                          Permanently delete your account, messages, DMs, and any servers you own.
                          This cannot be undone.
                          {isGuest ? ' Guests are also removed automatically on Log Out.' : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteConfirmText('')
                          setDeleteError('')
                          setShowDeleteConfirm(true)
                        }}
                        className="shrink-0 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm text-white font-medium"
                      >
                        Delete Account
                      </button>
                    </div>
                  </div>
                </div>

                {showDeleteConfirm && (
                  <div
                    className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]"
                    onClick={() => !deletingAccount && setShowDeleteConfirm(false)}
                  >
                    <div
                      className="bg-app-dark rounded-xl w-[min(440px,92vw)] shadow-2xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="p-4">
                        <h3 className="text-xl font-bold text-app-text">Delete Account</h3>
                        <p className="text-sm text-app-muted mt-2">
                          This will permanently remove <strong className="text-app-text">{user.username}</strong> and
                          all associated data, including servers you own. Type your username to confirm.
                        </p>
                        <label className="block text-xs font-bold text-app-muted uppercase mt-4 mb-1">
                          Username
                        </label>
                        <input
                          type="text"
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                          placeholder={user.username}
                          disabled={deletingAccount}
                          autoFocus
                          className="w-full px-3 py-2 bg-app-darker rounded text-app-text border border-transparent focus:border-red-500 focus:outline-none placeholder:text-app-muted/60 disabled:opacity-60"
                        />
                        {deleteError && <p className="text-red-400 text-sm mt-2">{deleteError}</p>}
                      </div>
                      <div className="bg-app-channel p-4 flex justify-end gap-3 rounded-b-xl">
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(false)}
                          disabled={deletingAccount}
                          className="px-4 py-2 text-sm text-app-text hover:underline disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={
                            deletingAccount ||
                            deleteConfirmText.trim().toLowerCase() !== user.username.trim().toLowerCase()
                          }
                          onClick={async () => {
                            setDeletingAccount(true)
                            setDeleteError('')
                            try {
                              await deleteAccount()
                              // Session cleared — modal unmounts with user
                            } catch (err) {
                              setDeleteError(err instanceof Error ? err.message : 'Failed to delete account')
                              setDeletingAccount(false)
                            }
                          }}
                          className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-[3px] text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deletingAccount ? 'Deleting…' : 'Delete Account'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              )}

              {displayedTab === 'profiles' && (
                <ProfilesSettingsTab
                  user={user}
                  onUserUpdate={(data) => {
                    if (data.display_name !== undefined) setDisplayName(data.display_name ?? '')
                    if (data.avatar_url !== undefined) setAvatarUrl(data.avatar_url || '')
                    if (data.banner_url !== undefined) setBannerUrl(data.banner_url || '')
                    onUserUpdate?.(data)
                  }}
                  defaultProfile={defaultProfile}
                  onDefaultProfileChange={setDefaultProfile}
                  onProfilesChange={handleProfilesSynced}
                />
              )}

              {displayedTab === 'privacy' && (
                <PrivacySettingsTab userId={user.id} />
              )}

              {displayedTab === 'appearance' && <AppearanceSettingsTab />}

              {displayedTab === 'voice' && <VoiceVideoSettingsTab />}

              {displayedTab === 'notifications' && <NotificationsSettingsTab />}

              {displayedTab === 'help' && (
                <HelpTab user={user} />
              )}
          </div>
          </div>
        </div>

        {/* Close — muted circular X to match server settings */}
        <button
          type="button"
          onClick={requestClose}
          aria-label="Close settings"
          className="absolute top-5 right-5 z-20 w-9 h-9 rounded-full border-2 border-app-muted/60 flex items-center justify-center text-app-muted hover:text-app-text hover:border-app-text transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
