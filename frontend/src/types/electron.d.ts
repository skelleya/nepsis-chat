export interface ElectronAPI {
  isElectron: true
  getVersion: () => Promise<string>
  checkForUpdates: () => Promise<{ version?: string; error?: string } | null>
  onUpdateAvailable: (callback: (info: { version: string }) => void) => void
  onUpdateDownloaded: (callback: () => void) => void
  quitAndInstall: () => Promise<void>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
