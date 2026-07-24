import { useEffect, useMemo, useState } from 'react'
import { PATCH_NOTES, type PatchNote } from '../../data/patchNotes'
import { groupPatchNotes } from '../../utils/patchNotesGrouping'
import { normalizeVersion } from '../../utils/versionCompare'

type GithubRelease = {
  tag_name?: string
  name?: string
  body?: string
  published_at?: string
  html_url?: string
}

const GITHUB_RELEASES_API = 'https://api.github.com/repos/skelleya/nepsis-chat/releases?per_page=12'

function NoteCard({
  note,
  accent,
  badge,
}: {
  note: PatchNote
  accent?: boolean
  badge?: string
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
          {badge ? (
            <span className="ml-2 align-middle rounded-md bg-app-accent/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-app-accent">
              {badge}
            </span>
          ) : null}
        </h5>
        {note.date ? <span className="text-[11px] text-app-muted">{note.date}</span> : null}
      </div>
      <ul className="mt-2 space-y-1.5">
        {note.highlights.map((item) => (
          <li
            key={item}
            className="relative pl-3 text-sm text-app-muted before:absolute before:left-0 before:text-app-accent before:content-['•']"
          >
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
      void api.getVersion().then((v) => setInstalledVersion(normalizeVersion(v) || null))
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
              title:
                bundled?.title ||
                (release.name || '').replace(/^Nepsis Chat\s*/i, '') ||
                `Release ${version}`,
              highlights: bundled?.highlights?.length
                ? bundled.highlights
                : bodyLines.length
                  ? bodyLines
                  : ['See the full release on GitHub.'],
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
    // Bundled first so local highlights win, then fill gaps from GitHub.
    for (const note of [...PATCH_NOTES, ...remoteNotes]) {
      if (!byVersion.has(note.version)) byVersion.set(note.version, note)
    }
    return [...byVersion.values()]
  }, [remoteNotes])

  const { newer, current, earlier } = useMemo(
    () => groupPatchNotes(notes, installedVersion),
    [notes, installedVersion]
  )

  return (
    <div className="mb-4 space-y-3 rounded-lg bg-app-channel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-app-text">Patch notes</h4>
          <p className="mt-0.5 text-xs text-app-muted">
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

          {newer.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-app-muted">
                Newer releases
              </p>
              {newer.map((note) => (
                <NoteCard key={note.version} note={note} badge="Available" />
              ))}
            </div>
          )}

          {current && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-app-muted">
                Current / installed
              </p>
              <NoteCard note={current} accent badge="Installed" />
            </div>
          )}

          {earlier.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-app-muted">
                Earlier releases
              </p>
              {earlier.slice(0, 5).map((note) => (
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
