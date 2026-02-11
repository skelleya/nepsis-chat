export function registerVoiceHandlers(io) {
  io.on('connection', (socket) => {
    socket.on('join-voice', ({ channelId, userId, username }) => {
      const room = `voice:${channelId}`

      // Collect existing peers in the room BEFORE this socket joins
      const existingPeers = []
      const roomSockets = io.of('/voice').adapter.rooms.get(room)
      if (roomSockets) {
        for (const sid of roomSockets) {
          const s = io.of('/voice').sockets.get(sid)
          if (s && s.userId) {
            existingPeers.push({ socketId: sid, userId: s.userId, username: s.username })
          }
        }
      }

      socket.voiceChannel = channelId
      socket.userId = userId
      socket.username = username
      socket.join(room)

      // Send existing peers to the new joiner so they know who's already here
      socket.emit('room-peers', { peers: existingPeers })

      // Notify existing peers about the new joiner
      socket.to(room).emit('peer-joined', { socketId: socket.id, userId, username })
    })

    socket.on('leave-voice', ({ channelId, userId }) => {
      const room = `voice:${channelId}`
      socket.to(room).emit('peer-left', { userId })
      socket.leave(room)
      socket.voiceChannel = null
      socket.userId = null
      socket.username = null
    })

    // FIX: Forward fromUsername in all signaling messages so remote peers
    // show actual usernames instead of socket IDs
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

    socket.on('disconnect', () => {
      if (socket.voiceChannel && socket.userId) {
        io.to(`voice:${socket.voiceChannel}`).emit('peer-left', { userId: socket.userId })
      }
    })
  })
}
