# Electron & Desktop App

Desktop app wrapper and packaging. The packaged app loads the **same React UI** as the browser (bundled into `resources/webapp/`), pointed at the live Railway API via `frontend/.env.desktop`.

---

## Overview

- **Installed app**: Loads bundled frontend (`resources/webapp/index.html`) — identical UI to the web app. API/Supabase baked at package time (`npm run build -- --mode desktop`).
- **Dev mode**: Loads `http://localhost:5173` (`APP_URL`).
- **Windows**: NSIS installer `NepsisChat-Setup.exe`
- **macOS**: DMG + ZIP (ZIP required for `electron-updater`)
- **Updates**: `electron-updater` from **GitHub Releases**. When a newer version ships, a **Nepsis update badge** appears at the top of the app; click to download, then restart to install.
- **System tray**: Closing the window hides to tray (does not quit).
- **Routing**: `HashRouter` + Vite `base: './'` for `file://` compatibility.
- **Custom title bar**: Frameless window + `TitleBar.tsx` (drag region; Windows/Linux min/max/close). macOS uses `hiddenInset` traffic lights.
- **Auth**: Desktop skips WelcomeLanding and Guest — Sign In / Sign Up only.
- **Icons**: `electron/icon.png` + `electron/icon.ico` / `build/icon.ico` (multi-size). `app.setAppUserModelId('com.nepsis.chat')` for Windows taskbar.

---

## Commands

| Command | Purpose |
|---------|---------|
| `npm run electron` | Dev: Electron + local Vite (start frontend separately) |
| `npm run package:win` | Build frontend (desktop mode) + Windows NSIS |
| `npm run package:mac` | Build frontend + macOS DMG/ZIP (**must run on macOS**) |
| `npm run package:all` | Win + Mac (Mac targets need a Mac host) |
| `npm run release` | Build Win+Mac and publish to GitHub Releases (`GH_TOKEN` required) |
| `npm run release:win` | Publish Windows only |
| `npm run release:mac` | Publish macOS only |

Artifacts land in `electron/dist/`.

---

## Update badge (renderer)

| File | Role |
|------|------|
| `frontend/src/components/UpdateButton.tsx` | Top-center badge with Nepsis logo |
| `frontend/src/hooks/useDesktopUpdate.ts` | IPC: available / progress / downloaded |
| `electron/main.js` | `autoUpdater` → `update-available`, `update-download-progress`, `update-downloaded` |

Flow: check on launch (+ every 30 min) → badge “Update available” → user clicks → download with progress → “Restart to update”. Badge sits below the custom title bar (`z-[70]`, `no-drag`) so clicks work. `quit-and-install` sets `isQuitting`, removes tray close handlers, then `quitAndInstall` with `app.exit` fallback (0.1.3+).

---

## Environment

| Variable | Purpose |
|----------|---------|
| `frontend/.env.desktop` | `VITE_API_URL` / Supabase keys for packaged builds |
| `APP_URL` | Dev load URL (default Vite) |
| `PROD_URL` | Fallback if bundle missing (Vercel) |
| `GH_TOKEN` | Required for `npm run release` |
| Apple notarization vars | Required for public macOS distribution |

---

## First release checklist

1. Set `frontend/.env.desktop` to live Railway + Supabase (already wired for production).
2. **Preferred:** GitHub → Actions → **Desktop Release** → Run workflow (`publish` checked). Builds Win on `windows-latest`, Mac on `macos-latest`, then publishes tag `v{electron/package.json version}` with both installers.
3. Local alternative: `cd electron && npm ci`, then `npm run release:win` / `npm run release:mac` with `GH_TOKEN` (Mac must run on macOS).
4. Confirm the GitHub Release has `NepsisChat-Setup.exe`, `latest.yml`, and for Mac `*.dmg` / `*.zip` + `latest-mac.yml`.
5. Download page (`/download`) auto-detects OS and shows **Install for Mac** / **Install for Windows** with platform logos.
6. Install older version → publish newer → confirm top update badge appears.

### macOS signing note

CI uses **ad-hoc codesign** (`mac.identity: "-"`) so Gatekeeper is less likely to show “app is damaged”. There is still **no Apple notarization** until a Developer ID cert is configured.

If a user still sees “damaged and cannot be opened”:

```bash
xattr -cr "/Applications/Nepsis Chat.app"
```

Then open the app again (or right-click → **Open**).
