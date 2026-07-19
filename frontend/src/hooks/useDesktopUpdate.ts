import { useState, useEffect } from 'react'

export function useDesktopUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateDownloaded, setUpdateDownloaded] = useState(false)
  const [downloading, setDownloading] = useState(false)
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

    const offDownloaded = api.onUpdateDownloaded((info) => {
      setUpdateDownloaded(true)
      setDownloading(false)
      setDownloadPercent(100)
      if (info?.version) setAvailableVersion(info.version)
    })

    const offProgress = api.onUpdateDownloadProgress?.((progress) => {
      setDownloading(true)
      setDownloadPercent(Math.max(0, Math.min(100, Math.round(progress.percent || 0))))
    })

    api.checkForUpdates().then((result) => {
      if (result?.version) {
        setUpdateAvailable(true)
        setAvailableVersion(result.version)
      }
    })

    return () => {
      offAvailable?.()
      offDownloaded?.()
      offProgress?.()
    }
  }, [])

  const downloadUpdate = async () => {
    if (!updateAvailable || updateDownloaded || downloading) return
    setDownloading(true)
    setDownloadPercent(0)
    const result = await window.electronAPI?.downloadUpdate()
    if (result?.error) {
      setDownloading(false)
      console.error(result.error)
    }
  }

  const installUpdate = () => {
    if (!updateDownloaded) return
    window.electronAPI?.quitAndInstall().catch(console.error)
  }

  return {
    isElectron: !!window.electronAPI?.isElectron,
    updateAvailable: updateAvailable || updateDownloaded,
    updateDownloaded,
    downloading,
    version,
    availableVersion,
    downloadPercent,
    downloadUpdate,
    installUpdate,
  }
}
