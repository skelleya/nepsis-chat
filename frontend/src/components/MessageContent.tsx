import { FileAttachment } from './FileAttachment'
import { LinkEmbedList } from './LinkEmbed'
import { extractEmbeddableUrls, parseMessageSegments } from '../utils/messageLinks'

type MessageContentProps = {
  content: string
  /** When set, @mentions are highlighted (server chat). */
  currentUsername?: string
  highlightMentions?: boolean
  className?: string
  /** Stop click bubbling (DM reply-select rows). */
  stopPropagation?: boolean
}

export function MessageContent({
  content,
  currentUsername = '',
  highlightMentions = false,
  className = '',
  stopPropagation = false,
}: MessageContentProps) {
  const segments = parseMessageSegments(content, highlightMentions)
  const embedUrls = extractEmbeddableUrls(content)

  if (!content) return null

  return (
    <div className={className}>
      <p className="text-app-text text-[15px] leading-[1.5] whitespace-pre-wrap break-words">
        {segments.length === 0
          ? content
          : segments.map((part, i) => {
              if (part.type === 'mention') {
                const mentionName = part.value.slice(1).toLowerCase()
                const isMe =
                  mentionName === currentUsername.toLowerCase() || mentionName === 'everyone'
                return (
                  <span
                    key={i}
                    className={`rounded px-1 py-0.5 font-medium ${
                      isMe ? 'bg-yellow-500/25 text-yellow-200' : 'bg-app-accent/20 text-app-accent'
                    }`}
                  >
                    {part.value}
                  </span>
                )
              }
              if (part.type === 'link') {
                return (
                  <a
                    key={i}
                    href={part.value}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#00a8fc] hover:underline break-all"
                    onClick={(e) => {
                      if (stopPropagation) e.stopPropagation()
                    }}
                  >
                    {part.value}
                  </a>
                )
              }
              if (part.type === 'image' || part.type === 'video' || part.type === 'file') {
                return (
                  <span key={i} className="my-1 block">
                    <FileAttachment
                      url={part.value}
                      type={part.type}
                      stopPropagation={stopPropagation}
                    />
                  </span>
                )
              }
              return <span key={i}>{part.value}</span>
            })}
      </p>
      {embedUrls.length > 0 && <LinkEmbedList urls={embedUrls} />}
    </div>
  )
}
