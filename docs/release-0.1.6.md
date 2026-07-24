# Nepsis Chat 0.1.6

## Highlights

- Silent desktop auto-updates: background download, restart-only prompt, applying-updates modal, no install-scope wizard on update
- Voice & Video dropdown flicker fixes (stable menus while the mic meter runs)
- Discord-style mic noise reduction presets: Off / Standard / High (when available)
- Server Mute/Unmute and Server Deafen/Undeafen moderation actions
- Fixed clipped camera speaking rings and minimized member status dots
- Profile bios visible in member/DM popouts
- Persistent voice audio while navigating Friends / Add Friend / DMs / settings

## Notes

- The applying-updates progress bar is indeterminate after restart is confirmed; download progress remains real.
- High mic processing uses browser `voiceIsolation` only on platforms that support it; otherwise it matches Standard.
- Existing 0.1.5 installs receive this version through the in-app updater after the Desktop Release workflow publishes Windows and macOS assets.
