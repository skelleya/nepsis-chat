# Versioning & Auto-Updates

Desktop updates use **electron-updater** with **GitHub Releases** as the feed (Windows + macOS).

---

## How users get updates

1. App launches (and every 30 minutes) → checks GitHub Releases for a newer version.
2. If a **newer** release is found (`isUpdateAvailable` and feed version &gt; installed) → a **Nepsis update badge** appears at the **top center** of the window (logo + “Update available”). Already-on-latest does **not** show the badge after restart.
3. User clicks → download starts; badge shows **progress %**.
4. When ready → badge becomes **Restart to update** → `quitAndInstall`.

Files: `electron/main.js`, `frontend/src/components/UpdateButton.tsx`, `frontend/src/hooks/useDesktopUpdate.ts`.

---

## Publishing a release

**Preferred (CI):** bump `electron/package.json` version → push → GitHub Actions → **Desktop Release** → Run workflow. That builds Windows + macOS and publishes one release (`v{version}`) with both installers + `latest.yml` / `latest-mac.yml`.

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
