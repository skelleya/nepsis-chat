const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, session, systemPreferences } = require('electron')
const path = require('path')
const fs = require('fs')
const { pathToFileURL } = require('url')
const { autoUpdater } = require('electron-updater')

const isDev = process.env.NODE_ENV === 'development'
const APP_URL = process.env.APP_URL || 'http://localhost:5173'
const PROD_URL = process.env.PROD_URL || 'https://nepsischat.vercel.app'
const BUNDLED_INDEX = path.join(process.resourcesPath, 'webapp', 'index.html')

// Set AppUserModelId early — required for Windows to show the custom icon
// in the taskbar instead of the default Electron icon / duplicate entries.
if (process.platform === 'win32') {
  app.setAppUserModelId('com.nepsis.chat')
}

try {
  app.setName('Nepsis Chat')
} catch {
  /* ignore */
}

// One desktop session only — a second launch focuses the existing window.
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
}

let mainWindow = null
let updatingWindow = null
let tray = null
let updateReady = false
/** When true, mainWindow stays hidden until the finishing splash completes. */
let holdMainUntilSplashDone = false

const PENDING_UPDATE_FINISH_FILE = () =>
  path.join(app.getPath('userData'), 'nepsis-pending-update-finish.json')

// Updates from GitHub Releases (same channel for Windows + macOS)
if (!isDev && app.isPackaged) {
  autoUpdater.setFeedURL({ provider: 'github', owner: 'skelleya', repo: 'nepsis-chat' })
  // Download in the background; the renderer only asks when it is ready to restart.
  // Manual download: green badge in the renderer starts downloadUpdate().
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.autoRunAppAfterInstall = true
  autoUpdater.allowDowngrade = false
}

function loadIcon() {
  // Prefer .ico on Windows (taskbar / Alt-Tab); PNG elsewhere
  const candidates =
    process.platform === 'win32'
      ? [
          path.join(__dirname, 'icon.ico'),
          path.join(__dirname, 'build', 'icon.ico'),
          path.join(__dirname, 'icon.png'),
        ]
      : [path.join(__dirname, 'icon.png')]

  for (const iconPath of candidates) {
    if (!fs.existsSync(iconPath)) continue
    const icon = nativeImage.createFromPath(iconPath)
    if (!icon.isEmpty()) return icon
  }
  console.warn('Failed to load Nepsis icon')
  return undefined
}

function sendToRenderer(channel, payload) {
  const win = BrowserWindow.getAllWindows()[0]
  if (win?.webContents) win.webContents.send(channel, payload)
}

function focusMainWindow() {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  if (!mainWindow.isVisible()) mainWindow.show()
  mainWindow.focus()
  if (process.platform === 'win32') {
    // Brief topmost pulse so Windows brings the existing session forward.
    mainWindow.setAlwaysOnTop(true)
    mainWindow.setAlwaysOnTop(false)
  }
}

function markPendingUpdateFinish(version) {
  try {
    fs.writeFileSync(
      PENDING_UPDATE_FINISH_FILE(),
      JSON.stringify({ version: version || app.getVersion(), at: Date.now() }),
      'utf8'
    )
  } catch (err) {
    console.warn('Failed to write pending update marker', err?.message || err)
  }
}

function consumePendingUpdateFinish() {
  const file = PENDING_UPDATE_FINISH_FILE()
  try {
    if (!fs.existsSync(file)) return null
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    fs.unlinkSync(file)
    if (!data?.at || Date.now() - Number(data.at) > 15 * 60 * 1000) return null
    return data
  } catch {
    try {
      fs.unlinkSync(file)
    } catch {
      /* ignore */
    }
    return null
  }
}

function isUpdatedRelaunchArg() {
  return process.argv.some((arg) => arg === '--updated' || arg.startsWith('--updated='))
}

function closeUpdatingWindow() {
  if (updatingWindow && !updatingWindow.isDestroyed()) {
    try {
      updatingWindow.close()
    } catch {
      /* ignore */
    }
  }
  updatingWindow = null
}

/**
 * Discord-style frameless splash: stepped “Applying update N of M” progress.
 * phase: 'applying' (pre-quit) | 'finishing' (post-relaunch)
 */
function showUpdatingSplash({ phase = 'applying', version = '' } = {}) {
  closeUpdatingWindow()
  const icon = loadIcon()
  updatingWindow = new BrowserWindow({
    width: 460,
    height: 340,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    frame: false,
    show: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    backgroundColor: '#111214',
    icon,
    title: 'Updating Nepsis Chat',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })
  if (icon) updatingWindow.setIcon(icon)

  const htmlPath = path.join(__dirname, 'updating.html')
  const qs = new URLSearchParams({
    phase: phase === 'finishing' ? 'finishing' : 'applying',
    version: String(version || '').replace(/^v/i, ''),
  })
  updatingWindow.loadURL(`${pathToFileURL(htmlPath).href}?${qs.toString()}`)
  updatingWindow.once('ready-to-show', () => {
    if (updatingWindow && !updatingWindow.isDestroyed()) updatingWindow.show()
  })
  updatingWindow.on('closed', () => {
    updatingWindow = null
  })
  return updatingWindow
}

