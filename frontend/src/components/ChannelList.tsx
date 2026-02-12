import { useState, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  useDndContext,
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
import type { Channel, Category } from '../types'
import { CreateChannelModal } from './CreateChannelModal'
import { MicOffIcon, HeadphonesOffIcon } from './icons/VoiceIcons'

interface VoiceUserInfo {
  userId: string
  username: string
  avatar_url?: string
  isMuted?: boolean
  isDeafened?: boolean
  isSpeaking?: boolean
}

interface VoiceConnectionInfo {
  channelId: string
  channelName: string
  isMuted: boolean
  isDeafened: boolean
  isCameraOn: boolean
  isScreenSharing: boolean
  ping: number | null
  onToggleMute: () => void
  onToggleDeafen: () => void
  onToggleCamera: () => void
  onToggleScreenShare: () => void
  onDisconnect: () => void
}

interface ChannelListProps {
  channels: Channel[]
  categories: Category[]
  currentChannelId: string | null
  onSelectChannel: (channel: Channel) => void
  serverName?: string
  onCreateChannel: (name: string, type: 'text' | 'voice', categoryId?: string) => Promise<void>
  onCreateCategory: (name: string) => Promise<void>
  onReorderChannels?: (updates: { id: string; order: number }[]) => Promise<void>
  onUpdateChannel?: (channelId: string, data: { name?: string; order?: number; categoryId?: string | null }) => Promise<void>
  onUpdateCategory?: (catId: string, data: { name?: string; order?: number }) => Promise<void>
  onReorderCategories?: (updates: { id: string; order: number }[]) => Promise<void>
  onDeleteChannel?: (channelId: string) => Promise<void>
  onDeleteCategory?: (catId: string) => Promise<void>
  // Voice info
  voiceConnection: VoiceConnectionInfo | null
  voiceUsers: Record<string, VoiceUserInfo[]> // channelId -> users in voice
  // Server settings
  onOpenServerSettings: () => void
  onInvitePeople?: () => Promise<void>
  onOpenCommunity?: () => void
  serverId?: string
  isOwner?: boolean
  hasNoServers?: boolean
  // DM
  dmConversations?: { id: string; created_at: string; other_user: { id: string; username: string; avatar_url?: string } }[]
  currentDMId?: string | null
  dmUnreadCounts?: Record<string, number>
  channelUnreadCounts?: Record<string, number>
  onSelectDM?: (conversationId: string) => void
  // Admin: drop user onto voice channel to move them
  onMoveToChannel?: (userId: string, channelId: string) => Promise<void>
}

function HashIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M5.88657 21C5.57547 21 5.3399 20.7189 5.39427 20.4126L6.00001 17H2.59511C2.28449 17 2.04905 16.7198 2.10259 16.4138L2.27759 15.4138C2.31946 15.1746 2.52722 15 2.77011 15H6.35001L7.41001 9H4.00511C3.69449 9 3.45905 8.71977 3.51259 8.41381L3.68759 7.41381C3.72946 7.17456 3.93722 7 4.18011 7H7.76001L8.39677 3.41262C8.43914 3.17391 8.64664 3 8.88907 3H9.87344C10.1845 3 10.4201 3.28107 10.3657 3.58738L9.76001 7H15.76L16.3968 3.41262C16.4391 3.17391 16.6466 3 16.8891 3H17.8734C18.1845 3 18.4201 3.28107 18.3657 3.58738L17.76 7H21.1649C21.4755 7 21.711 7.28023 21.6574 7.58619L21.4824 8.58619C21.4406 8.82544 21.2328 9 20.9899 9H17.41L16.35 15H19.7549C20.0655 15 20.301 15.2802 20.2474 15.5862L20.0724 16.5862C20.0306 16.8254 19.8228 17 19.5799 17H16L15.3632 20.5874C15.3209 20.8261 15.1134 21 14.8709 21H13.8866C13.5755 21 13.3399 20.7189 13.3943 20.4126L14 17H8.00001L7.36325 20.5874C7.32088 20.8261 7.11337 21 6.87094 21H5.88657ZM9.41001 9L8.35001 15H14.35L15.41 9H9.41001Z"/>
    </svg>
  )
}

function VoiceIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11.383 3.07904C11.009 2.92504 10.579 3.01004 10.293 3.29604L6.586 7.00304H4C3.45 7.00304 3 7.45304 3 8.00304V16.003C3 16.553 3.45 17.003 4 17.003H6.586L10.293 20.71C10.579 20.996 11.009 21.082 11.383 20.927C11.757 20.772 12 20.407 12 20.003V4.00304C12 3.59904 11.757 3.23404 11.383 3.07904Z"/>
      <path d="M14 9.00304C14 9.00304 16 10.003 16 12.003C16 14.003 14 15.003 14 15.003" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <path d="M17 7.00304C17 7.00304 20 9.00304 20 12.003C20 15.003 17 17.003 17 17.003" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
    </svg>
  )
}

const CHANNEL_PREFIX = 'ch-'
const CATEGORY_PREFIX = 'cat-'
const USER_PREFIX = 'user-'
const VOICE_DROP_PREFIX = 'voice-drop-'
const UNCATEGORIZED_ID = '__uncategorized__'

function DraggableVoiceUser({
  vu,
  canMove,
}: {
  vu: VoiceUserInfo
  canMove: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${USER_PREFIX}${vu.userId}`,
    disabled: !canMove,
  })
  if (!canMove) {
    return (
      <div className="flex items-center gap-2 px-1.5 py-1 rounded text-app-muted hover:bg-app-hover/30">
        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 ring-1.5 transition-all overflow-hidden ${
          vu.isSpeaking ? 'ring-2 ring-[#23a559] shadow-[0_0_8px_rgba(35,165,89,0.7)]' : 'ring-transparent'
        } ${vu.avatar_url ? 'bg-transparent' : 'bg-app-accent/80'}`}>
          {vu.avatar_url ? (
            <img src={vu.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            vu.username.charAt(0).toUpperCase()
          )}
        </div>
        <span className="text-xs truncate flex-1 min-w-0">{vu.username}</span>
        <div className="flex items-center gap-0.5 ml-auto flex-shrink-0">
          {vu.isMuted && <MicOffIcon size={12} className="text-red-400" />}
          {vu.isDeafened && <HeadphonesOffIcon size={12} className="text-red-400" />}
        </div>
      </div>
    )
  }
  return (
    <div ref={setNodeRef} className={isDragging ? 'opacity-50' : ''}>
      <div
        {...attributes}
        {...listeners}
        className="flex items-center gap-2 px-1.5 py-1 rounded text-app-muted hover:bg-app-hover/30 cursor-grab active:cursor-grabbing touch-none"
      >
        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 ring-1.5 transition-all overflow-hidden ${
          vu.isSpeaking ? 'ring-2 ring-[#23a559] shadow-[0_0_8px_rgba(35,165,89,0.7)]' : 'ring-transparent'
        } ${vu.avatar_url ? 'bg-transparent' : 'bg-app-accent/80'}`}>
          {vu.avatar_url ? (
            <img src={vu.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            vu.username.charAt(0).toUpperCase()
          )}
        </div>
        <span className="text-xs truncate flex-1 min-w-0">{vu.username}</span>
        <div className="flex items-center gap-0.5 ml-auto flex-shrink-0">
          {vu.isMuted && <MicOffIcon size={12} className="text-red-400" />}
          {vu.isDeafened && <HeadphonesOffIcon size={12} className="text-red-400" />}
        </div>
      </div>
    </div>
  )
}

function SortableChannelItem({
  channel,
  currentChannelId,
  onSelectChannel,
  voiceUsers,
  hasUnread,
  HashIcon,
  VoiceIcon,
  onUpdateChannel,
  onDeleteChannel,
  onMoveToChannel,
  canEdit,
}: {
  channel: Channel
  currentChannelId: string | null
  onSelectChannel: (ch: Channel) => void
  voiceUsers: Record<string, VoiceUserInfo[]>
  hasUnread?: boolean
  HashIcon: React.ComponentType<{ className?: string }>
  VoiceIcon: React.ComponentType<{ className?: string }>
  onUpdateChannel?: (channelId: string, data: { name?: string; order?: number; categoryId?: string | null }) => Promise<void>
  onDeleteChannel?: (channelId: string) => Promise<void>
  onMoveToChannel?: (userId: string, channelId: string) => Promise<void>
  canEdit?: boolean
}) {
  const [showMenu, setShowMenu] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(channel.name)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `${CHANNEL_PREFIX}${channel.id}`,
  })
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: channel.type === 'voice' ? `${VOICE_DROP_PREFIX}${channel.id}` : `no-drop-${channel.id}`,
    disabled: channel.type !== 'voice',
  })
  const style = { transform: CSS.Transform.toString(transform), transition }

  const handleSaveEdit = useCallback(async () => {
    if (editName.trim() && editName !== channel.name && onUpdateChannel) {
      await onUpdateChannel(channel.id, { name: editName.trim() })
    }
    setEditing(false)
  }, [channel.id, channel.name, editName, onUpdateChannel])

  const voiceUsersList = (voiceUsers[channel.id] || [])

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'opacity-50' : ''}>
      <div className="flex items-center gap-0.5 group/ch">
        <button
          {...attributes}
          {...listeners}
          className="p-1 rounded text-app-muted hover:text-app-text hover:bg-app-hover/40 cursor-grab active:cursor-grabbing flex-shrink-0 opacity-0 group-hover/ch:opacity-100 transition-opacity touch-none"
          title="Drag to reorder"
          onClick={(e) => e.preventDefault()}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 6h2v2H8V6zm0 5h2v2H8v-2zm0 5h2v2H8v-2zm5-10h2v2h-2V6zm0 5h2v2h-2v-2zm0 5h2v2h-2v-2z"/>
          </svg>
        </button>
        <div className="flex-1 min-w-0 relative">
          {editing ? (
            <div className="flex items-center gap-1 px-2 py-1">
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') { setEditName(channel.name); setEditing(false) } }}
                onBlur={handleSaveEdit}
                className="flex-1 px-1.5 py-0.5 rounded bg-app-dark text-sm text-app-text border border-app-hover/50"
              />
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onSelectChannel(channel)}
                className={`flex-1 px-2 py-1.5 rounded flex items-center gap-1.5 text-left ${
                  currentChannelId === channel.id
                    ? 'bg-app-hover/60 text-white'
                    : channel.type === 'text' && hasUnread
                      ? 'bg-white/10 text-white hover:bg-white/15'
                      : 'text-app-muted hover:bg-app-hover/40 hover:text-app-text'
                }`}
              >
                {channel.type === 'text' ? (
                  <HashIcon className="w-5 h-5 flex-shrink-0 opacity-60" />
                ) : (
                  <VoiceIcon className="w-5 h-5 flex-shrink-0 opacity-60" />
                )}
                <span className="text-sm truncate flex-1">{channel.name}</span>
              </button>
              {canEdit && (
                <div className="relative">
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="p-1 rounded text-app-muted hover:text-app-text hover:bg-app-hover/40 opacity-0 group-hover/ch:opacity-100 transition-opacity"
                    title="Channel options"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                    </svg>
                  </button>
                  {showMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                      <div className="absolute right-0 top-full mt-0.5 z-50 bg-[#111214] rounded-lg shadow-xl p-1 border border-app-hover/30 min-w-[120px]">
                        <button
                          onClick={() => { setEditing(true); setShowMenu(false) }}
                          className="w-full px-2 py-1.5 rounded text-sm text-app-text hover:bg-app-accent hover:text-white text-left"
                        >
                          Edit Channel
                        </button>
                        <button
                          onClick={async () => {
                            if (onDeleteChannel && confirm(`Delete channel "${channel.name}"?`)) {
                              await onDeleteChannel(channel.id)
                            }
                            setShowMenu(false)
                          }}
                          className="w-full px-2 py-1.5 rounded text-sm text-red-400 hover:bg-red-500/20 text-left"
                        >
                          Delete Channel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          {channel.type === 'voice' && voiceUsersList.length > 0 && (
            <div
              ref={setDropRef}
              className={`ml-7 space-y-0.5 mt-0.5 p-1 rounded transition-colors ${isOver ? 'bg-app-accent/20 ring-1 ring-app-accent/50' : ''}`}
            >
              {voiceUsersList.map((vu) => (
                <DraggableVoiceUser key={vu.userId} vu={vu} canMove={!!onMoveToChannel} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function UncategorizedHeader({
  collapsed,
  onToggle,
  onAddChannel,
}: {
  collapsed: boolean
  onToggle: () => void
  onAddChannel: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${CATEGORY_PREFIX}${UNCATEGORIZED_ID}`,
  })
  return (
    <div
      ref={setNodeRef}
      className={`flex items-center px-1 group cursor-pointer ${isOver ? 'bg-app-accent/15 rounded' : ''}`}
      onClick={onToggle}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        className={`mr-0.5 text-app-muted transition-transform flex-shrink-0 ${collapsed ? '-rotate-90' : ''}`}
      >
        <path d="M2 3L5 6L8 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      </svg>
      <span className="text-[11px] font-bold text-app-muted uppercase tracking-wider truncate flex-1 hover:text-app-text transition-colors">
        Channels
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onAddChannel() }}
        className="opacity-0 group-hover:opacity-100 text-app-muted hover:text-app-text transition-all p-0.5"
        title="Create Channel"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  )
}

