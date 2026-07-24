import type { PatchNote } from '../data/patchNotes'
import { compareVersions, normalizeVersion } from './versionCompare'

export type GroupedPatchNotes = {
  newer: PatchNote[]
  current: PatchNote | null
  earlier: PatchNote[]
}

/**
 * Split notes relative to the installed version:
 * - newer  → versions above installed (future / available updates)
 * - current → exact installed release (or a stub if missing from the list)
 * - earlier → only versions below installed
 */
export function groupPatchNotes(
  notes: PatchNote[],
  installedVersion: string | null | undefined
): GroupedPatchNotes {
  const installed = normalizeVersion(installedVersion)
  const sorted = [...notes].sort((a, b) => compareVersions(b.version, a.version))

  if (!installed) {
    const current = sorted[0] ?? null
    return {
      newer: [],
      current,
      earlier: current ? sorted.filter((n) => n.version !== current.version) : [],
    }
  }

  const newer = sorted.filter((n) => compareVersions(n.version, installed) > 0)
  const fromList = sorted.find((n) => normalizeVersion(n.version) === installed) ?? null
  const current: PatchNote =
    fromList ??
    ({
      version: installed,
      date: '',
      title: 'Installed',
      highlights: ['You’re currently on this release.'],
    } satisfies PatchNote)
  const earlier = sorted.filter((n) => compareVersions(n.version, installed) < 0)

  return { newer, current, earlier }
}