/** Compare dotted versions; true if remote is strictly newer than local. */
function isVersionNewer(remote, local) {
  if (!remote || !local) return false
  const parse = (v) =>
    String(v)
      .replace(/^v/i, '')
      .split(/[.+-]/)
      .map((p) => parseInt(p, 10) || 0)
  const a = parse(remote)
  const b = parse(local)
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const x = a[i] || 0
    const y = b[i] || 0
    if (x > y) return true
    if (x < y) return false
  }
  return false
}

function createTray() {
  const icon = loadIcon()
  if (!icon) return
  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  tray.setToolTip('Nepsis Chat')

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Nepsis Chat', click: () => focusMainWindow() },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true
        app.quit()
      },
    },
  ])
  tray.setContextMenu(contextMenu)
  tray.on('click', () => focusMainWindow())
}

function createWindow() {
  const icon = loadIcon()
  const isMac = process.platform === 'darwin'

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon,
    title: 'Nepsis Chat',
    // Custom Discord-like chrome (TitleBar.tsx in renderer)
    frame: false,
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: isMac ? { x: 14, y: 10 } : undefined,
    autoHideMenuBar: true,
    backgroundColor: '#111214',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      spellcheck: true,
    },
  })

  if (icon) mainWindow.setIcon(icon)

  Menu.setApplicationMenu(null)

  mainWindow.once('ready-to-show', () => {
    if (holdMainUntilSplashDone) return
    mainWindow.show()
  })

  const emitMaximized = () => {
    sendToRenderer('window-maximized', mainWindow.isMaximized())
  }
  mainWindow.on('maximize', emitMaximized)
  mainWindow.on('unmaximize', emitMaximized)

  if (app.isPackaged) {
    // Bundled frontend built with --mode desktop (production API + Supabase).
    mainWindow.loadFile(BUNDLED_INDEX).catch(() => {
      mainWindow.loadURL(PROD_URL)
    })
  } else {
    mainWindow.loadURL(APP_URL)
    mainWindow.webContents.once('did-fail-load', (_, errorCode) => {
      if (errorCode === -6 || errorCode === -2) {
        mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
          <!DOCTYPE html><html><head><meta charset="utf-8"><title>Nepsis Chat</title></head>
          <body style="font-family:sans-serif;padding:2rem;background:#1a1a2e;color:#eee;max-width:600px;margin:0 auto;">
            <h1>Frontend not running</h1>
            <p>Start the frontend dev server first:</p>
            <pre style="background:#16213e;padding:1rem;border-radius:8px;overflow-x:auto;">cd frontend
npm run dev</pre>
            <p>Then restart the desktop app. The app loads from <code>${APP_URL}</code>.</p>
          </body></html>
        `)}`)
      }
    })
  }

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  if (!isDev && app.isPackaged) {
    autoUpdater.checkForUpdates().catch(() => {})
    setInterval(() => {
      autoUpdater.checkForUpdates().catch(() => {})
    }, 1000 * 60 * 30)
  }

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })
}

ipcMain.handle('get-version', () => app.getVersion())
ipcMain.handle('get-platform', () => process.platform)

ipcMain.handle('window-minimize', () => {
  mainWindow?.minimize()
})
ipcMain.handle('window-maximize-toggle', () => {
  if (!mainWindow) return false
  if (mainWindow.isMaximized()) mainWindow.unmaximize()
  else mainWindow.maximize()
  return mainWindow.isMaximized()
})
ipcMain.handle('window-close', () => {
  // Same as clicking X — hide to tray unless quitting
  mainWindow?.close()
})
ipcMain.handle('window-is-maximized', () => !!mainWindow?.isMaximized())

ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged) return { error: 'Updates are only available in the installed desktop app.' }
  try {
    const result = await autoUpdater.checkForUpdates()
    const feedVersion = result?.updateInfo?.version || null
    const currentVersion = app.getVersion()
    // electron-updater still returns updateInfo.version when already on latest —
    // only surface a badge when a newer release is actually available.
    const available =
      !!result?.isUpdateAvailable && isVersionNewer(feedVersion, currentVersion)
    return {
      version: available ? feedVersion : undefined,
      currentVersion,
      isUpdateAvailable: available,
      updateDownloaded: updateReady,
    }
  } catch (err) {
    return { error: err?.message || 'Check failed', currentVersion: app.getVersion() }
  }
})

