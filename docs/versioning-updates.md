# Versioning & Updates

Versioning and auto-updates.

---

## Version

- **Format:** 0.1.0 (semver)
- **Start:** 0.1.0
- **Auto bump:** Patch 0–9; when patch would hit 10, bump minor and reset patch: 0.1.9 → 0.2.0

---

## Bump Script

`electron/scripts/bump-version.js`:

- Reads version from `electron/package.json`
- Increments patch (3rd number)
- When patch reaches 10: patch = 0, minor += 1 (e.g. 0.1.9 → 0.2.0)
- Writes back

---

## Release Flow

`npm run package:full`:

1. Build frontend
2. Build installer
3. Publish to `backend/updates/`
4. Copy to `frontend/public/`
5. Bump version for next release

---

## Auto-Updates

- **electron-updater** checks `UPDATE_URL` on startup
- Backend serves `/updates/latest.yml` and installer
- When a new version exists: green "Update Available" button
- User clicks → app restarts and installs

---

## Update Files

| File | Purpose |
|------|---------|
| latest.yml | Version info, file URL, checksum |
| Nepsis Chat Setup X.X.X.exe | Installer |

**Location:** `backend/updates/` (served at `/updates/`)
