export type PatchNote = {
  version: string
  date: string
  title: string
  highlights: string[]
}

/** In-app patch notes shown under User Settings → Help & Support. */
export const PATCH_NOTES: PatchNote[] = [
  {
    version: '0.2.4',
    date: '2026-07-24',
    title: 'Floating voice cameras in chat',
    highlights: [
      'While in voice and browsing text or DMs, see live cameras in a corner panel.',
      'Drag the panel to any corner; click Open to return to the voice channel.',
      'Speaking users get a green highlight on their camera tile.',
    ],
  },
  {
    version: '0.2.3',
    date: '2026-07-24',
    title: 'YouTube video embeds',
    highlights: [
      'YouTube links in server chat and DMs show a playable video embed.',
      'Click the thumbnail to play in place (youtube.com, youtu.be, Shorts).',
    ],
  },
  {
    version: '0.2.2',
    date: '2026-07-24',
    title: 'Voice audio restored & menus fixed',
    highlights: [
      'You can hear other users in voice again (HTML audio playback restored).',
      'Right-click user menus close when you click away; left-click watches/maximizes again.',
      'Per-user volume still lowers peers (above 100% is capped at full device volume).',
    ],
  },
  {
    version: '0.2.1',
    date: '2026-07-24',
    title: 'Voice audio fix, menu dismiss, email banner',
    highlights: [
      'Fixed not being able to hear other users after per-user volume controls.',
      'Voice card menus close when you click away or press Escape.',
      'Unconfirmed accounts see a Confirm your email banner with Resend.',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-07-24',
    title: 'Link embeds & patch notes',
    highlights: [
      'Links in server chat and DMs show an embedded preview card (title, description, image).',
      'URLs in messages are clickable.',
      'Patch notes are available in Settings → Help & Support.',
    ],
  },
  {
    version: '0.1.10',
    date: '2026-07-24',
    title: 'Voice volume, gallery & manual updates',
    highlights: [
      'Per-user and stream volume controls on voice cards (0–200%).',
      'Larger camera cards in gallery mode.',
      'Desktop updates show a green arrow until you choose to download and install.',
    ],
  },
  {
    version: '0.1.9',
    date: '2026-07-24',
    title: 'Voice rejoin & camera restore',
    highlights: [
      'Refreshing the app restores your voice channel UI and camera state.',
      'Voice layout and filmstrip polish.',
    ],
  },
  {
    version: '0.1.8',
    date: '2026-07-24',
    title: 'Single instance & silent updates',
    highlights: [
      'Only one desktop session at a time.',
      'Silent update install with in-app progress.',
      'Check for updates in Settings → Help & Support.',
    ],
  },
]

export function getPatchNote(version: string | null | undefined): PatchNote | undefined {
  if (!version) return undefined
  const normalized = version.replace(/^v/i, '')
  return PATCH_NOTES.find((note) => note.version === normalized)
}
