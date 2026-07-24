import { useState } from 'react'
import { getYouTubeEmbedSrc, getYouTubeVideoId } from '../utils/messageLinks'

type YouTubeEmbedProps = {
  url: string
  className?: string
}

/**
 * Discord-style YouTube embed: clickable poster → in-place iframe playback.
 */
export function YouTubeEmbed({ url, className = '' }: YouTubeEmbedProps) {
  const videoId = getYouTubeVideoId(url)
  const [playing, setPlaying] = useState(false)

  if (!videoId) return null

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`
  const poster = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`

  return (
    <div
      className={`mt-2 w-full max-w-lg overflow-hidden rounded-lg border border-app-glass/10 bg-black ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 border-b border-white/10 bg-app-channel/90 px-3 py-1.5">
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden className="text-[#ff0033] shrink-0">
          <path
            fill="currentColor"
            d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-5.8ZM9.8 15.5v-7l6.2 3.5-6.2 3.5Z"
          />
        </svg>
        <a
          href={watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-xs font-medium text-[#00a8fc] hover:underline"
        >
          YouTube
        </a>
      </div>

      <div className="relative aspect-video w-full bg-black">
        {playing ? (
          <iframe
            title="YouTube video"
            src={getYouTubeEmbedSrc(videoId, true)}
            className="absolute inset-0 h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            type="button"
            className="group absolute inset-0 flex items-center justify-center"
            onClick={() => setPlaying(true)}
            aria-label="Play YouTube video"
          >
            <img
              src={poster}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <span className="relative z-[1] flex h-14 w-14 items-center justify-center rounded-full bg-[#ff0033] text-white shadow-lg transition-transform group-hover:scale-105">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M8 5.5v13l11-6.5L8 5.5Z" />
              </svg>
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
