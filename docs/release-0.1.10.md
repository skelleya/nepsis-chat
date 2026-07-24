# Nepsis Chat 0.1.10

Desktop release — voice user volume controls, larger gallery cameras, Discord-style manual updates.

## Highlights

- **Per-user volume** — Click or right-click another user’s voice card for a **User volume** slider (0–200%, default 100%). Uses Web Audio gain so boost can exceed 100%.
- **Stream volume** — When they are screen sharing, a separate **Stream volume** slider controls their share audio while you watch.
- **Admin options** — Owners/admins still get Mute / Deafen / Disconnect in the same card menu.
- **Larger gallery cards** — Gallery mode grid minimums raised (~320 / 260 / 200px) with taller camera tiles.
- **Manual updates** — Updates are **not** auto-downloaded. A green arrow appears when a newer release is available; click it to download, then an “Updating your software” modal runs through restart/install.

## Notes

- Includes prior 0.1.9 voice rejoin / camera restore.
- Per-user and stream volumes persist in `localStorage` (`nepsis_user_prefs` → `peerVolumes` / `streamVolumes`).
