import { useEffect, useState } from 'react'
import * as api from '../services/api'

export type LinkEmbedData = {
  url: string
  title?: string
  description?: string
  image?: string
  siteName?: string
  favicon?: string
}

const memoryCache = new Map<string, LinkEmbedData | null>()

type LinkEmbedProps = {
  url: string
  className?: string
}

/** Discord-style link preview card (Open Graph via backend unfurl). */
export function LinkEmbed({ url, className = '' }: LinkEmbedProps) {
  const [data, setData] = useState<LinkEmbedData | null | undefined>(() =>
    memoryCache.has(url) ? memoryCache.get(url) : undefined
  )

  useEffect(() => {
    if (memoryCache.has(url)) {
      setData(memoryCache.get(url))
      return
    }
    let cancelled = false
    setData(undefined)
    api
      .unfurlLink(url)
      .then((embed) => {
        if (cancelled) return
        memoryCache.set(url, embed)
        setData(embed)
      })
      .catch(() => {
        if (cancelled) return
        memoryCache.set(url, null)
        setData(null)
      })
    return () => {
      cancelled = true
    }
  }, [url])

  if (data === null) return null
  if (data === undefined) {
    return (
      <div
        className={`mt-2 max-w-md rounded-lg border-l-4 border-app-accent/70 bg-app-channel/80 px-3 py-2 ${className}`}
        aria-hidden
      >
        <div className="h-3 w-40 animate-pulse rounded bg-app-hover/80" />
        <div className="mt-2 h-3 w-64 max-w-full animate-pulse rounded bg-app-hover/50" />
      </div>
    )
  }

  const title = data.title || data.siteName || data.url
  const host = (() => {
    try {
      return new URL(data.url).hostname.replace(/^www\./, '')
    } catch {
      return data.siteName || ''
    }
  })()

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`mt-2 flex max-w-md overflow-hidden rounded-lg border border-app-glass/10 bg-app-channel/80 hover:bg-app-channel transition-colors ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-1 shrink-0 bg-app-accent" />
      <div className="min-w-0 flex-1 p-3">
        <div className="flex items-center gap-1.5 text-[11px] text-app-muted">
          {data.favicon ? (
            <img
              src={data.favicon}
              alt=""
              className="h-3.5 w-3.5 rounded-sm object-contain"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => {
                ;(e.currentTarget as HTMLImageElement).style.display = 'none'
              }}
            />
          ) : null}
          <span className="truncate">{data.siteName || host}</span>
        </div>
        <div className="mt-1 text-sm font-semibold text-[#00a8fc] line-clamp-2">{title}</div>
        {data.description ? (
          <p className="mt-1 text-xs text-app-muted line-clamp-3 whitespace-pre-wrap break-words">
            {data.description}
          </p>
        ) : null}
      </div>
      {data.image ? (
        <div className="hidden sm:block w-28 shrink-0 bg-app-darker">
          <img
            src={data.image}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => {
              ;(e.currentTarget.parentElement as HTMLElement | null)?.remove()
            }}
          />
        </div>
      ) : null}
    </a>
  )
}

type LinkEmbedListProps = {
  urls: string[]
}

export function LinkEmbedList({ urls }: LinkEmbedListProps) {
  if (!urls.length) return null
  return (
    <div className="space-y-2">
      {urls.map((url) => (
        <LinkEmbed key={url} url={url} />
      ))}
    </div>
  )
}
