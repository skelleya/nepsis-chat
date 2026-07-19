import { useCallback, useRef, useState } from 'react'
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
import { useApp } from '../contexts/AppContext'
import * as api from '../services/api'
import type { ProfileType } from '../services/api'
import { useGsapMenu } from '../hooks/useGsapMenu'

interface VoiceUserInfo {
  userId: string
  username: string
  avatar_url?: string
  isMuted?: boolean
  isDeafened?: boolean
  isSpeaking?: boolean
  isScreenSharing?: boolean
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
  serverBannerUrl?: string
  onCreateChannel: (name: string, type: 'text' | 'voice' | 'rules', categoryId?: string) => Promise<void>
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
  /** Discord-style: click LIVE / sharer to focus their screen in VoiceView */
  onWatchScreenShare?: (userId: string) => void
  // Server settings
  onOpenServerSettings: () => void
  onInvitePeople?: () => Promise<void>
  onOpenCommunity?: () => void
  serverId?: string
  isOwner?: boolean
  hasNoServers?: boolean
  /** When true, show "Friends" header and DMs only; hide server channels */
  isFriendsView?: boolean
  // DM
  dmConversations?: { id: string; created_at: string; other_user: { id: string; username: string; avatar_url?: string } }[]
  currentDMId?: string | null
  dmUnreadCounts?: Record<string, number>
  channelUnreadCounts?: Record<string, number>
  channelMentionCounts?: Record<string, number>
  onSelectDM?: (conversationId: string) => void
  // Admin: drop user onto voice channel to move them
  onMoveToChannel?: (userId: string, channelId: string) => Promise<void>
  onMuteInVoice?: (userId: string) => Promise<void>
  onDisconnectFromVoice?: (userId: string) => Promise<void>
  /** Owner/admin: can create rules channel and see rules option in modal */
  isAdminOrOwner?: boolean
}

/** Soft chat glyph — not Discord # */
function ChatIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M8 10.5h8M8 14h5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M12 3.5c-4.7 0-8.5 3.13-8.5 7 0 2.12 1.12 4.02 2.9 5.3L5.5 20l3.4-1.7c.97.28 2 .43 3.1.43 4.7 0 8.5-3.13 8.5-7s-3.8-7-8.5-7z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function VoiceIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="3.5" y="8" width="2.5" height="8" rx="1.25" fill="currentColor" />
      <rect x="8.25" y="5" width="2.5" height="14" rx="1.25" fill="currentColor" />
      <rect x="13" y="7" width="2.5" height="10" rx="1.25" fill="currentColor" />
      <rect x="17.75" y="4" width="2.5" height="16" rx="1.25" fill="currentColor" />
    </svg>
  )
}

function RulesIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M7 4.5h7.5L19 9v10.5a1 1 0 01-1 1H7a1 1 0 01-1-1v-14a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M14.5 4.5V9H19" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M9 13h6M9 16.5h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function MoreIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  )
}

const CHANNEL_PREFIX = 'ch-'
const CATEGORY_PREFIX = 'cat-'
const USER_PREFIX = 'user-'
const VOICE_DROP_PREFIX = 'voice-drop-'
const UNCATEGORIZED_ID = '__uncategorized__'

/** When dragging a category, only detect collisions with other category headers (not channels) */
function categoryAwareCollisionDetection(args: Parameters<typeof closestCenter>[0]) {
  const activeStr = String(args.active.id)
  if (activeStr.startsWith(CATEGORY_PREFIX)) {
    const filtered = [...args.droppableContainers].filter((c) => {
      const idStr = String(c.id)
      return idStr.startsWith(CATEGORY_PREFIX) && idStr !== activeStr
    })
    return closestCenter({ ...args, droppableContainers: filtered })
  }
  return closestCenter(args)
}

