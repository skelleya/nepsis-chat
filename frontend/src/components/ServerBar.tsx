import { useState, useRef, useEffect } from 'react'
import type { Server } from '../types'
import { CreateServerModal } from './CreateServerModal'

interface ServerBarProps {
  servers: Server[]
  currentServerId: string | null
  onSelectServer: (serverId: string) => void
  onCreateServer: (name: string) => Promise<void>
  canCreateServer?: boolean
  onOpenCommunity?: () => void
  onOpenFriends?: () => void
}

function ServerIcon({ server, isActive, onClick }: { server: Server; isActive: boolean; onClick: () => void }) {
  const [showTooltip, setShowTooltip] = useState(false)
  const timeoutRef = useRef<number | null>(null)

  const handleMouseEnter = () => {
    timeoutRef.current = window.setTimeout(() => setShowTooltip(true), 400)
  }

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setShowTooltip(false)
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return (
    <div className="relative group" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {/* Active indicator pill */}
      <div className={`absolute -left-3 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-white transition-all ${
        isActive ? 'h-10' : 'h-0 group-hover:h-5'
      }`} />

      <button
        onClick={onClick}
        className={`w-12 h-12 flex items-center justify-center text-white font-bold text-lg transition-all duration-200 ${
          isActive
            ? 'bg-app-accent rounded-[16px]'
            : 'bg-app-channel rounded-[24px] hover:bg-app-accent hover:rounded-[16px]'
        }`}
      >
        {server.iconUrl ? (
          <img src={server.iconUrl} alt={server.name} className="w-full h-full rounded-inherit object-cover" />
        ) : (
          server.name.split(' ').map(w => w[0]).join('').slice(0, 2)
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute left-[62px] top-1/2 -translate-y-1/2 z-50 pointer-events-none">
          <div className="relative bg-[#111214] text-white text-sm font-semibold px-3 py-2 rounded-md shadow-xl whitespace-nowrap">
            {server.name}
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-[#111214]" />
          </div>
        </div>
      )}
    </div>
  )
}

export function ServerBar({ servers, currentServerId, onSelectServer, onCreateServer, canCreateServer = true, onOpenCommunity, onOpenFriends }: ServerBarProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)

  return (
    <>
      <div className="w-[72px] min-w-[72px] bg-app-dark flex flex-col items-center py-3 gap-2 flex-shrink-0 overflow-x-hidden">
        {/* Home / Friends button */}
        <div className="relative group">
          <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-white transition-all h-0 group-hover:h-5" />
          <button
            onClick={() => onOpenFriends?.()}
            className="w-12 h-12 rounded-[24px] hover:rounded-[16px] bg-app-channel hover:bg-app-accent flex items-center justify-center cursor-pointer transition-all duration-200"
            title="Friends"
          >
            <img src="./logo.png" alt="Nepsis" className="w-7 h-7 object-contain" />
          </button>
        </div>

        {/* Separator */}
        <div className="w-8 h-0.5 bg-app-channel rounded-full mx-auto" />

        {/* Server list */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col items-center gap-2 w-full px-3 min-w-0">
          {servers.map((server) => (
            <ServerIcon
              key={server.id}
              server={server}
              isActive={currentServerId === server.id}
              onClick={() => onSelectServer(server.id)}
            />
          ))}
        </div>

        {/* Separator */}
        <div className="w-8 h-0.5 bg-app-channel rounded-full mx-auto" />

        {/* Add Server button (email users only) */}
        {canCreateServer && (
        <div className="relative group">
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-12 h-12 rounded-[24px] hover:rounded-[16px] bg-app-channel hover:bg-[#23a559] flex items-center justify-center cursor-pointer transition-all duration-200 group"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[#23a559] group-hover:text-white transition-colors">
              <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        )}

        {/* Discover / Community servers */}
        <div className="relative group">
          <button
            onClick={onOpenCommunity}
            className="w-12 h-12 rounded-[24px] hover:rounded-[16px] bg-app-channel hover:bg-[#23a559] flex items-center justify-center cursor-pointer transition-all duration-200 group"
            title="Community servers"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[#23a559] group-hover:text-white transition-colors">
              <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2"/>
              <path d="M16.24 7.76L14.12 14.12L7.76 16.24L9.88 9.88L16.24 7.76Z" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Create Server Modal */}
      {showCreateModal && (
        <CreateServerModal
          onClose={() => setShowCreateModal(false)}
          onCreate={async (name) => {
            await onCreateServer(name)
            setShowCreateModal(false)
          }}
        />
      )}
    </>
  )
}
