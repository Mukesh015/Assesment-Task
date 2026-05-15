import cors from 'cors'
import express, { type Express } from 'express'
import type { Server } from 'socket.io'
import { corsOptions } from './config/cors'
import { createAuthRouter } from './routes/auth.routes'
import { createPollRouter } from './routes/poll.routes'
import { errorHandler, notFoundHandler } from './middleware/http-error'

export const configureApp = (app: Express, io: Server) => {
  app.use(cors(corsOptions))
  app.use(express.json({ limit: '20kb' }))

  app.use('/api', createAuthRouter())
  app.use('/api', createPollRouter(io))

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}