import { useEffect, useMemo, useState } from 'react'
import { PATCH_NOTES, type PatchNote } from '../../data/patchNotes'

type GithubRelease = {
  tag_name?: string
  name?: string
  body?: string
  published_at?: string
  html_url?: string
}

const GITHUB_RELEASES_API = 'https://api.github.com/repos/skelleya/nepsis-chat/releases?per_page=8'

function normalizeVersion(tag: string | undefined): string {
  return (tag || '').replace(/^v/i, '')
}

function NoteCard({
  note,
  accent,
}: {
  note: PatchNote
  accent?: boolean
}) {
  return (
    <article
      className={`rounded-lg border px-3 py-3 ${
        accent
          ? 'border-app-accent/40 bg-app-accent/10'
          : 'border-app-glass/10 bg-app-darker/60'
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h5 className="font-semibold text-app-text">
          v{note.version}
          {note.title ? <span className="text-app-muted font-normal"> — {note.title}</span> : null}
        </h5>
        <span className="text-[11px] text-app-muted">{note.date}</span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {note.highlights.map((item) => (
          <li key={item} className="text-sm text-app-muted pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-app-accent">
            {item}
          </li>
        ))}
      </ul>
    </article>
  )
}

/** Help & Support → Patch notes (bundled history + latest GitHub releases). */
export function PatchNotesPanel() {
  const [installedVersion, setInstalledVersion] = useState<string | null>(null)
  const [remoteNotes, setRemoteNotes] = useState<PatchNote[]>([])
  const [expanded, setExpanded] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    const api = window.electronAPI
    if (api?.isElectron) {
      void api.getVersion().then((v) => setInstalledVersion(v || null))
    } else {
      setInstalledVersion(PATCH_NOTES[0]?.version ?? null)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 8000)
    fetch(GITHUB_RELEASES_API, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: GithubRelease[] | null) => {
        window.clearTimeout(timeout)
        if (!Array.isArray(data)) return
        const mapped: PatchNote[] = data
          .map((release) => {
            const version = normalizeVersion(release.tag_name)
            if (!version) return null
            const bodyLines = String(release.body || '')
              .split('\n')
              .map((line) => line.replace(/^[-*#\s]+/, '').trim())
              .filter(Boolean)
              .slice(0, 6)
            const bundled = PATCH_NOTES.find((n) => n.version === version)
            return {
              version,
              date: release.published_at
                ? new Date(release.published_at).toISOString().slice(0, 10)
                : bundled?.date || '',
              title: bundled?.title || (release.name || '').replace(/^Nepsis Chat\s*/i, '') || `Release ${version}`,
              highlights: bundled?.highlights?.length ? bundled.highlights : bodyLines.length ? bodyLines : ['See the full release on GitHub.'],
            } satisfies PatchNote
          })
          .filter((n): n is PatchNote => !!n)
        setRemoteNotes(mapped)
      })
      .catch(() => {
        window.clearTimeout(timeout)
        setLoadError('Could not refresh live release notes. Showing bundled notes.')
      })
    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [])

  const notes = useMemo(() => {
    const byVersion = new Map<string, PatchNote>()
    for (const note of [...remoteNotes, ...PATCH_NOTES]) {
      if (!byVersion.has(note.version)) byVersion.set(note.version, note)
    }
    return [...byVersion.values()].sort((a, b) =>
      b.version.localeCompare(a.version, undefined, { numeric: true })
    )
  }, [remoteNotes])

  const current = notes.find((n) => n.version === installedVersion) || notes[0]
  const older = notes.filter((n) => n.version !== current?.version)

  return (
    <div className="bg-app-channel rounded-lg p-4 space-y-3 mb-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-app-text">Patch notes</h4>
          <p className="text-xs text-app-muted mt-0.5">
            What’s new in Nepsis Chat{installedVersion ? ` (you’re on v${installedVersion})` : ''}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-app-muted hover:bg-app-hover hover:text-app-text"
        >
          {expanded ? 'Hide' : 'Show'}
        </button>
      </div>

      {expanded && (
        <div className="space-y-3">
          {loadError && <p className="text-xs text-app-muted">{loadError}</p>}
          {current && <NoteCard note={current} accent />}
          {older.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-app-muted">
                Earlier releases
              </p>
              {older.slice(0, 5).map((note) => (
                <NoteCard key={note.version} note={note} />
              ))}
            </div>
          )}
          <a
            href="https://github.com/skelleya/nepsis-chat/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs font-medium text-[#00a8fc] hover:underline"
          >
            View all releases on GitHub
          </a>
        </div>
      )}
    </div>
  )
}
