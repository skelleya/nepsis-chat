/** Compare semver-ish strings like `0.2.6` / `v0.2.6`. Negative if a < b. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) =>
    v
      .replace(/^v/i, '')
      .split(/[.+-]/)
      .filter(Boolean)
      .map((part) => {
        const n = Number(part)
        return Number.isFinite(n) ? n : 0
      })
  const pa = parse(a)
  const pb = parse(b)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

export function normalizeVersion(tag: string | undefined | null): string {
  return (tag || '').replace(/^v/i, '').trim()
}
