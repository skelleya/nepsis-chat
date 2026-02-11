import { useState, useEffect } from 'react'

export function useDesktopUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateDownloaded, setUpdateDownloaded] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    const api = window.electronAPI
    if (!api?.isElectron) return

    api.getVersion().then(setVersion)

    api.onUpdateAvailable(() => {
      setUpdateAvailable(true)
    })

    api.onUpdateDownloaded(() => {
      setUpdateDownloaded(true)
      setDownloading(false)
    })

    api.checkForUpdates().then((result) => {
      if (result?.version) setUpdateAvailable(true)
    })
  }, [])

  const downloadUpdate = async () => {
    if (!updateAvailable || updateDownloaded || downloading) return
    setDownloading(true)
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
    downloadUpdate,
    installUpdate,
  }
}
