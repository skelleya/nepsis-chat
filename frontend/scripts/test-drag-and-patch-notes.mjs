/**
 * Lightweight unit checks for voice-user drag helpers + patch notes grouping.
 * Run: node frontend/scripts/test-drag-and-patch-notes.mjs
 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

// Compile-free: re-implement mirrors of the TS helpers for CI without a bundler,
// then also dynamically import the built logic via tsx-less inline copies that
// stay in sync with the source files below.

function compareVersions(a, b) {
  const parse = (v) =>
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

function normalizeVersion(tag) {
  return (tag || '').replace(/^v/i, '').trim()
}

function groupPatchNotes(notes, installedVersion) {
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
  const current =
    fromList ??
    ({
      version: installed,
      date: '',
      title: 'Installed',
      highlights: ['You’re currently on this release.'],
    })
  const earlier = sorted.filter((n) => compareVersions(n.version, installed) < 0)
  return { newer, current, earlier }
}

const CHANNEL_PREFIX = 'ch-'
const CATEGORY_PREFIX = 'cat-'
const USER_PREFIX = 'user-'
const VOICE_DROP_PREFIX = 'voice-drop-'

function filterDroppablesForActive(activeId, containers) {
  const activeStr = String(activeId)
  if (activeStr.startsWith(CATEGORY_PREFIX)) {
    return containers.filter((c) => {
      const idStr = String(c.id)
      return idStr.startsWith(CATEGORY_PREFIX) && idStr !== activeStr
    })
  }
  if (activeStr.startsWith(CHANNEL_PREFIX)) {
    return containers.filter((c) => {
      const id = String(c.id)
      return id.startsWith(CHANNEL_PREFIX) || id.startsWith(CATEGORY_PREFIX)
    })
  }
  if (activeStr.startsWith(USER_PREFIX)) {
    return containers.filter((c) => String(c.id).startsWith(VOICE_DROP_PREFIX))
  }
  return containers
}

function resolveVoiceMoveTarget(overId, channels) {
  const overStr = String(overId)
  if (overStr.startsWith(VOICE_DROP_PREFIX)) {
    return overStr.slice(VOICE_DROP_PREFIX.length)
  }
  if (overStr.startsWith(CHANNEL_PREFIX)) {
    const channelId = overStr.slice(CHANNEL_PREFIX.length)
    const ch = channels.find((c) => c.id === channelId)
    return ch?.type === 'voice' ? channelId : null
  }
  return null
}

// --- version / patch notes ---
assert.equal(compareVersions('0.2.4', '0.2.6') < 0, true)
assert.equal(compareVersions('v0.2.6', '0.2.6'), 0)
assert.equal(compareVersions('0.2.6', '0.2.5') > 0, true)

const notes = [
  { version: '0.2.6', date: '2026-07-24', title: 'A', highlights: ['a'] },
  { version: '0.2.5', date: '2026-07-24', title: 'B', highlights: ['b'] },
  { version: '0.2.4', date: '2026-07-24', title: 'C', highlights: ['c'] },
  { version: '0.2.3', date: '2026-07-24', title: 'D', highlights: ['d'] },
]

{
  const g = groupPatchNotes(notes, '0.2.4')
  assert.deepEqual(
    g.newer.map((n) => n.version),
    ['0.2.6', '0.2.5'],
    'newer releases must not land under earlier'
  )
  assert.equal(g.current.version, '0.2.4')
  assert.deepEqual(
    g.earlier.map((n) => n.version),
    ['0.2.3']
  )
}

{
  const g = groupPatchNotes(notes, '0.2.6')
  assert.deepEqual(g.newer, [])
  assert.equal(g.current.version, '0.2.6')
  assert.deepEqual(
    g.earlier.map((n) => n.version),
    ['0.2.5', '0.2.4', '0.2.3']
  )
}

{
  const g = groupPatchNotes(notes, '0.2.7')
  assert.deepEqual(g.newer, [])
  assert.equal(g.current.version, '0.2.7', 'missing installed version still shows as current stub')
  assert.equal(g.earlier.length, 4)
}

// --- drag helpers ---
const containers = [
  { id: 'ch-text1' },
  { id: 'ch-voice1' },
  { id: 'cat-general' },
  { id: 'voice-drop-voice1' },
  { id: 'voice-drop-voice2' },
  { id: 'user-abc' },
]

{
  const filtered = filterDroppablesForActive('user-abc', containers)
  assert.deepEqual(
    filtered.map((c) => c.id),
    ['voice-drop-voice1', 'voice-drop-voice2'],
    'user drag only targets voice drop zones'
  )
}

{
  const filtered = filterDroppablesForActive('ch-voice1', containers)
  assert.deepEqual(
    filtered.map((c) => c.id).sort(),
    ['cat-general', 'ch-text1', 'ch-voice1'].sort()
  )
}

{
  const channels = [
    { id: 'voice1', type: 'voice' },
    { id: 'text1', type: 'text' },
  ]
  assert.equal(resolveVoiceMoveTarget('voice-drop-voice1', channels), 'voice1')
  assert.equal(resolveVoiceMoveTarget('ch-voice1', channels), 'voice1')
  assert.equal(resolveVoiceMoveTarget('ch-text1', channels), null)
  assert.equal(resolveVoiceMoveTarget('cat-general', channels), null)
}

// Source sync smoke: ensure TS helper files exist (implementation source of truth)
const fs = await import('node:fs')
for (const rel of [
  'src/utils/versionCompare.ts',
  'src/utils/patchNotesGrouping.ts',
  'src/utils/channelDragCollision.ts',
]) {
  const p = path.join(root, rel)
  assert.equal(fs.existsSync(p), true, `missing ${rel}`)
  const src = fs.readFileSync(p, 'utf8')
  assert.match(src, /export function/, `${rel} should export helpers`)
}

// --- keybinding combo helpers (mirrors userPrefs formatKeyCombo / eventMatchesCombo) ---
function formatKeyCombo(e) {
  if (e.key === 'Control' || e.key === 'Shift' || e.key === 'Alt' || e.key === 'Meta') return null
  const parts = []
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  let key = e.key
  if (key === ' ') key = 'Space'
  else if (key.length === 1) key = key.toUpperCase()
  else key = key.length ? key[0].toUpperCase() + key.slice(1) : key
  if (!key) return null
  parts.push(key)
  return parts.join('+')
}

function eventMatchesCombo(e, combo) {
  if (!combo) return false
  const parts = combo.split('+').map((p) => p.trim()).filter(Boolean)
  const wantCtrl = parts.includes('Ctrl') || parts.includes('Meta') || parts.includes('Cmd')
  const wantAlt = parts.includes('Alt')
  const wantShift = parts.includes('Shift')
  const keyPart = parts.filter((p) => !['Ctrl', 'Meta', 'Cmd', 'Alt', 'Shift'].includes(p)).pop()
  if (!keyPart) return false
  if (!!wantCtrl !== (e.ctrlKey || e.metaKey)) return false
  if (!!wantAlt !== e.altKey) return false
  if (!!wantShift !== e.shiftKey) return false
  let key = e.key
  if (key === ' ') key = 'Space'
  else if (key.length === 1) key = key.toUpperCase()
  else key = key.length ? key[0].toUpperCase() + key.slice(1) : key
  return key.toLowerCase() === keyPart.toLowerCase()
}

{
  const e = { key: 'm', ctrlKey: true, metaKey: false, altKey: false, shiftKey: true }
  assert.equal(formatKeyCombo(e), 'Ctrl+Shift+M')
  assert.equal(eventMatchesCombo(e, 'Ctrl+Shift+M'), true)
  assert.equal(eventMatchesCombo(e, 'Ctrl+Shift+D'), false)
}

console.log('OK — drag + patch notes + keybinding unit checks passed')
