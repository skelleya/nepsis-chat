# Errors & Solutions

Known issues and fixes.

---

## Server

| Error | Cause | Solution |
|-------|-------|----------|
| EADDRINUSE: address already in use :::3000 | Port 3000 in use | Kill process (see below) or use PORT=3001 |

### EADDRINUSE (port 3000 in use)

```powershell
netstat -ano | findstr :3000
taskkill /PID <pid> /F
```

Replace `<pid>` with the number from the last column. Or use a different port: `$env:PORT=3001; npm run dev` (PowerShell).

---

## Build & Tooling

| Error | Cause | Solution |
|-------|-------|----------|
| Tailwind PostCSS error | Tailwind v4 | Use Tailwind v3 |
| PowerShell `&&` invalid | PowerShell syntax | Use `;` instead of `&&` |
| npm ENOTEMPTY | Corrupt node_modules | Delete node_modules, run `npm install` |

---

## Download

| Error | Cause | Solution |
|-------|-------|----------|
| Downloaded file corrupt/unreadable | Link pointed to non-existent exe | Vite served index.html. Run `npm run package:full` (or `copy-exe`) so `frontend/public/NepsisChat-Setup.exe` exists |

---

## Electron

| Error | Cause | Solution |
|-------|-------|----------|
| Cannot create symbolic link (winCodeSign) | Windows symlink permissions | Set `signAndEditExecutable: false` |
| Update not detected | Wrong UPDATE_URL or missing files | Ensure `backend/updates/` has latest.yml and installer; backend must serve `/updates/` |
| Installer shows old text (e.g. old description) or wrong version | Using old build artifacts | Rebuild: `cd electron && npm run package:full` — installer reads from package.json |
| Grey screen + "Downloading" stuck | Update check found update but download hangs (e.g. unreachable localhost:3000) | UpdateButton now only shows when update is ready to install. Rebuild frontend; if dev mode, start frontend first (`cd frontend && npm run dev`) |

---

## WebRTC

| Error | Cause | Solution |
|-------|-------|----------|
| getUserMedia fails | Not HTTPS/localhost | Use localhost or HTTPS |
| No audio between peers | Firewall/NAT | Add TURN server for strict NAT |

---

## Installer / Desktop App

| Error | Cause | Solution |
|-------|-------|----------|
| App shows blank after install | Previously loaded from URL | Now bundles frontend; rebuild with `npm run package` |
| Grey screen when running `npm start` (electron) | Frontend dev server not running | Start frontend first: `cd frontend && npm run dev`, then `cd electron && npm start` |
| Desktop app still shows old Electron logo (taskbar) | In dev mode, Windows taskbar always shows Electron's logo because it comes from `electron.exe`. The BrowserWindow icon only affects the title bar. | Rebuild packaged app: `cd electron && npm run package:full`. Electron-builder embeds `electron/icon.png` (Nepsis logo) into the `.exe`. Only the packaged/installed app shows the Nepsis icon in the taskbar. |
| Invalid icon file (NSIS) | icon.png not a valid .ico | Remove icon config or use .ico file |
| Only find 0.0.1 when 0.0.3 exists | publish-update/copy-exe used first .exe found | Scripts now use latest.yml to pick the correct installer; run `npm run package:full` |
| Packaged app blank / routes broken / stuck on download page | `BrowserRouter` doesn't work with `file://` protocol. When Electron loads `index.html` via `loadFile`, the pathname is the full file path (not `/`), so no React Router route matches properly. | Switched from `BrowserRouter` to `HashRouter` in `main.tsx`. Hash routing (`/#/path`) works with any protocol including `file://`. Rebuild: `cd electron && npm run package:full`. |
| Images (logo, favicon) not loading in packaged app | Hardcoded absolute paths like `/logo.png` resolve to filesystem root under `file://` protocol. | Changed asset paths from `/logo.png` to `./logo.png` in components (LoginPage, DownloadPage). Relative paths resolve correctly from `index.html` location. Vite's `base: './'` handles built JS/CSS assets automatically. |

---

## Adding New Issues

When a new error occurs:

1. Add it here with cause and solution
2. Update [WIKI.md](WIKI.md) if it affects main flows
