export function registerVoiceHandlers(io) {
  io.on('connection', (socket) => {
    socket.on('join-voice', ({ channelId, userId, username }) => {
      const room = `voice:${channelId}`
      socket.voiceChannel = channelId
      socket.userId = userId
      socket.username = username
      socket.join(room)
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

    socket.on('offer', ({ to, sdp }) => {
      io.to(to).emit('offer', { from: socket.id, fromUserId: socket.userId, sdp })
    })

    socket.on('answer', ({ to, sdp }) => {
      io.to(to).emit('answer', { from: socket.id, fromUserId: socket.userId, sdp })
    })

    socket.on('ice-candidate', ({ to, candidate }) => {
      io.to(to).emit('ice-candidate', { from: socket.id, fromUserId: socket.userId, candidate })
    })

    socket.on('disconnect', () => {
      if (socket.voiceChannel && socket.userId) {
        io.to(`voice:${socket.voiceChannel}`).emit('peer-left', { userId: socket.userId })
      }
    })
  })
}
