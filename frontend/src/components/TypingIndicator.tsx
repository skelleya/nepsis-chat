import { formatTypingLabel, type TypingUser } from '../hooks/useChatTyping'

export function TypingIndicator({ users }: { users: TypingUser[] }) {
  if (users.length === 0) return null
  return (
    <div className="px-1 pt-1.5 min-h-[1.25rem] flex items-center gap-2 text-xs text-app-muted">
      <span className="inline-flex items-center gap-0.5" aria-hidden>
        <span className="w-1 h-1 rounded-full bg-app-muted animate-bounce [animation-delay:0ms]" />
        <span className="w-1 h-1 rounded-full bg-app-muted animate-bounce [animation-delay:120ms]" />
        <span className="w-1 h-1 rounded-full bg-app-muted animate-bounce [animation-delay:240ms]" />
      </span>
      <span className="truncate">{formatTypingLabel(users)}</span>
    </div>
  )
}
