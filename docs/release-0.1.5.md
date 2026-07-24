# Nepsis Chat 0.1.5

## Highlights

- Complete appearance-theme coverage across the app shell, settings, profiles, emoji picker, and update UI
- Persistent collapsible channel rail with responsive voice camera and screen-share layouts
- Improved channel/category drag-and-drop, cross-category moves, and admin management controls
- Stable member profile popouts and reliable right-sidebar member hover/click interaction
- Voice ping tooltips now identify direct STUN/LAN paths versus TURN relay paths
- Clear Windows/macOS guidance when the operating system blocks microphone or camera access
- Electron explicitly handles media permission requests for voice, video, and screen sharing

## Voice and ping

- Voice and DM media remain WebRTC mesh P2P; the backend is signaling-only.
- A direct `host` or `srflx` path generally provides the best ping.
- A `relay` path means TURN is carrying media. TURN improves strict-NAT connectivity but normally adds latency.
- The voice-channel ping remains the slowest active peer path so a poor mesh connection is visible.

## Permission troubleshooting

“Permission denied by system” means the operating system blocked that client’s microphone or camera; it is not a Nepsis server-membership error.

- Windows: Settings → Privacy & security → Microphone/Camera → allow desktop apps and Nepsis Chat.
- macOS: System Settings → Privacy & Security → Microphone/Camera → enable Nepsis Chat.

## Notes

- Existing 0.1.4 installations receive this version through the in-app updater after the desktop release workflow publishes Windows and macOS assets.
- Group calls remain 1:1-only.
