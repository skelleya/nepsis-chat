# Nepsis Chat 0.2.2

Hotfix — restore remote voice audio and fix stuck user menus.

## Highlights

- **Voice audio restored** — Dropped the Web Audio `MediaElementSource` path that silenced peers. Playback is plain HTML `<audio>` again (per-user volume still lowers users; values above 100% cap at full).
- **User menus dismiss cleanly** — Right-click opens volume/admin (or channel-list) menus; a full-screen backdrop closes them on click-away without reopening on the next card.
- Left-click on voice cards again watches / maximizes instead of opening the menu.

## Notes

- Includes 0.2.1 email confirmation banner.
