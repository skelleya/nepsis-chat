/**
 * DM Call signaling — handles call initiation, ringing, accept/decline,
 * and forwards WebRTC offer/answer/ICE between exactly two peers.
 *
 * Socket events:
 *   register           → { userId, username }     — map socket to user
 *   call:initiate      → { targetUserId, callId } — start a call
 *   call:accept        → { callId }               — callee accepts
 *   call:decline       → { callId }               — callee declines
 *   call:end           → { callId }               — either party ends
 *   call:offer/answer  → { callId, sdp }          — WebRTC SDP exchange
 *   call:ice-candidate → { callId, candidate }    — WebRTC ICE
 *
 * Server → client events:
 *   call:incoming      → { callId, callerId, callerUsername, callerAvatarUrl? }
 *   call:accepted      → { callId }
 *   call:declined      → { callId }
 *   call:ended         → { callId }
 *   call:unavailable   → { callId, reason }
 */

import supabase from '../db/supabase.js'

// userId → Set<socketId>
const userSockets = new Map()

// callId → { callerId, calleeId, callerSocketId, calleeSocketId, status }
const activeCalls = new Map()

export function registerCallHandlers(io) {
  io.on('connection', (socket) => {
    // ─── Register user identity ───────────────────────────────────
    socket.on('register', ({ userId, username }) => {
      socket.userId = userId
      socket.username = username
      if (!userSockets.has(userId)) userSockets.set(userId, new Set())
      userSockets.get(userId).add(socket.id)
    })

    // ─── Initiate a call ──────────────────────────────────────────
    socket.on('call:initiate', async ({ targetUserId, callId }) => {
      const targetSids = userSockets.get(targetUserId)
      if (!targetSids || targetSids.size === 0) {
        socket.emit('call:unavailable', { callId, reason: 'User is offline' })
        return
      }

      // Check if target is already in a call
      for (const [, call] of activeCalls) {
        if (
          (call.callerId === targetUserId || call.calleeId === targetUserId) &&
          call.status !== 'ended'
        ) {
          socket.emit('call:unavailable', { callId, reason: 'User is busy' })
          return
        }
      }

      activeCalls.set(callId, {
        callerId: socket.userId,
        calleeId: targetUserId,
        callerSocketId: socket.id,
        calleeSocketId: null,
        status: 'ringing',
      })

      // Fetch caller avatar for incoming call display
      let callerAvatarUrl = null
      try {
        const { data } = await supabase.from('users').select('avatar_url').eq('id', socket.userId).single()
        if (data?.avatar_url) callerAvatarUrl = data.avatar_url
      } catch { /* ignore */ }

      // Ring all of callee's connected sockets
      for (const sid of targetSids) {
        io.to(sid).emit('call:incoming', {
          callId,
          callerId: socket.userId,
          callerUsername: socket.username,
          callerAvatarUrl,
        })
      }
    })

    // ─── Accept ───────────────────────────────────────────────────
    socket.on('call:accept', ({ callId }) => {
      const call = activeCalls.get(callId)
      if (!call || call.status !== 'ringing') return
      call.status = 'active'
      call.calleeSocketId = socket.id
      io.to(call.callerSocketId).emit('call:accepted', { callId })
    })

    // ─── Decline ──────────────────────────────────────────────────
    socket.on('call:decline', ({ callId }) => {
      const call = activeCalls.get(callId)
      if (!call) return
      call.status = 'ended'
      io.to(call.callerSocketId).emit('call:declined', { callId })
      activeCalls.delete(callId)
    })

    // ─── End call ─────────────────────────────────────────────────
    socket.on('call:end', ({ callId }) => {
      const call = activeCalls.get(callId)
      if (!call) return
      call.status = 'ended'
      const otherSid =
        socket.id === call.callerSocketId ? call.calleeSocketId : call.callerSocketId
      if (otherSid) io.to(otherSid).emit('call:ended', { callId })
      activeCalls.delete(callId)
    })

    // ─── WebRTC signaling (forwarded between caller ↔ callee) ────
    socket.on('call:offer', ({ callId, sdp }) => {
      const call = activeCalls.get(callId)
      if (!call) return
      const targetSid =
        socket.id === call.callerSocketId ? call.calleeSocketId : call.callerSocketId
      if (targetSid) io.to(targetSid).emit('call:offer', { callId, sdp })
    })

    socket.on('call:answer', ({ callId, sdp }) => {
      const call = activeCalls.get(callId)
      if (!call) return
      const targetSid =
        socket.id === call.callerSocketId ? call.calleeSocketId : call.callerSocketId
      if (targetSid) io.to(targetSid).emit('call:answer', { callId, sdp })
    })

    socket.on('call:ice-candidate', ({ callId, candidate }) => {
      const call = activeCalls.get(callId)
      if (!call) return
      const targetSid =
        socket.id === call.callerSocketId ? call.calleeSocketId : call.callerSocketId
      if (targetSid) io.to(targetSid).emit('call:ice-candidate', { callId, candidate })
    })

    // ─── Cleanup on disconnect ────────────────────────────────────
    socket.on('disconnect', () => {
      // Remove from user socket map
      if (socket.userId) {
        const sids = userSockets.get(socket.userId)
        if (sids) {
          sids.delete(socket.id)
          if (sids.size === 0) userSockets.delete(socket.userId)
        }
      }

      // End any active calls this socket was part of
      for (const [callId, call] of activeCalls) {
        if (call.callerSocketId === socket.id || call.calleeSocketId === socket.id) {
          const otherSid =
            call.callerSocketId === socket.id ? call.calleeSocketId : call.callerSocketId
          if (otherSid) io.to(otherSid).emit('call:ended', { callId })
          activeCalls.delete(callId)
        }
      }
    })
  })
}
