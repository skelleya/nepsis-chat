import { useCallback, useEffect, useState } from 'react'

export type DesktopUpdateCheckResult = {
  status: 'idle' | 'checking' | 'up-to-date' | 'available' | 'error'
  message?: string
  version?: string | null
}

export function useDesktopUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateDownloaded, setUpdateDownloaded] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [installError, setInstallError] = useState<string | null>(null)
  const [version, setVersion] = useState<string | null>(null)
  const [availableVersion, setAvailableVersion] = useState<string | null>(null)
  const [downloadPercent, setDownloadPercent] = useState(0)
  const [checkStatus, setCheckStatus] = useState<DesktopUpdateCheckResult>({ status: 'idle' })

  useEffect(() => {
    const api = window.electronAPI
    if (!api?.isElectron) return

    api.getVersion().then(setVersion)

    const offAvailable = api.onUpdateAvailable((info) => {
      setUpdateAvailable(true)
      if (info?.version) setAvailableVersion(info.version)
      setCheckStatus({
        status: 'available',
        version: info?.version,
        message: info?.version
          ? `Update v${info.version} is available. Click the green arrow to install.`
          : 'An update is available. Click the green arrow to install.',
      })
    })

    const offNotAvailable = api.onUpdateNotAvailable?.((info) => {
      // After a successful install/restart the feed still returns a version —
      // clear the badge when we are already on latest.
      setUpdateAvailable(false)
      setAvailableVersion(null)
      setDownloading(false)
      setCheckStatus({
        status: 'up-to-date',
        version: info?.version,
        message: `You're on the latest version${info?.version ? ` (v${info.version})` : ''}.`,
      })
    })

    const offDownloaded = api.onUpdateDownloaded((info) => {
      setUpdateDownloaded(true)
      setUpdateAvailable(true)
      setDownloading(false)
      setDownloadPercent(100)
      if (info?.version) setAvailableVersion(info.version)
      setCheckStatus({
        status: 'available',
        version: info?.version,
        message: info?.version
          ? `Update v${info.version} is ready to install.`
          : 'Update ready to install.',
      })
    })

    const offProgress = api.onUpdateDownloadProgress?.((progress) => {
      setDownloading(true)
      setUpdateAvailable(true)
      setDownloadPercent(Math.max(0, Math.min(100, Math.round(progress.percent || 0))))
    })

    api.checkForUpdates().then((result) => {
      if (result?.error) return
      if (result?.updateDownloaded || (result?.isUpdateAvailable && result.version)) {
        setUpdateAvailable(true)
        if (result.version) setAvailableVersion(result.version)
        if (result.updateDownloaded) {
          setUpdateDownloaded(true)
          setDownloadPercent(100)
        }
      } else {
        // Already on latest (or no update) — hide the overlay after restart
        setUpdateAvailable(false)
        setAvailableVersion(null)
      }
      if (result?.currentVersion) setVersion(result.currentVersion)
    })

    return () => {
      offAvailable?.()
      offNotAvailable?.()
      offDownloaded?.()
      offProgress?.()
    }
  }, [])

  const checkForUpdatesNow = useCallback(async () => {
    const api = window.electronAPI
    if (!api?.isElectron) {
      const result: DesktopUpdateCheckResult = {
        status: 'error',
        message: 'Updates are only available in the desktop app.',
      }
      setCheckStatus(result)
      return result
    }
    setCheckStatus({ status: 'checking', message: 'Checking for updates…' })
    setInstallError(null)
    try {
      const result = await api.checkForUpdates()
      if (result?.currentVersion) setVersion(result.currentVersion)
      if (result?.error) {
        const next: DesktopUpdateCheckResult = { status: 'error', message: result.error }
        setCheckStatus(next)
        return next
      }
      if (result?.updateDownloaded || updateDownloaded) {
        setUpdateDownloaded(true)
        setUpdateAvailable(true)
        if (result?.version) setAvailableVersion(result.version)
        const next: DesktopUpdateCheckResult = {
          status: 'available',
          version: result?.version || availableVersion,
          message: `Update v${result?.version || availableVersion || ''} is ready. Click Restart and update or the green arrow.`,
        }
        setCheckStatus(next)
        return next
      }
      if (result?.isUpdateAvailable && result.version) {
        setUpdateAvailable(true)
        setAvailableVersion(result.version)
        // Manual download — badge only until the user starts the update
        const next: DesktopUpdateCheckResult = {
          status: 'available',
          version: result.version,
          message: `Update v${result.version} is available. Click the green arrow (or Download below) to install.`,
        }
        setCheckStatus(next)
        return next
      }
      const next: DesktopUpdateCheckResult = {
        status: 'up-to-date',
        version: result?.currentVersion || version,
        message: `You're on the latest version${result?.currentVersion ? ` (v${result.currentVersion})` : ''}.`,
      }
      setCheckStatus(next)
      setUpdateAvailable(false)
      setAvailableVersion(null)
      return next
    } catch (err) {
      const next: DesktopUpdateCheckResult = {
        status: 'error',
        message: err instanceof Error ? err.message : 'Check failed',
      }
      setCheckStatus(next)
      return next
    }
  }, [availableVersion, updateDownloaded, version])

  const downloadUpdate = useCallback(async () => {
    if (!updateAvailable || updateDownloaded || downloading) return
    setDownloading(true)
    setDownloadPercent(0)
    setInstallError(null)
    const result = await window.electronAPI?.downloadUpdate()
    if (result?.error) {
      setDownloading(false)
      setInstallError(result.error)
      console.error(result.error)
    }
  }, [updateAvailable, updateDownloaded, downloading])

  const installUpdate = useCallback(async () => {
    if (!updateDownloaded || installing) return
    setInstalling(true)
    setInstallError(null)
    try {
      // Give React time to paint the blocking applying modal before Electron exits.
      await new Promise((resolve) => window.setTimeout(resolve, 650))
      await window.electronAPI?.quitAndInstall()
      // Process should exit; keep the applying state visible until it does.
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Restart failed'
      setInstallError(msg)
      setInstalling(false)
      console.error(err)
    }
  }, [updateDownloaded, installing])

  return {
    isElectron: !!window.electronAPI?.isElectron,
    updateAvailable: updateAvailable || updateDownloaded || downloading,
    updateDownloaded,
    downloading,
    installing,
    installError,
    version,
    availableVersion,
    downloadPercent,
    checkStatus,
    checkForUpdatesNow,
    downloadUpdate,
    installUpdate,
  }
}