function SortableCategoryHeader({
  category,
  collapsed,
  onToggle,
  onAddChannel,
  onUpdateCategory,
  onDeleteCategory,
  canEdit,
}: {
  category: Category
  collapsed: boolean
  onToggle: () => void
  onAddChannel: (catId: string) => void
  onUpdateCategory?: (catId: string, data: { name?: string }) => Promise<void>
  onDeleteCategory?: (catId: string) => Promise<void>
  canEdit?: boolean
}) {
  const [showMenu, setShowMenu] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(category.name)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `${CATEGORY_PREFIX}${category.id}`,
  })
  const { active, over } = useDndContext()
  const activeStr = String(active?.id ?? '')
  const isOver = over?.id === `${CATEGORY_PREFIX}${category.id}` && activeStr.startsWith(CHANNEL_PREFIX)
  const style = { transform: CSS.Transform.toString(transform), transition }

  const handleSaveEdit = useCallback(async () => {
    if (editName.trim() && editName !== category.name && onUpdateCategory) {
      await onUpdateCategory(category.id, { name: editName.trim() })
    }
    setEditing(false)
  }, [category.id, category.name, editName, onUpdateCategory])

  if (editing) {
    return (
      <div className="flex items-center px-1 py-0.5" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') { setEditName(category.name); setEditing(false) } }}
          onBlur={handleSaveEdit}
          className="flex-1 px-1.5 py-0.5 rounded bg-app-dark text-[11px] font-bold text-app-muted uppercase tracking-wider border border-app-hover/50"
        />
      </div>
    )
  }

  return (
    <div ref={setNodeRef} style={style} className={`flex items-center px-1 group cursor-pointer rounded ${isDragging ? 'opacity-50' : ''} ${isOver ? 'bg-app-accent/15' : ''}`} onClick={onToggle}>
      <button
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="p-0.5 rounded text-app-muted hover:text-app-text hover:bg-app-hover/40 cursor-grab active:cursor-grabbing flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity touch-none"
        title="Drag to reorder"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 6h2v2H8V6zm0 5h2v2H8v-2zm0 5h2v2H8v-2zm5-10h2v2h-2V6zm0 5h2v2h-2v-2zm0 5h2v2h-2v-2z"/>
        </svg>
      </button>
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        className={`mr-0.5 text-app-muted transition-transform flex-shrink-0 ${collapsed ? '-rotate-90' : ''}`}
      >
        <path d="M2 3L5 6L8 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      </svg>
      <span className="text-[11px] font-bold text-app-muted uppercase tracking-wider truncate flex-1 hover:text-app-text transition-colors">
        {category.name}
      </span>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
        <button
          onClick={(e) => { e.stopPropagation(); onAddChannel(category.id) }}
          className="p-0.5 text-app-muted hover:text-app-text"
          title="Create Channel"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </button>
        {canEdit && (
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu) }}
              className="p-0.5 text-app-muted hover:text-app-text"
              title="Category options"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
              </svg>
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute left-0 top-full mt-0.5 z-50 bg-[#111214] rounded-lg shadow-xl p-1 border border-app-hover/30 min-w-[120px]">
                  <button
                    onClick={() => { setEditing(true); setShowMenu(false) }}
                    className="w-full px-2 py-1.5 rounded text-sm text-app-text hover:bg-app-accent hover:text-white text-left"
                  >
                    Edit Category
                  </button>
                  <button
                    onClick={async () => {
                      if (onDeleteCategory && confirm(`Delete category "${category.name}"? Channels will become uncategorized.`)) {
                        await onDeleteCategory(category.id)
                      }
                      setShowMenu(false)
                    }}
                    className="w-full px-2 py-1.5 rounded text-sm text-red-400 hover:bg-red-500/20 text-left"
                  >
                    Delete Category
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function CategorySection({
  category,
  channels,
  currentChannelId,
  onSelectChannel,
  onAddChannel,
  onUpdateChannel,
  onUpdateCategory,
  onDeleteChannel,
  onDeleteCategory,
  onMoveToChannel,
  voiceUsers,
  channelUnreadCounts,
  canEdit,
}: {
  category: Category | null
  channels: Channel[]
  currentChannelId: string | null
  onSelectChannel: (ch: Channel) => void
  onAddChannel: (catId?: string) => void
  onUpdateChannel?: (channelId: string, data: { name?: string; order?: number; categoryId?: string | null }) => Promise<void>
  onUpdateCategory?: (catId: string, data: { name?: string }) => Promise<void>
  onDeleteChannel?: (channelId: string) => Promise<void>
  onDeleteCategory?: (catId: string) => Promise<void>
  onMoveToChannel?: (userId: string, channelId: string) => Promise<void>
  voiceUsers: Record<string, VoiceUserInfo[]>
  channelUnreadCounts?: Record<string, number>
  canEdit?: boolean
}) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="mt-4 first:mt-1">
      {category && (
        <SortableCategoryHeader
          category={category}
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          onAddChannel={onAddChannel}
          onUpdateCategory={onUpdateCategory}
          onDeleteCategory={onDeleteCategory}
          canEdit={canEdit}
        />
      )}
      {!category && (
        <UncategorizedHeader
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          onAddChannel={() => onAddChannel(undefined)}
        />
      )}

      {!collapsed && (
        <SortableContext
          items={channels.map((c) => `${CHANNEL_PREFIX}${c.id}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="mt-0.5 space-y-0.5 px-2">
            {channels.map((channel) => (
              <SortableChannelItem
                key={channel.id}
                channel={channel}
                currentChannelId={currentChannelId}
                onSelectChannel={onSelectChannel}
                voiceUsers={voiceUsers}
                hasUnread={channel.type === 'text' && (channelUnreadCounts?.[channel.id] ?? 0) > 0}
                HashIcon={HashIcon}
                VoiceIcon={VoiceIcon}
                onUpdateChannel={onUpdateChannel}
                onDeleteChannel={onDeleteChannel}
                onMoveToChannel={onMoveToChannel}
                canEdit={canEdit}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  )
}

export function ChannelList({
  channels,
  categories,
  currentChannelId,
  onSelectChannel,
  serverName,
  onCreateChannel,
  onCreateCategory,
  onReorderChannels,
  onUpdateChannel,
  onUpdateCategory,
  onReorderCategories,
  onDeleteChannel,
  onDeleteCategory,
  onMoveToChannel,
  voiceConnection,
  voiceUsers,
  onOpenServerSettings,
  onInvitePeople,
  onOpenCommunity,
  serverId,
  isOwner,
  hasNoServers,
  dmConversations = [],
  currentDMId,
  dmUnreadCounts = {},
  channelUnreadCounts = {},
  onSelectDM,
}: ChannelListProps) {
  const [showCreateChannel, setShowCreateChannel] = useState(false)
  const [createChannelCategoryId, setCreateChannelCategoryId] = useState<string | undefined>()
  const [showServerMenu, setShowServerMenu] = useState(false)

  // Group channels by category
  const categorizedChannels = categories.map((cat) => ({
    category: cat,
    channels: channels.filter((ch) => ch.categoryId === cat.id).sort((a, b) => a.order - b.order),
  }))

  // Uncategorized channels
  const uncategorizedChannels = channels.filter(
    (ch) => !ch.categoryId || !categories.find((cat) => cat.id === ch.categoryId)
  ).sort((a, b) => a.order - b.order)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleGlobalDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const activeStr = String(active.id)
      const overStr = String(over.id)

      // Move user to voice channel
      if (activeStr.startsWith(USER_PREFIX) && overStr.startsWith(VOICE_DROP_PREFIX)) {
        const userId = activeStr.slice(USER_PREFIX.length)
        const channelId = overStr.slice(VOICE_DROP_PREFIX.length)
        onMoveToChannel?.(userId, channelId)
        return
      }

      // Reorder categories
      if (activeStr.startsWith(CATEGORY_PREFIX) && overStr.startsWith(CATEGORY_PREFIX)) {
        const oldIndex = categories.findIndex((c) => `${CATEGORY_PREFIX}${c.id}` === activeStr)
        const newIndex = categories.findIndex((c) => `${CATEGORY_PREFIX}${c.id}` === overStr)
        if (oldIndex !== -1 && newIndex !== -1 && onReorderCategories) {
          const reordered = arrayMove(categories, oldIndex, newIndex)
          onReorderCategories(reordered.map((c, i) => ({ id: c.id, order: i })))
        }
        return
      }

      // Move channel to category (drop on category header) or uncategorized
      if (activeStr.startsWith(CHANNEL_PREFIX) && overStr.startsWith(CATEGORY_PREFIX)) {
        const channelId = activeStr.slice(CHANNEL_PREFIX.length)
        const catId = overStr.slice(CATEGORY_PREFIX.length)
        const categoryId = catId === UNCATEGORIZED_ID ? null : catId
        onUpdateChannel?.(channelId, { categoryId })
        return
      }

      // Reorder channels within category
      if (activeStr.startsWith(CHANNEL_PREFIX) && overStr.startsWith(CHANNEL_PREFIX)) {
        const channelId = activeStr.slice(CHANNEL_PREFIX.length)
        const channel = channels.find((c) => c.id === channelId)
        if (!channel || !onReorderChannels) return
        const catChannels = channel.categoryId
          ? channels.filter((c) => c.categoryId === channel.categoryId).sort((a, b) => a.order - b.order)
          : uncategorizedChannels
        const oldIndex = catChannels.findIndex((c) => c.id === channelId)
        const newIndex = catChannels.findIndex((c) => `${CHANNEL_PREFIX}${c.id}` === overStr)
        if (oldIndex !== -1 && newIndex !== -1) {
          const reordered = arrayMove(catChannels, oldIndex, newIndex)
          onReorderChannels(reordered.map((ch, i) => ({ id: ch.id, order: i })))
        }
      }
    },
    [channels, categories, uncategorizedChannels, onReorderChannels, onReorderCategories, onUpdateChannel, onMoveToChannel]
  )

  return (
    <>
      <div className="flex-1 bg-app-channel flex flex-col min-h-0">
        {/* Server Header */}
        <div className="relative">
          <button
            onClick={() => hasNoServers ? onOpenCommunity?.() : setShowServerMenu(!showServerMenu)}
            className="w-full h-12 px-4 flex items-center justify-between border-b border-app-dark/80 text-app-text font-semibold shadow-sm hover:bg-app-hover/50 transition-colors"
          >
            <span className="truncate">{hasNoServers ? 'Explore' : (serverName ?? 'Server')}</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              className={`text-app-muted transition-transform flex-shrink-0 ${showServerMenu ? 'rotate-180' : ''}`}
            >
              <path d="M7 10L12 15L17 10" />
            </svg>
          </button>

          {/* Server dropdown menu */}
          {showServerMenu && !hasNoServers && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowServerMenu(false)} />
              <div className="absolute top-12 left-2 right-2 z-50 bg-[#111214] rounded-lg shadow-xl p-1.5 border border-app-hover/30">
                <button
                  onClick={() => {
                    setCreateChannelCategoryId(undefined)
                    setShowCreateChannel(true)
                    setShowServerMenu(false)
                  }}
                  className="w-full px-2 py-1.5 rounded text-sm text-app-text hover:bg-app-accent hover:text-white text-left flex items-center gap-2 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
                    <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Create Channel
                </button>
                <button
                  onClick={async () => {
                    const name = prompt('Category name:')
                    if (name) await onCreateCategory(name)
                    setShowServerMenu(false)
                  }}
                  className="w-full px-2 py-1.5 rounded text-sm text-app-text hover:bg-app-accent hover:text-white text-left flex items-center gap-2 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
                    <path d="M3 7H21M3 12H21M3 17H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Create Category
                </button>
                <div className="h-px bg-app-hover/50 my-1" />
                {onInvitePeople && serverId && (
                  <button
                    onClick={async () => {
                      await onInvitePeople()
                      setShowServerMenu(false)
                    }}
                    className="w-full px-2 py-1.5 rounded text-sm text-app-text hover:bg-app-accent hover:text-white text-left flex items-center gap-2 transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="8.5" cy="7" r="4"/>
                      <line x1="20" y1="8" x2="20" y2="14"/>
                      <line x1="23" y1="11" x2="17" y2="11"/>
                    </svg>
                    Invite People
                  </button>
                )}
                {isOwner && (
                  <button
                    onClick={() => {
                      onOpenServerSettings()
                      setShowServerMenu(false)
                    }}
                    className="w-full px-2 py-1.5 rounded text-sm text-app-text hover:bg-app-accent hover:text-white text-left flex items-center gap-2 transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0">
                      <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
                    </svg>
                    Server Settings
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Direct Messages */}
        {dmConversations.length > 0 && onSelectDM && (
          <div className="border-b border-app-dark/80 px-2 py-1.5">
            <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-app-muted uppercase tracking-wider">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="opacity-70">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
              </svg>
              Direct Messages
              {Object.values(dmUnreadCounts).reduce((a, b) => a + b, 0) > 0 && (
                <span className="ml-1 min-w-[18px] h-[18px] px-1.5 rounded-full bg-app-online text-[10px] font-bold text-white flex items-center justify-center">
                  {Object.values(dmUnreadCounts).reduce((a, b) => a + b, 0)}
                </span>
              )}
            </div>
            <div className="space-y-0.5">
              {dmConversations.filter((c) => c?.other_user).map((conv) => {
                const unreadCount = dmUnreadCounts[conv.id] ?? 0
                const hasUnread = unreadCount > 0
                return (
                  <button
                    key={conv.id}
                    onClick={() => onSelectDM(conv.id)}
                    className={`w-full px-2 py-1.5 rounded flex items-center gap-2 text-left transition-all ${
                      currentDMId === conv.id
                        ? 'bg-app-hover/60 text-white'
                        : hasUnread
                          ? 'bg-app-accent/15 text-app-text hover:bg-app-accent/25 animate-dm-glow'
                          : 'text-app-muted hover:bg-app-hover/40 hover:text-app-text'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden ${
                          hasUnread ? 'ring-2 ring-app-online ring-offset-2 ring-offset-app-channel' : ''
                        } ${conv.other_user?.avatar_url ? 'bg-transparent' : 'bg-app-accent'}`}
                      >
                        {conv.other_user?.avatar_url ? (
                          <img src={conv.other_user.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (conv.other_user?.username ?? '?').charAt(0).toUpperCase()
                        )}
                      </div>
                      {hasUnread && (
                        <span
                          className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-1 rounded-full bg-app-online text-[10px] font-bold text-white flex items-center justify-center animate-pulse"
                          title="New message"
                        >
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-sm truncate flex-1 ${hasUnread ? 'font-semibold' : ''}`}
                    >
                      {conv.other_user?.username ?? 'Unknown'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Channel List */}
        <div className="flex-1 overflow-y-auto py-1 px-0.5">
          {hasNoServers && onOpenCommunity ? (
            <div className="p-4 text-center">
              <p className="text-sm text-app-muted mb-3">You're not in any servers yet.</p>
              <button
                onClick={onOpenCommunity}
                className="px-4 py-2 bg-app-accent hover:bg-app-accent-hover text-white rounded-lg text-sm font-medium"
              >
                Explore Community
              </button>
            </div>
          ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGlobalDragEnd}>
            <SortableContext
              items={categories.map((c) => `${CATEGORY_PREFIX}${c.id}`)}
              strategy={verticalListSortingStrategy}
            >
              {/* Categorized channels */}
              {categorizedChannels.map(({ category, channels: catChannels }) => (
                <CategorySection
                  key={category.id}
                  category={category}
                  channels={catChannels}
                  currentChannelId={currentChannelId}
                  onSelectChannel={onSelectChannel}
                  onAddChannel={(catId) => {
                    setCreateChannelCategoryId(catId)
                    setShowCreateChannel(true)
                  }}
                  onUpdateChannel={onUpdateChannel}
                  onUpdateCategory={onUpdateCategory}
                  onDeleteChannel={onDeleteChannel}
                  onDeleteCategory={onDeleteCategory}
                  onMoveToChannel={onMoveToChannel}
                  voiceUsers={voiceUsers}
                  channelUnreadCounts={channelUnreadCounts}
                  canEdit={isOwner}
                />
              ))}

              {/* Uncategorized channels */}
              {uncategorizedChannels.length > 0 && (
                <CategorySection
                  category={null}
                  channels={uncategorizedChannels}
                  currentChannelId={currentChannelId}
                  onSelectChannel={onSelectChannel}
                  onAddChannel={() => {
                    setCreateChannelCategoryId(undefined)
                    setShowCreateChannel(true)
                  }}
                  onUpdateChannel={onUpdateChannel}
                  onUpdateCategory={onUpdateCategory}
                  onDeleteChannel={onDeleteChannel}
                  onDeleteCategory={onDeleteCategory}
                  onMoveToChannel={onMoveToChannel}
                  voiceUsers={voiceUsers}
                  channelUnreadCounts={channelUnreadCounts}
                  canEdit={isOwner}
                />
              )}
            </SortableContext>
          </DndContext>
          )}
        </div>

        {/* Voice Connection Bar (shown only when in voice on THIS server) */}
        {voiceConnection && channels.some((c) => c.id === voiceConnection.channelId) && (
          <div className="border-t border-app-dark/80 bg-[#232428] px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                {/* Connection bars on top; Voice Connected + channel name below */}
                <div
                  className="flex items-end gap-0.5 h-4 w-fit cursor-default mb-1"
                  title={voiceConnection.ping != null ? `${voiceConnection.ping}ms` : 'Latency'}
                >
                  {(() => {
                    const ping = voiceConnection.ping
                    const barColor = ping == null ? 'bg-app-muted' : ping < 100 ? 'bg-[#23a559]' : ping < 200 ? 'bg-yellow-400' : 'bg-red-400'
                    const bars = ping == null ? 1 : ping < 100 ? 3 : ping < 200 ? 2 : 1
                    return (
                      <>
                        <div className={`w-1 rounded-sm ${bars >= 3 ? barColor : 'bg-app-hover/40'}`} style={{ height: 6 }} />
                        <div className={`w-1 rounded-sm ${bars >= 2 ? barColor : 'bg-app-hover/40'}`} style={{ height: 10 }} />
                        <div className={`w-1 rounded-sm ${bars >= 1 ? barColor : 'bg-app-hover/40'}`} style={{ height: 14 }} />
                      </>
                    )
                  })()}
                </div>
                <div className="text-xs font-semibold text-[#23a559]">Voice Connected</div>
                <div className="text-[11px] text-app-muted truncate">{voiceConnection.channelName}</div>
              </div>
              {/* Camera, Screen Share, Hangup — grouped on the right */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={voiceConnection.onToggleCamera}
                  className={`p-1.5 rounded transition-colors ${
                    voiceConnection.isCameraOn
                      ? 'bg-white/10 text-white'
                      : 'text-app-muted hover:bg-app-hover/50 hover:text-app-text'
                  }`}
                  title={voiceConnection.isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    {voiceConnection.isCameraOn ? (
                      <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                    ) : (
                      <>
                        <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/>
                      </>
                    )}
                  </svg>
                </button>
                <button
                  onClick={voiceConnection.onToggleScreenShare}
                  className={`p-1.5 rounded transition-colors ${
                    voiceConnection.isScreenSharing
                      ? 'bg-white/10 text-white'
                      : 'text-app-muted hover:bg-app-hover/50 hover:text-app-text'
                  }`}
                  title={voiceConnection.isScreenSharing ? 'Stop Sharing' : 'Share Your Screen'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/>
                    {voiceConnection.isScreenSharing && (
                      <path d="M10 13l2-2 2 2v-4h-4v4z" fill="currentColor"/>
                    )}
                  </svg>
                </button>
                <button
                  onClick={voiceConnection.onDisconnect}
                  className="p-1.5 rounded hover:bg-app-hover/50 text-app-muted hover:text-red-400 transition-colors"
                  title="End Call"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 00-2.67-1.85.996.996 0 01-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Channel Modal */}
        {showCreateChannel && (
          <CreateChannelModal
            onClose={() => setShowCreateChannel(false)}
            onCreate={async (name, type) => {
              await onCreateChannel(name, type, createChannelCategoryId)
            }}
            categoryName={categories.find((c) => c.id === createChannelCategoryId)?.name}
          />
        )}
      </div>
    </>
  )
}
