# Nepsis Chat 0.1.4

## Highlights

- Group direct messages with friend selection and Add People controls
- Same-account multi-tab voice presence without replacing the active microphone tab
- Camera orientation, 1080p+ quality, modern gallery, screen stage, and optional screen audio
- Soundboard clipping, broader MP3/audio compatibility, and single-instance playback
- Accurate local WebRTC RTT for both voice-channel participants and DM calls
- Searchable Tenor GIF picker for server channels and DMs, with secure Supabase import
- Modernized minimal chat, member rail, settings, icons, profiles, and server media

## Configuration

GIF search requires `TENOR_API_KEY` on the backend. GIF files can still be uploaded directly without it.

## Notes

- Ping is each party's locally measured round-trip path; values may differ due to asymmetric routing.
- Voice channels display the slowest active peer RTT in mesh calls. When alone, the value is explicitly labeled signaling-server RTT.
- Group calls remain 1:1-only in this release.
