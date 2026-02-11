/**
 * Supabase Realtime subscriptions for instant message and reaction updates.
 * Requires messages and message_reactions tables to be in supabase_realtime publication.
 */

import { supabase } from './supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type MessagePayload = {
  id: string
  channel_id: string
  user_id: string
  content: string
  created_at: string
  edited_at?: string
  reply_to_id?: string
  attachments?: { url: string; type: string; filename?: string }[]
}

export type ReactionPayload = {
  message_id: string
  user_id: string
  emoji: string
}

export function subscribeToChannelMessages(
  channelId: string,
  onMessage: (payload: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: MessagePayload; old?: MessagePayload }) => void
): RealtimeChannel | null {
  if (!supabase) return null

  const channel = supabase
    .channel(`messages:${channelId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `channel_id=eq.${channelId}`,
      },
      (payload) => {
        onMessage({
          eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
          new: payload.new as MessagePayload,
          old: payload.old as MessagePayload,
        })
      }
    )
    .subscribe()

  return channel
}

export function subscribeToReactions(
  channelId: string,
  onReaction: (payload: { eventType: 'INSERT' | 'DELETE'; new: ReactionPayload; old?: ReactionPayload }) => void
): RealtimeChannel | null {
  if (!supabase) return null

  // Subscribe to all message_reactions; filter by message_id in current channel in the caller
  const channel = supabase
    .channel(`reactions:${channelId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'message_reactions',
      },
      (payload) => {
        const rec = (payload.new || payload.old) as ReactionPayload
        if (rec) {
          onReaction({
            eventType: payload.eventType as 'INSERT' | 'DELETE',
            new: payload.new as ReactionPayload,
            old: payload.old as ReactionPayload,
          })
        }
      }
    )
    .subscribe()

  return channel
}

export function unsubscribe(channel: RealtimeChannel | null) {
  if (channel && supabase) {
    supabase.removeChannel(channel)
  }
}
