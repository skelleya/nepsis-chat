# Versioning & Auto-Updates

Desktop updates use **electron-updater** with **GitHub Releases** as the feed (Windows + macOS).

---

## How users get updates

1. App launches (and every 30 minutes) → checks GitHub Releases for a newer version.
2. If a newer release is found, the desktop shell **downloads it in the background** (`autoDownload = true`) and can show a **download progress modal**.
3. When the package is staged → a modal asks whether to **Restart and update** or **Update later**.
4. **Update later** dismisses the modal and leaves a neon download icon at the **top right**; click it anytime to apply the staged update.
5. Restart / badge apply shows an **Applying update…** modal with an indeterminate loading bar, then runs a **silent** one-click NSIS install (`quitAndInstall(true, true)` → `/S --updated`).
6. The app relaunches on the new version.
7. **User Settings → Help & Support → Check for updates** runs the same check on demand.

Files: `electron/main.js`, `frontend/src/components/UpdateButton.tsx`, `frontend/src/hooks/useDesktopUpdate.ts`, `frontend/src/components/settings/DesktopUpdatesPanel.tsx`.

Notes:

- Download progress is real; the applying bar is indeterminate because NSIS install progress is not exposed to the renderer.
- Packaged Windows builds use `nsis.oneClick: true`. In-app updates never ask “who should this application be installed for?”.
- Only one desktop session is allowed (`requestSingleInstanceLock`); a second launch focuses the existing window.

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
