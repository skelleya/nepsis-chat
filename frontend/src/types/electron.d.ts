export type UpdateInfo = {
  version?: string
  releaseName?: string
}

export type UpdateProgress = {
  percent: number
  transferred: number
  total: number
}

export interface ElectronAPI {
  isElectron: true
  getVersion: () => Promise<string>
  getPlatform: () => Promise<string>
  checkForUpdates: () => Promise<{ version?: string; error?: string } | null>
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => (() => void) | void
  onUpdateDownloaded: (callback: (info?: UpdateInfo) => void) => (() => void) | void
  onUpdateDownloadProgress: (callback: (progress: UpdateProgress) => void) => (() => void) | void
  downloadUpdate: () => Promise<{ ok?: boolean; error?: string }>
  quitAndInstall: () => Promise<void>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
