import 'reflect-metadata'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { configureApp } from './app'
import { corsOptions } from './config/cors'
import { env } from './config/env'
import { AppDataSource } from './database/data-source'
import { registerRealtime } from './realtime/socket'
import { seedInitialData } from './seeders/seedInitialData'

const bootstrap = async () => {
  await AppDataSource.initialize()
  await seedInitialData()

  const app = express()
  const httpServer = createServer(app)
  const io = new Server(httpServer, {
    cors: corsOptions,
  })

  registerRealtime(io)
  configureApp(app, io)

  httpServer.listen(env.port, () => {
    console.log(`Polling API listening on port ${env.port}`)
  })
}

void bootstrap().catch((error) => {
  console.error('Failed to start polling API:', error)
  process.exit(1)
})
