# Electron & Desktop App

Desktop app wrapper and packaging.

---

## Overview

- **Installed app**: Loads from the production URL (`https://nepsis-chat.fly.dev`) so API calls are same-origin (no CORS issues). Falls back to bundled frontend from `resources/app/` via `file://` if server is unreachable.
- **Dev mode**: Loads from URL (default: `http://localhost:5173`)
- NSIS installer installs to Program Files
- electron-updater for auto-updates
- Green "Update Available" button when a new version is pushed
- **System tray**: Closing the window hides to tray (does not quit). Right-click tray → Show or Quit.
- **Routing**: Frontend uses `HashRouter` (not `BrowserRouter`) so routes work with both `http://` and `file://` protocols. URLs use hashes: `/#/`, `/#/download`.
- **App icon**: Uses `app.setAppUserModelId('com.nepsis.chat')` + `nativeImage.createFromPath()` + `mainWindow.setIcon()` for proper Windows taskbar icon in both dev and packaged modes. Electron-builder embeds the icon into the `.exe` for the installer.
- **Session persistence**: User login is saved to `localStorage` so users stay logged in across app restarts.

---

## Files

| File | Purpose |
|------|---------|
| main.js | Main process, BrowserWindow, autoUpdater |
| icon.png | **Nepsis logo** — app icon (window title bar, tray, installer, desktop shortcut, NSIS wizard). To update: copy your logo to `electron/icon.png`, `frontend/public/logo.png`, and `frontend/public/favicon.png`, then run `npm run package:full` |
| preload.js | Exposes electronAPI to renderer |
| scripts/bump-version.js | Bump patch version |
| scripts/publish-update.js | Copy build to backend/updates |

---

## electronAPI (preload)

Exposed to the renderer via `window.electronAPI`:

| Method | Returns | Purpose |
|--------|---------|---------|
| getVersion | string | App version |
| checkForUpdates | object | Check for updates |
| onUpdateAvailable | void | Subscribe to update-available |
| onUpdateDownloaded | void | Subscribe to update-downloaded |
| quitAndInstall | void | Restart and install update |

---

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| APP_URL | http://localhost:5173 | URL the app loads (dev mode) |
| PROD_URL | https://nepsis-chat.fly.dev | Production URL (packaged app loads this) |
| UPDATE_URL | `${PROD_URL}/updates` | Update server URL |
| NODE_ENV | — | `development` = dev tools |

---

## Build Output

| Path | Contents |
|------|----------|
| dist/Nepsis Chat Setup X.X.X.exe | NSIS installer (with Nepsis logo) |
| dist/latest.yml | Update manifest |
| dist/win-unpacked/ | Unpacked app (for testing) |

---

## Production

1. Edit `electron/package.json` → `build.publish.url` to your server
2. Upload `Nepsis Chat Setup X.X.X.exe` and `latest.yml` to that URL
3. Ensure CORS allows the app origin if needed
