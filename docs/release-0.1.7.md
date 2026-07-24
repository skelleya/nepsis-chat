# Nepsis Chat 0.1.7

## Highlights

- Keep two-way voice audio while opening Friends (Nepsis logo), DMs, or text chats
- Fix clipped top/left camera tiles in the voice filmstrip
- Embed the Nepsis icon into the Windows exe and NSIS installer (desktop shortcut no longer shows Electron)

## Notes

- Camera/stage videos are muted; session playback is owned by `RemoteAudio` sinks portaled to `document.body`.
- Existing 0.1.6 installs receive this version through the in-app updater after the Desktop Release workflow publishes Windows and macOS assets.
- If a Windows desktop shortcut still shows the old Electron icon after updating, remove the shortcut and reinstall (or clear the Windows icon cache).
