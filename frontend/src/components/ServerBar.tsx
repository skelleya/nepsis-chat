import { useState, useRef, useEffect, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Server } from '../types'
import { CreateServerModal } from './CreateServerModal'

interface ServerBarProps {
  servers: Server[]
  currentServerId: string | null
  onSelectServer: (serverId: string) => void
  onCreateServer: (name: string) => Promise<void>
  onReorderServers?: (updates: { serverId: string; order: number }[]) => Promise<void>
  canCreateServer?: boolean
  onOpenCommunity?: () => void
  onOpenFriends?: () => void
  isFriendsActive?: boolean
}

const SERVER_PREFIX = 'server-'

function SortableServerIcon({ server, isActive, onClick }: { server: Server; isActive: boolean; onClick: () => void }) {
  const [showTooltip, setShowTooltip] = useState(false)
  const timeoutRef = useRef<number | null>(null)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `${SERVER_PREFIX}${server.id}`,
  })
  const style = { transform: CSS.Transform.toString(transform), transition }

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
    <div ref={setNodeRef} style={style} className={`relative group ${isDragging ? 'opacity-50' : ''}`} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {/* Active indicator pill */}
      <div className={`absolute -left-3 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-white transition-all ${
        isActive ? 'h-10' : 'h-0 group-hover:h-5'
      }`} />

      <button
        {...attributes}
        {...listeners}
        onClick={onClick}
        className={`w-12 h-12 flex items-center justify-center text-white font-bold text-lg transition-all duration-200 cursor-grab active:cursor-grabbing touch-none ${
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

export function ServerBar({ servers, currentServerId, onSelectServer, onCreateServer, onReorderServers, canCreateServer = true, onOpenCommunity, onOpenFriends, isFriendsActive = false }: ServerBarProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id || !onReorderServers) return
      const activeStr = String(active.id)
      const overStr = String(over.id)
      if (!activeStr.startsWith(SERVER_PREFIX) || !overStr.startsWith(SERVER_PREFIX)) return
      const oldIndex = servers.findIndex((s) => `${SERVER_PREFIX}${s.id}` === activeStr)
      const newIndex = servers.findIndex((s) => `${SERVER_PREFIX}${s.id}` === overStr)
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(servers, oldIndex, newIndex)
        onReorderServers(reordered.map((s, i) => ({ serverId: s.id, order: i })))
      }
    },
    [servers, onReorderServers]
  )

  const serverList = (
    <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col items-center gap-2 w-full px-3 min-w-0">
      {onReorderServers ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={servers.map((s) => `${SERVER_PREFIX}${s.id}`)} strategy={verticalListSortingStrategy}>
            {servers.map((server) => (
              <SortableServerIcon
                key={server.id}
                server={server}
                isActive={!isFriendsActive && currentServerId === server.id}
                onClick={() => onSelectServer(server.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
      ) : (
        servers.map((server) => (
          <SortableServerIcon
            key={server.id}
            server={server}
            isActive={!isFriendsActive && currentServerId === server.id}
            onClick={() => onSelectServer(server.id)}
          />
        ))
      )}
    </div>
  )

  return (
    <>
      <div className="w-[72px] min-w-[72px] bg-app-dark flex flex-col items-center py-3 gap-2 flex-shrink-0 overflow-x-hidden">
        {/* Home / Friends button */}
        <div className="relative group">
          <div className={`absolute -left-3 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-white transition-all ${
            isFriendsActive ? 'h-10' : 'h-0 group-hover:h-5'
          }`} />
          <button
            onClick={() => onOpenFriends?.()}
            className={`w-12 h-12 flex items-center justify-center cursor-pointer transition-all duration-200 ${
              isFriendsActive
                ? 'bg-app-accent rounded-[16px]'
                : 'rounded-[24px] hover:rounded-[16px] bg-app-channel hover:bg-app-accent'
            }`}
            title="Friends"
          >
            <img src="./logo.png" alt="Nepsis" className="w-7 h-7 object-contain" />
          </button>
        </div>

        {/* Separator */}
        <div className="w-8 h-0.5 bg-app-channel rounded-full mx-auto" />

        {/* Server list */}
        {serverList}

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
