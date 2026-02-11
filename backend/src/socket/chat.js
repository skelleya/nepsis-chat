export function registerChatHandlers(io) {
  io.on('connection', (socket) => {
    socket.on('join-channel', (channelId) => {
      socket.channelId = channelId
      socket.join(`channel:${channelId}`)
    })

    socket.on('leave-channel', (channelId) => {
      socket.leave(`channel:${channelId}`)
      socket.channelId = null
    })

    socket.on('message', (data) => {
      const { channelId, userId, username, content } = data
      if (!channelId || !userId || !content) return
      socket.to(`channel:${channelId}`).emit('message', {
        id: 'm' + Date.now(),
        channelId,
        userId,
        username: username || userId,
        content,
        createdAt: new Date().toISOString(),
      })
    })

    socket.on('typing', (data) => {
      const { channelId, userId, username } = data
      if (!channelId) return
      socket.to(`channel:${channelId}`).emit('typing', { userId, username })
    })
  })
}
