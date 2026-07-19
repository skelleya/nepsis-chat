const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron')
const path = require('path')
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
  const iconPath = path.join(__dirname, 'icon.png')
  const icon = nativeImage.createFromPath(iconPath)
  if (icon.isEmpty()) {
    console.warn('Failed to load icon from', iconPath)
    return undefined
  }
  return icon
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

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon,
    // Match the browser app chrome — no Electron menu bar clutter
    autoHideMenuBar: true,
    backgroundColor: '#111214',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // Same origin policies as a normal browser tab for the bundled SPA
      spellcheck: true,
    },
  })

  if (icon) mainWindow.setIcon(icon)

  // Remove default File/Edit menu so the window feels like the web app
  Menu.setApplicationMenu(null)

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  if (app.isPackaged) {
    // Bundled frontend built with --mode desktop (production API + Supabase).
    // Falls back to live Vercel only if the bundle is missing.
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
    // Re-check periodically so users see the badge without restarting
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

ipcMain.handle('quit-and-install', () => {
  if (!updateReady) {
    return Promise.reject(new Error('Update not ready'))
  }
  app.isQuitting = true
  setImmediate(() => autoUpdater.quitAndInstall(false, true))
  return Promise.resolve()
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
