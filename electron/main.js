const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron')
const path = require('path')
const { autoUpdater } = require('electron-updater')

const isDev = process.env.NODE_ENV === 'development'
const APP_URL = process.env.APP_URL || 'http://localhost:5173'
const PROD_URL = process.env.PROD_URL || 'https://nepsis-chat.vercel.app'

// Set AppUserModelId early — required for Windows to show the custom icon
// in the taskbar instead of the default Electron icon.
if (process.platform === 'win32') {
  app.setAppUserModelId('com.nepsis.chat')
}

let mainWindow = null
let tray = null

// Updates from GitHub Releases — no Fly upload needed
if (!isDev && app.isPackaged) {
  autoUpdater.setFeedURL({ provider: 'github', owner: 'skelleya', repo: 'nepsis-chat' })
  autoUpdater.autoDownload = false  // User clicks download icon to start
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

function createTray() {
  const icon = loadIcon()
  if (!icon) return
  tray = new Tray(icon)
  tray.setToolTip('Nepsis Chat')

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Nepsis Chat', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => {
      app.isQuitting = true
      app.quit()
    } },
  ])
  tray.setContextMenu(contextMenu)

  tray.on('click', () => mainWindow?.show())
}

function createWindow() {
  const icon = loadIcon()

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: icon,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // Explicitly set the icon on the window (ensures taskbar picks it up)
  if (icon) mainWindow.setIcon(icon)

  if (app.isPackaged) {
    // Load from the production server (same-origin avoids CORS issues with
    // file:// protocol).  Fall back to local files if the server is unreachable.
    mainWindow.loadURL(PROD_URL)
    mainWindow.webContents.once('did-fail-load', () => {
      const indexPath = path.join(process.resourcesPath, 'app', 'index.html')
      mainWindow.loadFile(indexPath)
    })
  } else {
    mainWindow.loadURL(APP_URL)
    mainWindow.webContents.once('did-fail-load', (_, errorCode, errorDescription, validatedURL) => {
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
    mainWindow.webContents.openDevTools()
  }

  if (!isDev && app.isPackaged) {
    autoUpdater.checkForUpdates().catch(() => {})
  }

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })
}

ipcMain.handle('get-version', () => app.getVersion())

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
  const win = BrowserWindow.getAllWindows()[0]
  if (win?.webContents) win.webContents.send('update-available', info)
  // Don't auto-download — user clicks the download icon to start
})

let updateReady = false
autoUpdater.on('update-downloaded', () => {
  updateReady = true
  const win = BrowserWindow.getAllWindows()[0]
  if (win?.webContents) win.webContents.send('update-downloaded')
})

ipcMain.handle('quit-and-install', () => {
  if (!updateReady) {
    return Promise.reject(new Error('Update not ready'))
  }
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
})
