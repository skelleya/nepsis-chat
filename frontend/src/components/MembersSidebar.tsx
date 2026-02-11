import type { User } from '../types'

interface MembersSidebarProps {
  users: User[]
  title?: string
}

export function MembersSidebar({ users, title = 'Online' }: MembersSidebarProps) {
  return (
    <div className="w-60 bg-app-channel flex flex-col">
      <div className="h-12 px-4 flex items-center border-b border-app-dark text-app-text font-semibold">
        {title}
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {users.map((user) => (
          <div
            key={user.id}
            className="px-4 py-2 flex items-center gap-3 hover:bg-app-hover cursor-pointer"
          >
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-app-accent flex items-center justify-center text-white font-bold text-sm">
                {user.username.charAt(0)}
              </div>
              <div
                className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-app-channel ${
                  user.status === 'online' ? 'bg-app-online' : user.status === 'in-voice' ? 'bg-yellow-500' : 'bg-app-offline'
                }`}
              />
            </div>
            <span className="text-sm text-app-text truncate">{user.username}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
