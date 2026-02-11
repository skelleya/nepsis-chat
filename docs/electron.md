# Electron & Desktop App

Desktop app wrapper and packaging.

---

## Overview

- **Installed app**: Loads the bundled frontend from `resources/app/` via `file://` protocol (works offline)
- **Dev mode**: Loads from URL (default: `http://localhost:5173`)
- NSIS installer installs to Program Files
- electron-updater for auto-updates
- Green "Update Available" button when a new version is pushed
- **System tray**: Closing the window hides to tray (does not quit). Right-click tray → Show or Quit.
- **Routing**: Frontend uses `HashRouter` (not `BrowserRouter`) so routes work with both `http://` and `file://` protocols. URLs use hashes: `/#/`, `/#/download`.
- **App icon**: In dev mode, Windows taskbar shows Electron's default logo (from `electron.exe`). The Nepsis logo only appears in the taskbar for the packaged/installed app where it is embedded into the `.exe` by electron-builder.

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
| APP_URL | http://localhost:5173 | URL the app loads |
| UPDATE_URL | http://localhost:3000/updates | Update server URL |
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
