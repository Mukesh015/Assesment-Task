import { Router } from 'express'
import type { Server } from 'socket.io'
import { requireAdmin } from '../middleware/admin-auth'
import { asyncHandler } from '../middleware/async-handler'
import { HttpError } from '../middleware/http-error'
import { emitResults } from '../realtime/socket'
import { castVote, createPoll, getResults, listNominees } from '../services/poll.service'

type VoteBody = {
  nomineeId?: number
  sessionId?: string
}

type CreatePollBody = {
  title?: string
  description?: string
  nominees?: Array<{
    name?: string
    party?: string
    description?: string
    color?: string
  }>
}

export const createPollRouter = (io: Server) => {
  const router = Router()

  router.get('/health', (_request, response) => {
    response.json({ status: 'ok' })
  })

  router.get(
    '/nominees',
    asyncHandler(async (_request, response) => {
      response.json(await listNominees())
    }),
  )

  router.get(
    '/results',
    asyncHandler(async (_request, response) => {
      response.json(await getResults())
    }),
  )

  router.post(
    '/admin/polls',
    requireAdmin,
    asyncHandler(async (request, response) => {
      const results = await createPoll(request.body as CreatePollBody)
      io.to('admins').emit('results:update', results)

      response.status(201).json({
        message: 'Poll created successfully.',
        results,
      })
    }),
  )

  router.get(
    '/admin/results',
    requireAdmin,
    asyncHandler(async (_request, response) => {
      response.json(await getResults())
    }),
  )

  router.post(
    '/votes',
    asyncHandler(async (request, response) => {
      const { nomineeId, sessionId } = request.body as VoteBody

      if (typeof nomineeId !== 'number' || typeof sessionId !== 'string') {
        throw new HttpError(400, 'Nominee and session id are required.')
      }

      await castVote({ nomineeId, sessionId })
      const results = await emitResults(io)

      response.status(201).json({
        message: 'Your vote has been recorded.',
        results,
      })
    }),
  )

  return router
}
