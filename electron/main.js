const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')
const { autoUpdater } = require('electron-updater')

const isDev = process.env.NODE_ENV === 'development'
const APP_URL = process.env.APP_URL || 'http://localhost:5173'
const PROD_URL = process.env.PROD_URL || 'https://nepsischat.vercel.app'
const BUNDLED_INDEX = path.join(process.resourcesPath, 'webapp', 'index.html')

// Set AppUserModelId early — required for Windows to show the custom icon
// in the taskbar instead of the default Electron icon.
if (process.platform === 'win32') {
  app.setAppUserModelId('com.nepsis.chat')
}

let mainWindow = null
let tray = null
let updateReady = false

// Updates from GitHub Releases (same channel for Windows + macOS)
if (!isDev && app.isPackaged) {
  autoUpdater.setFeedURL({ provider: 'github', owner: 'skelleya', repo: 'nepsis-chat' })
  autoUpdater.autoDownload = false // User clicks the update badge to start
  autoUpdater.autoInstallOnAppQuit = true
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

function createTray() {
  const icon = loadIcon()
  if (!icon) return
  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  tray.setToolTip('Nepsis Chat')

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Nepsis Chat', click: () => mainWindow?.show() },
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
  tray.on('click', () => mainWindow?.show())
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
  if (!app.isPackaged) return { error: 'Not packaged' }
  try {
    const result = await autoUpdater.checkForUpdates()
    return result?.updateInfo ? { version: result.updateInfo.version } : null
  } catch (err) {
    return { error: err?.message || 'Check failed' }
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
  sendToRenderer('update-available', {
    version: info?.version,
    releaseName: info?.releaseName,
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

  // Detach close-to-tray handlers so quitAndInstall is not blocked
  for (const win of BrowserWindow.getAllWindows()) {
    win.removeAllListeners('close')
  }

  // Brief delay lets the IPC reply reach the renderer before process exit
  await new Promise((r) => setTimeout(r, 150))

  try {
    // isSilent=false, isForceRunAfter=true — restart into the new version
    autoUpdater.quitAndInstall(false, true)
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

app.whenReady().then(() => {
  createWindow()
  createTray()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
  else mainWindow?.show()
})