function VoiceUserRow({
  vu,
  currentChannelId,
  voiceChannels,
  canModerate,
  isSelf,
  onMoveToChannel,
  onMuteInVoice,
  onDisconnectFromVoice,
  onWatchScreenShare,
}: {
  vu: VoiceUserInfo
  currentChannelId: string
  voiceChannels: Channel[]
  canModerate: boolean
  isSelf: boolean
  onMoveToChannel?: (userId: string, channelId: string) => Promise<void>
  onMuteInVoice?: (userId: string) => Promise<void>
  onDisconnectFromVoice?: (userId: string) => Promise<void>
  onWatchScreenShare?: (userId: string) => void
}) {
  const [showMenu, setShowMenu] = useState(false)
  const [showMoveSub, setShowMoveSub] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const shouldRenderMenu = useGsapMenu(showMenu, menuRef, {
    enterY: -4,
    exitY: -2,
    transformOrigin: 'top right',
  })

  const canDrag = canModerate && !!onMoveToChannel
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${USER_PREFIX}${vu.userId}`,
    disabled: !canDrag,
  })

  const otherVoice = voiceChannels.filter((ch) => ch.id !== currentChannelId && ch.type === 'voice')
  const canMove = canModerate && !!onMoveToChannel && otherVoice.length > 0
  const canMute = canModerate && !!onMuteInVoice && !isSelf
  const canDisconnect = canModerate && !!onDisconnectFromVoice && !isSelf
  const canWatch = !!vu.isScreenSharing && !!onWatchScreenShare
  const hasOptions = canMove || canMute || canDisconnect || canWatch

  const closeMenu = () => {
    setShowMenu(false)
    setShowMoveSub(false)
  }

  return (
    <div
      ref={setNodeRef}
      className={`group/vu relative flex items-center gap-1.5 pl-1.5 pr-0.5 py-1 rounded-lg text-app-muted transition-colors ${
        isDragging ? 'opacity-40' : 'hover:bg-app-glass/[0.04]'
      } ${vu.isScreenSharing && !hasOptions ? 'cursor-pointer' : ''}`}
      onClick={() => {
        if (vu.isScreenSharing && !hasOptions) onWatchScreenShare?.(vu.userId)
      }}
    >
      <div
        {...(canDrag ? { ...attributes, ...listeners } : {})}
        className={`flex items-center gap-2 min-w-0 flex-1 ${canDrag ? 'cursor-grab active:cursor-grabbing touch-none' : ''}`}
        title={canDrag ? 'Drag to another voice room' : undefined}
      >
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0 ring-2 transition-all overflow-hidden ${
            vu.isSpeaking
              ? 'ring-[#23a559] shadow-[0_0_10px_rgba(35,165,89,0.45)]'
              : 'ring-transparent'
          } ${vu.avatar_url ? 'bg-transparent' : 'bg-app-accent/80'}`}
        >
          {vu.avatar_url ? (
            <img src={vu.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            vu.username.charAt(0).toUpperCase()
          )}
        </div>
        <span className="text-[12px] font-medium truncate min-w-0 text-app-text/85">{vu.username}</span>
      </div>

      <div className="flex items-center gap-0.5 flex-shrink-0">
        {vu.isScreenSharing && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onWatchScreenShare?.(vu.userId)
            }}
            className="text-[9px] font-semibold tracking-wide px-1.5 py-0.5 rounded-md bg-red-500/90 text-white hover:bg-red-500 flex-shrink-0"
            title="Watch screen share"
          >
            Live
          </button>
        )}
        {vu.isMuted && <MicOffIcon size={12} className="text-red-400" />}
        {vu.isDeafened && <HeadphonesOffIcon size={12} className="text-red-400" />}

        {hasOptions && (
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu((v) => !v)
                setShowMoveSub(false)
              }}
              className="p-1 rounded-md text-app-muted hover:text-app-text hover:bg-app-glass/[0.06] opacity-70 group-hover/vu:opacity-100 max-lg:opacity-100 transition-opacity"
              title="User options"
              aria-label={`Options for ${vu.username}`}
            >
              <MoreIcon />
            </button>
            {shouldRenderMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={closeMenu} />
                <div
                  ref={menuRef}
                  className="absolute right-0 top-full mt-1 z-50 min-w-[168px] rounded-xl border border-app-glass/[0.08] bg-app-panel p-1 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  {canWatch && (
                    <button
                      type="button"
                      onClick={() => {
                        onWatchScreenShare?.(vu.userId)
                        closeMenu()
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg text-[13px] text-left text-app-text hover:bg-app-accent hover:text-white"
                    >
                      Watch Live
                    </button>
                  )}
                  {canMove && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowMoveSub((v) => !v)}
                        className="w-full px-2.5 py-1.5 rounded-lg text-[13px] text-left text-app-text hover:bg-app-accent hover:text-white flex items-center justify-between gap-2"
                      >
                        <span>Move to…</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className={showMoveSub ? 'rotate-90' : ''}>
                          <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                        </svg>
                      </button>
                      {showMoveSub && (
                        <div className="mt-0.5 ml-1 rounded-lg border border-app-glass/[0.06] bg-app-panel p-0.5 max-h-40 overflow-y-auto">
                          {otherVoice.map((ch) => (
                            <button
                              key={ch.id}
                              type="button"
                              onClick={async () => {
                                await onMoveToChannel?.(vu.userId, ch.id)
                                closeMenu()
                              }}
                              className="w-full px-2.5 py-1.5 rounded-md text-[12px] text-left text-app-text hover:bg-app-accent hover:text-white flex items-center gap-2"
                            >
                              <VoiceIcon className="opacity-70 flex-shrink-0" />
                              <span className="truncate">{ch.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {canMute && (
                    <button
                      type="button"
                      onClick={async () => {
                        await onMuteInVoice?.(vu.userId)
                        closeMenu()
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg text-[13px] text-left text-app-text hover:bg-app-accent hover:text-white"
                    >
                      Server Mute
                    </button>
                  )}
                  {canDisconnect && (
                    <button
                      type="button"
                      onClick={async () => {
                        await onDisconnectFromVoice?.(vu.userId)
                        closeMenu()
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg text-[13px] text-left text-red-400 hover:bg-red-500/20"
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SortableChannelItem({
  channel,
  currentChannelId,
  onSelectChannel,
  voiceUsers,
  voiceChannels,
  hasUnread,
  hasMention,
  onUpdateChannel,
  onDeleteChannel,
  onMoveToChannel,
  onMuteInVoice,
  onDisconnectFromVoice,
  onWatchScreenShare,
  canEdit,
  canModerate,
  currentUserId,
}: {
  channel: Channel
  currentChannelId: string | null
  onSelectChannel: (ch: Channel) => void
  voiceUsers: Record<string, VoiceUserInfo[]>
  voiceChannels: Channel[]
  hasUnread?: boolean
  hasMention?: boolean
  onUpdateChannel?: (channelId: string, data: { name?: string; order?: number; categoryId?: string | null }) => Promise<void>
  onDeleteChannel?: (channelId: string) => Promise<void>
  onWatchScreenShare?: (userId: string) => void
  onMoveToChannel?: (userId: string, channelId: string) => Promise<void>
  onMuteInVoice?: (userId: string) => Promise<void>
  onDisconnectFromVoice?: (userId: string) => Promise<void>
  canEdit?: boolean
  canModerate?: boolean
  currentUserId?: string
}) {
  const [showMenu, setShowMenu] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(channel.name)
  const menuRef = useRef<HTMLDivElement>(null)
  const shouldRenderMenu = useGsapMenu(showMenu, menuRef, {
    enterY: -6,
    exitY: -4,
    transformOrigin: 'top right',
  })

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

  const voiceUsersList = voiceUsers[channel.id] || []
  const isSelected = currentChannelId === channel.id
  const isVoice = channel.type === 'voice'

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'opacity-50' : ''}>
      <div className="group/ch flex items-stretch gap-0.5">
        {canEdit && (
          <button
            {...attributes}
            {...listeners}
            className="self-start mt-2 p-0.5 rounded-md text-app-muted/50 hover:text-app-text hover:bg-app-glass/[0.05] cursor-grab active:cursor-grabbing flex-shrink-0 opacity-0 group-hover/ch:opacity-100 group-focus-within/ch:opacity-100 max-lg:opacity-100 transition-opacity touch-none"
            title="Drag to reorder"
            onClick={(e) => e.preventDefault()}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 6h2v2H8V6zm0 5h2v2H8v-2zm0 5h2v2H8v-2zm5-10h2v2h-2V6zm0 5h2v2h-2v-2zm0 5h2v2h-2v-2z" />
            </svg>
          </button>
        )}
        <div className="flex-1 min-w-0 relative">
          {editing ? (
            <div className="flex items-center gap-1 px-2 py-1">
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit()
                  if (e.key === 'Escape') {
                    setEditName(channel.name)
                    setEditing(false)
                  }
                }}
                onBlur={handleSaveEdit}
                className="flex-1 px-2 py-1 rounded-lg bg-app-dark text-sm text-app-text border border-app-glass/10"
              />
            </div>
          ) : (
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => onSelectChannel(channel)}
                className={`relative flex-1 min-w-0 flex items-center gap-2.5 text-left rounded-xl px-2.5 py-2 transition-colors ${
                  isSelected
                    ? isVoice
                      ? 'bg-app-accent/15 text-app-text'
                      : 'bg-app-glass/[0.08] text-app-text'
                    : channel.type === 'text' && hasMention
                      ? 'bg-red-500/12 text-app-text font-semibold hover:bg-red-500/18'
                      : channel.type === 'text' && hasUnread
                        ? 'bg-app-glass/[0.05] text-app-text hover:bg-app-glass/[0.08] font-medium'
                        : 'text-app-muted hover:bg-app-glass/[0.04] hover:text-app-text'
                }`}
              >
                {isSelected && (
                  <span
                    className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-app-accent"
                    aria-hidden
                  />
                )}
                <span
                  className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isVoice
                      ? isSelected
                        ? 'bg-app-accent/25 text-app-accent'
                        : 'bg-app-glass/[0.04] text-app-muted'
                      : isSelected
                        ? 'bg-app-glass/[0.08] text-app-text'
                        : 'bg-app-glass/[0.03] text-app-muted'
                  }`}
                >
                  {channel.type === 'text' ? (
                    <ChatIcon />
                  ) : channel.type === 'rules' ? (
                    <RulesIcon />
                  ) : (
                    <VoiceIcon />
                  )}
                </span>
                <span className="text-[13px] font-medium truncate flex-1 min-w-0 tracking-tight">
                  {channel.name}
                </span>
                {isVoice && voiceUsersList.length > 0 && (
                  <span className="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md bg-app-glass/[0.06] text-app-muted flex-shrink-0">
                    {voiceUsersList.length}
                  </span>
                )}
                {hasMention && (
                  <span className="w-5 h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold flex-shrink-0">
                    @
                  </span>
                )}
              </button>
              {canEdit && (
                <div className="relative">
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="p-1.5 rounded-lg text-app-muted hover:text-app-text hover:bg-app-glass/[0.05] opacity-0 group-hover/ch:opacity-100 group-focus-within/ch:opacity-100 max-lg:opacity-100 transition-opacity"
                    title="Channel options"
                  >
                    <MoreIcon />
                  </button>
                  {shouldRenderMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                      <div
                        ref={menuRef}
                        className="absolute right-0 top-full mt-1 z-50 min-w-[132px] rounded-xl border border-app-glass/[0.08] bg-app-panel p-1 shadow-2xl"
                      >
                        <button
                          onClick={() => {
                            setEditing(true)
                            setShowMenu(false)
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg text-[13px] text-app-text hover:bg-app-accent hover:text-white text-left"
                        >
                          Rename
                        </button>
                        <button
                          onClick={async () => {
                            if (onDeleteChannel && confirm(`Delete channel "${channel.name}"?`)) {
                              await onDeleteChannel(channel.id)
                            }
                            setShowMenu(false)
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg text-[13px] text-red-400 hover:bg-red-500/20 text-left"
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          {isVoice && (
            <div
              ref={setDropRef}
              className={
                voiceUsersList.length > 0 || isOver
                  ? `mt-1 ml-1 pl-2 border-l space-y-0.5 transition-colors ${
                      isOver
                        ? 'border-app-accent/60 bg-app-accent/10 rounded-r-xl py-1'
                        : 'border-app-glass/[0.06] py-0.5'
                    }`
                  : 'min-h-[2px]'
              }
            >
              {voiceUsersList.length === 0 && isOver && (
                <div className="px-2 py-2 text-[11px] text-app-accent/90 font-medium">Drop to move here</div>
              )}
              {voiceUsersList.map((vu) => (
                <VoiceUserRow
                  key={vu.userId}
                  vu={vu}
                  currentChannelId={channel.id}
                  voiceChannels={voiceChannels}
                  canModerate={!!canModerate}
                  isSelf={vu.userId === currentUserId}
                  onMoveToChannel={onMoveToChannel}
                  onMuteInVoice={onMuteInVoice}
                  onDisconnectFromVoice={onDisconnectFromVoice}
                  onWatchScreenShare={onWatchScreenShare}
                />
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
      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg group cursor-pointer ${isOver ? 'bg-app-accent/15' : ''}`}
      onClick={onToggle}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        className={`text-app-muted/80 transition-transform flex-shrink-0 ${collapsed ? '-rotate-90' : ''}`}
      >
        <path d="M2 3L5 6L8 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </svg>
      <span className="font-display text-[12px] font-semibold text-app-muted/90 tracking-tight truncate flex-1 hover:text-app-text transition-colors">
        Channels
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onAddChannel()
        }}
        className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 max-lg:opacity-100 text-app-muted hover:text-app-text transition-all p-1 rounded-md hover:bg-app-glass/[0.05]"
        title="Create Channel"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
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
  const menuRef = useRef<HTMLDivElement>(null)
  const shouldRenderMenu = useGsapMenu(showMenu, menuRef, {
    enterY: -6,
    exitY: -4,
    transformOrigin: 'top left',
  })

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
          className="flex-1 px-2 py-1 rounded-lg bg-app-dark text-[12px] font-display font-semibold text-app-text border border-app-glass/10"
        />
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg group cursor-pointer ${isDragging ? 'opacity-50' : ''} ${isOver ? 'bg-app-accent/15' : ''}`}
      onClick={onToggle}
    >
      <button
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="p-0.5 rounded-md text-app-muted/50 hover:text-app-text hover:bg-app-glass/[0.05] cursor-grab active:cursor-grabbing flex-shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 max-lg:opacity-100 transition-opacity touch-none"
        title="Drag to reorder"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 6h2v2H8V6zm0 5h2v2H8v-2zm0 5h2v2H8v-2zm5-10h2v2h-2V6zm0 5h2v2h-2v-2zm0 5h2v2h-2v-2z" />
        </svg>
      </button>
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        className={`text-app-muted/80 transition-transform flex-shrink-0 ${collapsed ? '-rotate-90' : ''}`}
      >
        <path d="M2 3L5 6L8 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </svg>
      <span className="font-display text-[12px] font-semibold text-app-muted/90 tracking-tight truncate flex-1 hover:text-app-text transition-colors">
        {category.name}
      </span>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 max-lg:opacity-100 transition-all">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onAddChannel(category.id)
          }}
          className="p-1 rounded-md text-app-muted hover:text-app-text hover:bg-app-glass/[0.05]"
          title="Create Channel"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
        {canEdit && (
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(!showMenu)
              }}
              className="p-1 rounded-md text-app-muted hover:text-app-text hover:bg-app-glass/[0.05]"
              title="Category options"
            >
              <MoreIcon />
            </button>
            {shouldRenderMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div
                  ref={menuRef}
                  className="absolute left-0 top-full mt-1 z-50 min-w-[132px] rounded-xl border border-app-glass/[0.08] bg-app-panel p-1 shadow-2xl"
                >
                  <button
                    onClick={() => {
                      setEditing(true)
                      setShowMenu(false)
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg text-[13px] text-app-text hover:bg-app-accent hover:text-white text-left"
                  >
                    Rename
                  </button>
                  <button
                    onClick={async () => {
                      if (
                        onDeleteCategory &&
                        confirm(`Delete category "${category.name}"? Channels will become uncategorized.`)
                      ) {
                        await onDeleteCategory(category.id)
                      }
                      setShowMenu(false)
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg text-[13px] text-red-400 hover:bg-red-500/20 text-left"
                  >
                    Delete
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
  allVoiceChannels,
  currentChannelId,
  onSelectChannel,
  onAddChannel,
  onUpdateChannel,
  onUpdateCategory,
  onDeleteChannel,
  onDeleteCategory,
  onMoveToChannel,
  onMuteInVoice,
  onDisconnectFromVoice,
  onWatchScreenShare,
  voiceUsers,
  channelUnreadCounts,
  channelMentionCounts,
  canEdit,
  canModerate,
  currentUserId,
}: {
  category: Category | null
  channels: Channel[]
  allVoiceChannels: Channel[]
  currentChannelId: string | null
  onSelectChannel: (ch: Channel) => void
  onAddChannel: (catId?: string) => void
  onUpdateChannel?: (channelId: string, data: { name?: string; order?: number; categoryId?: string | null }) => Promise<void>
  onUpdateCategory?: (catId: string, data: { name?: string }) => Promise<void>
  onDeleteChannel?: (channelId: string) => Promise<void>
  onDeleteCategory?: (catId: string) => Promise<void>
  onMoveToChannel?: (userId: string, channelId: string) => Promise<void>
  onMuteInVoice?: (userId: string) => Promise<void>
  onDisconnectFromVoice?: (userId: string) => Promise<void>
  onWatchScreenShare?: (userId: string) => void
  voiceUsers: Record<string, VoiceUserInfo[]>
  channelUnreadCounts?: Record<string, number>
  channelMentionCounts?: Record<string, number>
  canEdit?: boolean
  canModerate?: boolean
  currentUserId?: string
}) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="mt-5 first:mt-2">
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
          <div className="mt-1 space-y-1 px-1.5">
            {channels.map((channel) => (
              <SortableChannelItem
                key={channel.id}
                channel={channel}
                currentChannelId={currentChannelId}
                onSelectChannel={onSelectChannel}
                voiceUsers={voiceUsers}
                voiceChannels={allVoiceChannels}
                hasUnread={channel.type === 'text' && (channelUnreadCounts?.[channel.id] ?? 0) > 0}
                hasMention={channel.type === 'text' && (channelMentionCounts?.[channel.id] ?? 0) > 0}
                onUpdateChannel={onUpdateChannel}
                onDeleteChannel={onDeleteChannel}
                onMoveToChannel={onMoveToChannel}
                onMuteInVoice={onMuteInVoice}
                onDisconnectFromVoice={onDisconnectFromVoice}
                onWatchScreenShare={onWatchScreenShare}
                canEdit={canEdit}
                canModerate={canModerate}
                currentUserId={currentUserId}
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
  serverBannerUrl,
  onCreateChannel,
  onCreateCategory,
  onReorderChannels,
  onUpdateChannel,
  onUpdateCategory,
  onReorderCategories,
  onDeleteChannel,
  onDeleteCategory,
  onMoveToChannel,
  onMuteInVoice,
  onDisconnectFromVoice,
  onWatchScreenShare,
  isAdminOrOwner = false,
  voiceConnection,
  voiceUsers,
  onOpenServerSettings,
  onInvitePeople,
  onOpenCommunity,
  serverId,
  isOwner,
  hasNoServers,
  isFriendsView = false,
  dmConversations = [],
  currentDMId,
  dmUnreadCounts = {},
  channelUnreadCounts = {},
  channelMentionCounts = {},
  onSelectDM,
}: ChannelListProps) {
  const { user } = useApp()
  const allVoiceChannels = channels.filter((c) => c.type === 'voice')
  const [showCreateChannel, setShowCreateChannel] = useState(false)
  const [createChannelCategoryId, setCreateChannelCategoryId] = useState<string | undefined>()
  const [showServerMenu, setShowServerMenu] = useState(false)
  const [serverProfileBusy, setServerProfileBusy] = useState(false)
  const serverMenuRef = useRef<HTMLDivElement>(null)
  const shouldRenderServerMenu = useGsapMenu(showServerMenu, serverMenuRef, {
    enterY: -8,
    exitY: -6,
    transformOrigin: 'top center',
  })

  const setMyServerProfile = async (profileType: ProfileType) => {
    if (!serverId || !user?.id) return
    setServerProfileBusy(true)
    try {
      await api.setServerMemberProfile(serverId, user.id, profileType)
      setShowServerMenu(false)
    } catch {
      /* ignore — migration may not be applied yet */
    } finally {
      setServerProfileBusy(false)
    }
  }

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

      // Reorder categories (dropping on another category or uncategorized = move to end)
      if (activeStr.startsWith(CATEGORY_PREFIX) && overStr.startsWith(CATEGORY_PREFIX)) {
        const oldIndex = categories.findIndex((c) => `${CATEGORY_PREFIX}${c.id}` === activeStr)
        const overCatId = overStr.slice(CATEGORY_PREFIX.length)
        const newIndex = overCatId === UNCATEGORIZED_ID
          ? categories.length - 1
          : categories.findIndex((c) => c.id === overCatId)
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
        {/* Server Banner */}
        {serverBannerUrl && !hasNoServers && !isFriendsView && (
          <div className="w-full h-20 flex-shrink-0 overflow-hidden">
            <img
              src={serverBannerUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}
        {/* Server / Friends Header */}
        <div className="relative">
          <button
            onClick={() => {
              if (isFriendsView) return
              if (hasNoServers) onOpenCommunity?.()
              else setShowServerMenu(!showServerMenu)
            }}
            className="w-full h-12 px-4 flex items-center justify-between border-b border-app-dark/80 text-app-text font-semibold shadow-sm hover:bg-app-hover/50 transition-colors"
          >
            <span className="font-display truncate">
              {isFriendsView ? 'Friends' : hasNoServers ? 'Explore' : (serverName ?? 'Server')}
            </span>
            {!isFriendsView && (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                className={`text-app-muted transition-transform flex-shrink-0 ${showServerMenu ? 'rotate-180' : ''}`}
              >
                <path d="M7 10L12 15L17 10" />
              </svg>
            )}
          </button>

          {/* Server dropdown menu */}
          {shouldRenderServerMenu && !hasNoServers && !isFriendsView && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowServerMenu(false)} />
              <div ref={serverMenuRef} className="absolute top-12 left-2 right-2 z-50 bg-app-panel rounded-lg shadow-xl p-1.5 border border-app-hover/30">
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
                {isAdminOrOwner && (
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
                {!user?.is_guest && user?.id && serverId && (
                  <>
                    <div className="h-px bg-app-hover/50 my-1" />
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase text-app-muted tracking-wider">
                      Appear as on this server
                    </div>
                    <button
                      type="button"
                      disabled={serverProfileBusy}
                      onClick={() => setMyServerProfile('personal')}
                      className="w-full px-2 py-1.5 rounded text-sm text-app-text hover:bg-app-accent hover:text-white text-left disabled:opacity-50"
                    >
                      Personal profile
                    </button>
                    <button
                      type="button"
                      disabled={serverProfileBusy}
                      onClick={() => setMyServerProfile('work')}
                      className="w-full px-2 py-1.5 rounded text-sm text-app-text hover:bg-app-accent hover:text-white text-left disabled:opacity-50"
                    >
                      Work profile
                    </button>
                  </>
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
                        ? 'bg-app-hover/60 text-app-text'
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
          {isFriendsView ? (
            <div className="p-4 text-center">
              <p className="text-sm text-app-muted">
                Your DMs are listed above. Select a conversation or add friends from the Friends tab.
              </p>
            </div>
          ) : hasNoServers && onOpenCommunity ? (
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
          <DndContext sensors={sensors} collisionDetection={categoryAwareCollisionDetection} onDragEnd={handleGlobalDragEnd}>
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
                  allVoiceChannels={allVoiceChannels}
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
                  onMuteInVoice={onMuteInVoice}
                  onDisconnectFromVoice={onDisconnectFromVoice}
                  onWatchScreenShare={onWatchScreenShare}
                  voiceUsers={voiceUsers}
                  channelUnreadCounts={channelUnreadCounts}
                  channelMentionCounts={channelMentionCounts}
                  canEdit={isOwner}
                  canModerate={isAdminOrOwner}
                  currentUserId={user?.id}
                />
              ))}

              {/* Uncategorized channels */}
              {uncategorizedChannels.length > 0 && (
                <CategorySection
                  category={null}
                  channels={uncategorizedChannels}
                  allVoiceChannels={allVoiceChannels}
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
                  onMuteInVoice={onMuteInVoice}
                  onDisconnectFromVoice={onDisconnectFromVoice}
                  onWatchScreenShare={onWatchScreenShare}
                  voiceUsers={voiceUsers}
                  channelUnreadCounts={channelUnreadCounts}
                  channelMentionCounts={channelMentionCounts}
                  canEdit={isOwner}
                  canModerate={isAdminOrOwner}
                  currentUserId={user?.id}
                />
              )}
            </SortableContext>
          </DndContext>
          )}
        </div>

        {/* Voice Connection Bar (shown only when in voice on THIS server) */}
        {voiceConnection && channels.some((c) => c.id === voiceConnection.channelId) && (
          <div className="border-t border-app-dark/80 bg-app-dark px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                {/* Ping bars: 3 green (<100ms), 2 yellow (<200ms), 1 red (≥200ms). Hover shows ms. */}
                <div
                  className="relative group flex items-end gap-0.5 h-4 w-fit cursor-default mb-1"
                  title={voiceConnection.ping != null ? `${voiceConnection.ping}ms` : 'Measuring ping…'}
                  aria-label={voiceConnection.ping != null ? `Ping ${voiceConnection.ping} milliseconds` : 'Measuring ping'}
                >
                  {(() => {
                    const ping = voiceConnection.ping
                    // 3 bars green = good, 2 yellow = ok, 1 red = high
                    const bars = ping == null ? 0 : ping < 100 ? 3 : ping < 200 ? 2 : 1
                    const barColor =
                      bars === 3 ? 'bg-[#23a559]' : bars === 2 ? 'bg-[#f0b232]' : bars === 1 ? 'bg-[#f23f43]' : 'bg-app-muted/50'
                    const inactive = 'bg-[#4e5058]'
                    return (
                      <>
                        <div className={`w-1 rounded-sm ${bars >= 1 ? barColor : inactive}`} style={{ height: 6 }} />
                        <div className={`w-1 rounded-sm ${bars >= 2 ? barColor : inactive}`} style={{ height: 10 }} />
                        <div className={`w-1 rounded-sm ${bars >= 3 ? barColor : inactive}`} style={{ height: 14 }} />
                        <span
                          role="tooltip"
                          className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 whitespace-nowrap rounded bg-app-panel px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-20"
                        >
                          {ping != null ? `${ping}ms` : 'Measuring…'}
                        </span>
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
                      ? 'bg-app-glass/10 text-app-text'
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
                      ? 'bg-app-glass/10 text-app-text'
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
            canCreateRules={isAdminOrOwner}
          />
        )}
      </div>
    </>
  )
}
