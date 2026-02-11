import { useState, useEffect } from 'react'

export function useDesktopUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateDownloaded, setUpdateDownloaded] = useState(false)
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
    })

    api.checkForUpdates().then((result) => {
      if (result?.version) setUpdateAvailable(true)
    })
  }, [])

  const installUpdate = () => {
    if (!updateDownloaded) return
    window.electronAPI?.quitAndInstall().catch(console.error)
  }

  return {
    isElectron: !!window.electronAPI?.isElectron,
    updateAvailable: updateAvailable || updateDownloaded,
    updateDownloaded,
    version,
    installUpdate,
  }
}