ipcMain.handle('download-update', async () => {
  if (!app.isPackaged) return { error: 'Not packaged' }
  try {
    await autoUpdater.downloadUpdate()
    return { ok: true }
  } catch (err) {
    return { error: err?.message || 'Download failed' }
  }
})

autoUpdater.on('update-available', (info) => {
  const feedVersion = info?.version
  const currentVersion = app.getVersion()
  if (!isVersionNewer(feedVersion, currentVersion)) {
    sendToRenderer('update-not-available', { version: currentVersion })
    return
  }
  sendToRenderer('update-available', {
    version: feedVersion,
    releaseName: info?.releaseName,
  })
})

autoUpdater.on('update-not-available', (info) => {
  sendToRenderer('update-not-available', {
    version: info?.version || app.getVersion(),
  })
})

autoUpdater.on('download-progress', (progress) => {
  sendToRenderer('update-download-progress', {
    percent: progress?.percent ?? 0,
    transferred: progress?.transferred ?? 0,
    total: progress?.total ?? 0,
  })
})

autoUpdater.on('update-downloaded', (info) => {
  updateReady = true
  sendToRenderer('update-downloaded', { version: info?.version })
})

ipcMain.handle('quit-and-install', async () => {
  // Always allow quit so tray "hide on close" cannot swallow the install
  app.isQuitting = true

  if (!updateReady) {
    // Still attempt install — download may be ready even if the flag was missed
    console.warn('quit-and-install: updateReady was false; attempting quitAndInstall anyway')
  }

  // So the next launch shows the finishing splash even if `--updated` is missing.
  markPendingUpdateFinish(app.getVersion())

  // Detach close-to-tray handlers so quitAndInstall is not blocked
  for (const win of BrowserWindow.getAllWindows()) {
    win.removeAllListeners('close')
  }

  try {
    // Dedicated splash survives briefly while the main window hides / process exits.
    showUpdatingSplash({ phase: 'applying', version: app.getVersion() })
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        mainWindow.hide()
      } catch {
        /* ignore */
      }
    }
  } catch (err) {
    console.warn('Updating splash failed', err?.message || err)
  }

  // Let the splash animate a couple of steps before NSIS takes over.
  await new Promise((r) => setTimeout(r, 1400))

  try {
    // Silent NSIS update (/S --updated) reuses InstallLocation and never shows the
    // first-run “who should this be installed for?” / directory wizard.
    autoUpdater.quitAndInstall(true, true)
  } catch (err) {
    console.error('quitAndInstall failed', err)
    // autoInstallOnAppQuit is true — force quit so the update still applies
    app.exit(0)
  }

  // Fallback if quitAndInstall does not exit (some Windows/tray setups)
  setTimeout(() => {
    if (!app.isQuitting) return
    app.exit(0)
  }, 4000)

  return { ok: true }
})

function setupMediaPermissions() {
  // Allow mic/camera/screen prompts from our app origins. Without this, Chromium
  // may deny getUserMedia and Windows surfaces "Permission denied by system".
  const allow = new Set(['media', 'mediaKeySystem', 'display-capture', 'notifications'])
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(allow.has(permission))
  })
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allow.has(permission))

  if (process.platform === 'darwin') {
    try {
      const mic = systemPreferences.getMediaAccessStatus('microphone')
      if (mic !== 'granted') {
        systemPreferences.askForMediaAccess('microphone').catch(() => {})
      }
      const cam = systemPreferences.getMediaAccessStatus('camera')
      if (cam !== 'granted') {
        systemPreferences.askForMediaAccess('camera').catch(() => {})
      }
    } catch (err) {
      console.warn('macOS media access prompt failed', err?.message || err)
    }
  }
}

if (gotSingleInstanceLock) {
  app.on('second-instance', () => {
    focusMainWindow()
  })

  app.whenReady().then(() => {
    setupMediaPermissions()

    const pendingFinish = consumePendingUpdateFinish()
    const updatedRelaunch = isUpdatedRelaunchArg() || !!pendingFinish
    if (updatedRelaunch) {
      holdMainUntilSplashDone = true
      const splashStarted = Date.now()
      showUpdatingSplash({
        phase: 'finishing',
        version: app.getVersion(),
      })
      createWindow()
      createTray()

      const revealMain = () => {
        const minMs = 3800
        const wait = Math.max(0, minMs - (Date.now() - splashStarted))
        setTimeout(() => {
          holdMainUntilSplashDone = false
          closeUpdatingWindow()
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show()
            focusMainWindow()
          }
        }, wait)
      }

      if (mainWindow?.webContents.isLoading()) {
        mainWindow.webContents.once('did-finish-load', revealMain)
      } else {
        revealMain()
      }
    } else {
      createWindow()
      createTray()
    }
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      // Stay alive in the tray on Windows/Linux when the window is hidden.
      // Quitting is explicit via tray Quit.
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else focusMainWindow()
  })
}
