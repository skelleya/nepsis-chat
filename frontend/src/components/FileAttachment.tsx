/**
 * Shared display for chat/DM attachments with an explicit Download control.
 */

import { useState, type MouseEvent } from 'react'

function filenameFromUrl(url: string): string {
  try {
    const path = decodeURIComponent(new URL(url).pathname)
    const name = path.split('/').pop() || 'download'
    return name.includes('.') ? name : 'download'
  } catch {
    return 'download'
  }
}

export function isImageUrl(url: string): boolean {
  return /\.(gif|jpe?g|png|webp|svg)(\?|$)/i.test(url) || /supabase.*storage.*\.(gif|jpe?g|png|webp)/i.test(url)
}

export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|avi|m4v)(\?|$)/i.test(url)
}

/** Non-image/video URL that looks like a downloadable file (or storage object). */
export function isFileUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false
  if (isImageUrl(url) || isVideoUrl(url)) return false
  if (/supabase.*\/storage\//i.test(url)) return true
  return /\.[a-z0-9]{2,8}(\?|$)/i.test(url)
}

async function downloadUrl(url: string, filename: string) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error('fetch failed')
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(objectUrl)
  } catch {
    // Cross-origin / CORS fallback — open in new tab
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noreferrer'
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
  }
}

function DownloadButton({
  url,
  filename,
  compact = false,
}: {
  url: string
  filename: string
  compact?: boolean
}) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async (e) => {
        e.preventDefault()
        e.stopPropagation()
        setBusy(true)
        try {
          await downloadUrl(url, filename)
        } finally {
          setBusy(false)
        }
      }}
      className={
        compact
          ? 'inline-flex items-center gap-1 px-2 py-1 rounded bg-app-accent hover:bg-app-accent-hover text-white text-xs font-medium disabled:opacity-50'
          : 'absolute top-2 right-2 z-10 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-black/70 hover:bg-black/90 text-white text-xs font-medium opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity disabled:opacity-50'
      }
      title="Download"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
      </svg>
      {busy ? '…' : 'Download'}
    </button>
  )
}

interface FileAttachmentProps {
  url: string
  type?: string
  filename?: string
  /** Stop parent click handlers (e.g. DM reply-select) */
  stopPropagation?: boolean
}

export function FileAttachment({ url, type, filename, stopPropagation }: FileAttachmentProps) {
  const name = filename || filenameFromUrl(url)
  const kind =
    type === 'image' || (!type && isImageUrl(url))
      ? 'image'
      : type === 'video' || (!type && isVideoUrl(url))
        ? 'video'
        : 'file'

  const wrapProps = stopPropagation
    ? { onClick: (e: MouseEvent) => e.stopPropagation() }
    : {}

  if (kind === 'image') {
    return (
      <div className="relative group inline-block mt-1 max-w-[300px]" {...wrapProps}>
        <a href={url} target="_blank" rel="noreferrer" className="block">
          <img src={url} alt={name} className="max-w-[300px] max-h-[220px] rounded object-contain" />
        </a>
        <DownloadButton url={url} filename={name} />
      </div>
    )
  }

  if (kind === 'video') {
    return (
      <div className="relative group inline-block mt-1 max-w-[300px]" {...wrapProps}>
        <video src={url} controls className="max-w-[300px] max-h-[200px] rounded" preload="metadata" />
        <DownloadButton url={url} filename={name} />
      </div>
    )
  }

  return (
    <div
      className="mt-1 inline-flex items-center gap-2 max-w-full px-3 py-2 rounded-lg bg-app-channel border border-app-darker"
      {...wrapProps}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-app-muted shrink-0">
        <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
      </svg>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-sm text-[#00a8fc] hover:underline truncate min-w-0"
        title={name}
      >
        {name}
      </a>
      <DownloadButton url={url} filename={name} compact />
    </div>
  )
}
