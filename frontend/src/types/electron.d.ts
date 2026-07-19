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
  windowMinimize: () => Promise<void>
  windowMaximizeToggle: () => Promise<boolean>
  windowClose: () => Promise<void>
  windowIsMaximized: () => Promise<boolean>
  onWindowMaximized: (callback: (maximized: boolean) => void) => (() => void) | void
  checkForUpdates: () => Promise<{
    version?: string
    currentVersion?: string
    isUpdateAvailable?: boolean
    error?: string
  } | null>
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => (() => void) | void
  onUpdateNotAvailable: (callback: (info?: UpdateInfo) => void) => (() => void) | void
  onUpdateDownloaded: (callback: (info?: UpdateInfo) => void) => (() => void) | void
  onUpdateDownloadProgress: (callback: (progress: UpdateProgress) => void) => (() => void) | void
  downloadUpdate: () => Promise<{ ok?: boolean; error?: string }>
  quitAndInstall: () => Promise<{ ok?: boolean } | void>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
