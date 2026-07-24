# Versioning & Auto-Updates

Desktop updates use **electron-updater** with **GitHub Releases** as the feed (Windows + macOS).

---

## How users get updates

1. App launches (and every 30 minutes) → checks GitHub Releases for a newer version.
2. If a newer release is found, the desktop shell **downloads it in the background** (`autoDownload = true`).
3. When the package is staged → a modal asks only whether to **Restart and update** (or Later).
4. Restart shows an **Applying update…** modal with an indeterminate loading bar, then runs a **silent** installer that reuses the original per-user / all-users install scope and location (`quitAndInstall(true, true)`).
5. The app relaunches on the new version.

Files: `electron/main.js`, `frontend/src/components/UpdateButton.tsx`, `frontend/src/hooks/useDesktopUpdate.ts`.

Notes:

- Download progress is real; the applying bar is indeterminate because NSIS install progress is not exposed to the renderer.
- First-time installs still use the assisted NSIS wizard. Updates skip the “who should this application be installed for?” page because they are silent + `--updated`.

---

## Publishing a release

**Preferred (CI):** bump `electron/package.json` version → push tag `v{version}` → GitHub Actions **Desktop Release** builds Windows + macOS and publishes one release with both installers + `latest.yml` / `latest-mac.yml`.

```bash
# Local alternative — bump version in electron/package.json first
export GH_TOKEN=ghp_...   # repo scope: contents/releases

# On Windows (or CI windows-latest) — produces NepsisChat-Setup.exe + latest.yml
npm run release:win

# On macOS — produces DMG + ZIP + latest-mac.yml
npm run release:mac
```

Artifacts must be on the **same GitHub Release** for both platforms when you want cross-platform updates.

---

## Version number

- Source of truth: `electron/package.json` → `"version"`
- Shown via `electronAPI.getVersion()`
- Bump before each publish (`electron/scripts/bump-version.js` or edit manually)

---

## Same UI as the browser

Packaged builds run `vite build --mode desktop`, which loads `frontend/.env.desktop` (live Railway API + Supabase). The SPA is copied into `resources/webapp/` — not a live Vercel shell.
