import { useState, useEffect } from 'react'

export function useDesktopUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateDownloaded, setUpdateDownloaded] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [installError, setInstallError] = useState<string | null>(null)
  const [version, setVersion] = useState<string | null>(null)
  const [availableVersion, setAvailableVersion] = useState<string | null>(null)
  const [downloadPercent, setDownloadPercent] = useState(0)

  useEffect(() => {
    const api = window.electronAPI
    if (!api?.isElectron) return

    api.getVersion().then(setVersion)

    const offAvailable = api.onUpdateAvailable((info) => {
      setUpdateAvailable(true)
      if (info?.version) setAvailableVersion(info.version)
    })

    const offNotAvailable = api.onUpdateNotAvailable?.(() => {
      // After a successful install/restart the feed still returns a version —
      // clear the badge when we are already on latest.
      setUpdateAvailable(false)
      setAvailableVersion(null)
    })

    const offDownloaded = api.onUpdateDownloaded((info) => {
      setUpdateDownloaded(true)
      setUpdateAvailable(true)
      setDownloading(false)
      setDownloadPercent(100)
      if (info?.version) setAvailableVersion(info.version)
    })

    const offProgress = api.onUpdateDownloadProgress?.((progress) => {
      setDownloading(true)
      setDownloadPercent(Math.max(0, Math.min(100, Math.round(progress.percent || 0))))
    })

    api.checkForUpdates().then((result) => {
      if (result?.error) return
      if (result?.isUpdateAvailable && result.version) {
        setUpdateAvailable(true)
        setAvailableVersion(result.version)
      } else {
        // Already on latest (or no update) — hide the overlay after restart
        setUpdateAvailable(false)
        setAvailableVersion(null)
      }
    })

    return () => {
      offAvailable?.()
      offNotAvailable?.()
      offDownloaded?.()
      offProgress?.()
    }
  }, [])

  const downloadUpdate = async () => {
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
  }

  const installUpdate = async () => {
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
  }

  return {
    isElectron: !!window.electronAPI?.isElectron,
    updateAvailable: updateAvailable || updateDownloaded,
    updateDownloaded,
    downloading,
    installing,
    installError,
    version,
    availableVersion,
    downloadPercent,
    downloadUpdate,
    installUpdate,
  }
}
