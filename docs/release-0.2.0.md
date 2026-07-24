# Nepsis Chat 0.2.0

Desktop + web release — link embed previews and in-app patch notes.

## Highlights

- **Link embeds** — Pasting or sending an `http(s)` link in server chat or DMs shows a Discord-style preview card (site, title, description, image) via backend Open Graph unfurl (`POST /api/embeds/unfurl`).
- **Clickable links** — URLs in message text are clickable; image/video/file URLs still use the existing attachment UI.
- **Patch notes** — Settings → Help & Support shows **Patch notes** for the installed version plus earlier releases (bundled + GitHub Releases).

## Notes

- Unfurl blocks private/local hosts (SSRF-safe), rate-limits, and caches previews in memory.
- Desktop package version: `0.2.0`.
