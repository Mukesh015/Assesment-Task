import type { Server } from 'socket.io'
import { getResults } from '../services/poll.service'
import { verifyAdminToken } from '../middleware/admin-auth'

export const registerRealtime = (io: Server) => {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token

    if (typeof token !== 'string') {
      next(new Error('Admin token required.'))
      return
    }

    try {
      socket.data.admin = verifyAdminToken(token)
      next()
    } catch {
      next(new Error('Invalid admin token.'))
    }
  })

  io.on('connection', (socket) => {
    void socket.join('admins')

    void getResults()
      .then((results) => {
        socket.emit('results:update', results)
      })
      .catch(() => {
        socket.emit('results:error', { message: 'Unable to load results.' })
      })
  })
}

export const emitResults = async (io: Server) => {
  const results = await getResults()
  io.to('admins').emit('results:update', results)
  return results
}
