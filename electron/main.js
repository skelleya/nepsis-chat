const { app, BrowserWindow, ipcMain, Tray, Menu } = require('electron')
const path = require('path')
const { autoUpdater } = require('electron-updater')

const isDev = process.env.NODE_ENV === 'development'
const APP_URL = process.env.APP_URL || 'http://localhost:5173'
const UPDATE_URL = process.env.UPDATE_URL || 'https://nepsis-chat.fly.dev/updates'

let mainWindow = null
let tray = null

if (!isDev && app.isPackaged) {
  autoUpdater.setFeedURL({ provider: 'generic', url: UPDATE_URL })
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
}

function getTrayIconPath() {
  return path.join(__dirname, 'icon.png')
}

function createTray() {
  const iconPath = getTrayIconPath()
  tray = new Tray(iconPath)
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

function getIconPath() {
  return path.join(__dirname, 'icon.png')
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: getIconPath(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  if (app.isPackaged) {
    const indexPath = path.join(process.resourcesPath, 'app', 'index.html')
    mainWindow.loadFile(indexPath)
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

autoUpdater.on('update-available', (info) => {
  const win = BrowserWindow.getAllWindows()[0]
  if (win?.webContents) win.webContents.send('update-available', info)
  autoUpdater.downloadUpdate()
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
