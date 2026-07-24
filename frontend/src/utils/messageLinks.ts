import { isFileUrl, isImageUrl, isVideoUrl } from '../components/FileAttachment'

const URL_RE = /(https?:\/\/[^\s<>"'`]+)/gi

/** Strip common trailing punctuation that is usually not part of the URL. */
export function cleanUrl(raw: string): string {
  return raw.replace(/[)\],.!?;:'"]+$/g, '')
}

export function extractUrls(content: string): string[] {
  if (!content) return []
  const found: string[] = []
  const seen = new Set<string>()
  let match: RegExpExecArray | null
  const re = new RegExp(URL_RE.source, 'gi')
  while ((match = re.exec(content)) !== null) {
    const url = cleanUrl(match[1])
    if (!url || seen.has(url)) continue
    seen.add(url)
    found.push(url)
  }
  return found
}

/** Non-media http(s) links that should get an Open Graph-style embed card. */
export function extractEmbeddableUrls(content: string, limit = 3): string[] {
  return extractUrls(content)
    .filter((url) => !isImageUrl(url) && !isVideoUrl(url) && !isFileUrl(url))
    .slice(0, limit)
}

export type MessageSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; value: string }
  | { type: 'link'; value: string }
  | { type: 'image'; value: string }
  | { type: 'video'; value: string }
  | { type: 'file'; value: string }

export function parseMessageSegments(content: string, highlightMentions = false): MessageSegment[] {
  if (!content) return []
  const segments: MessageSegment[] = []
  const re = new RegExp(URL_RE.source, 'gi')
  let lastIndex = 0
  let match: RegExpExecArray | null

  const pushText = (text: string) => {
    if (!text) return
    if (!highlightMentions) {
      segments.push({ type: 'text', value: text })
      return
    }
    const parts = text.split(/(@\w+)/g)
    for (const part of parts) {
      if (!part) continue
      if (part.startsWith('@') && part.length > 1) {
        segments.push({ type: 'mention', value: part })
      } else {
        segments.push({ type: 'text', value: part })
      }
    }
  }

  while ((match = re.exec(content)) !== null) {
    if (match.index > lastIndex) {
      pushText(content.slice(lastIndex, match.index))
    }
    const url = cleanUrl(match[1])
    const trailing = match[1].slice(url.length)
    if (isImageUrl(url)) segments.push({ type: 'image', value: url })
    else if (isVideoUrl(url)) segments.push({ type: 'video', value: url })
    else if (isFileUrl(url)) segments.push({ type: 'file', value: url })
    else segments.push({ type: 'link', value: url })
    if (trailing) pushText(trailing)
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < content.length) pushText(content.slice(lastIndex))
  return segments
}
