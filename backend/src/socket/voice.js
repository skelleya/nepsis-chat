/**
 * Voice signaling namespace (/voice).
 * - One active session per userId (new join kicks older sockets)
 * - peer-left only when no remaining sockets for that user in the room
 */

function socketsForUser(io, userId) {
  const out = []
  for (const [, s] of io.sockets.sockets) {
    if (s.userId === userId) out.push(s)
  }
  return out
}

function countUserInRoom(io, room, userId) {
  const roomSockets = io.adapter.rooms.get(room)
  if (!roomSockets || !userId) return 0
  let n = 0
  for (const sid of roomSockets) {
    const s = io.sockets.get(sid)
    if (s?.userId === userId) n++
  }
  return n
}

function emitPeerLeftIfGone(io, room, userId, socketId) {
  if (!room || !userId) return
  if (countUserInRoom(io, room, userId) === 0) {
    io.to(room).emit('peer-left', { userId, socketId })
  }
}

export function registerVoiceHandlers(io) {
  io.on('connection', (socket) => {
    socket.on('join-voice', ({ channelId, userId, username }) => {
      if (!channelId || !userId) return
      const room = `voice:${channelId}`

      // Discord-style: kick any other live voice sessions for this user
      for (const old of socketsForUser(io, userId)) {
        if (old.id === socket.id) continue
        const oldChannel = old.voiceChannel
        const oldRoom = oldChannel ? `voice:${oldChannel}` : null
        try {
          old.emit('voice-session-replaced', {
            reason: 'joined_elsewhere',
            channelId,
          })
        } catch {
          /* ignore */
        }
        if (oldRoom) {
          old.leave(oldRoom)
          old.voiceChannel = null
          // Tell others the old session is gone (new one joins next)
          io.to(oldRoom).emit('peer-left', { userId, socketId: old.id })
        }
        old.userId = null
        old.username = null
        old.disconnect(true)
      }

      // Peers already in this room (after kick, should not include this user)
      const existingPeers = []
      const roomSockets = io.adapter.rooms.get(room)
      if (roomSockets) {
        for (const sid of roomSockets) {
          const s = io.sockets.get(sid)
          if (s?.userId && s.userId !== userId) {
            existingPeers.push({
              socketId: sid,
              userId: s.userId,
              username: s.username,
            })
          }
        }
      }

      socket.voiceChannel = channelId
      socket.userId = userId
      socket.username = username
      socket.join(room)

      socket.emit('room-peers', { peers: existingPeers })
      socket.to(room).emit('peer-joined', {
        socketId: socket.id,
        userId,
        username,
      })
    })

    socket.on('leave-voice', ({ channelId }) => {
      const room = channelId
        ? `voice:${channelId}`
        : socket.voiceChannel
          ? `voice:${socket.voiceChannel}`
          : null
      const uid = socket.userId
      const sid = socket.id
      if (room) socket.leave(room)
      socket.voiceChannel = null
      socket.userId = null
      socket.username = null
      emitPeerLeftIfGone(io, room, uid, sid)
    })

    socket.on('offer', ({ to, sdp }) => {
      io.to(to).emit('offer', {
        from: socket.id,
        fromUserId: socket.userId,
        fromUsername: socket.username,
        sdp,
      })
    })

    socket.on('answer', ({ to, sdp }) => {
      io.to(to).emit('answer', {
        from: socket.id,
        fromUserId: socket.userId,
        fromUsername: socket.username,
        sdp,
      })
    })

    socket.on('ice-candidate', ({ to, candidate }) => {
      io.to(to).emit('ice-candidate', {
        from: socket.id,
        fromUserId: socket.userId,
        fromUsername: socket.username,
        candidate,
      })
    })

    socket.on('soundboard-play', ({ soundUrl, userId: fromUserId, username: fromUsername }) => {
      if (!socket.voiceChannel) return
      const room = `voice:${socket.voiceChannel}`
      io.to(room).emit('soundboard-play', {
        soundUrl,
        userId: fromUserId ?? socket.userId,
        username: fromUsername ?? socket.username,
      })
    })

    socket.on('disconnect', () => {
      const room = socket.voiceChannel ? `voice:${socket.voiceChannel}` : null
      const uid = socket.userId
      const sid = socket.id
      // Socket.IO already removed this socket from rooms; count remaining
      emitPeerLeftIfGone(io, room, uid, sid)
    })
  })
}
