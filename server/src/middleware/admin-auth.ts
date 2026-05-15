import type { RequestHandler } from 'express'
import jwt, { type JwtPayload } from 'jsonwebtoken'
import { env } from '../config/env'
import type { AdminUser } from '../entities/AdminUser'
import { HttpError } from './http-error'

type AdminTokenPayload = JwtPayload & {
  username?: string
}

export type AuthenticatedAdmin = {
  id: number
  username: string
}

declare global {
  namespace Express {
    interface Request {
      admin?: AuthenticatedAdmin
    }
  }
}

export const signAdminToken = (admin: AdminUser) =>
  jwt.sign({ username: admin.username }, env.jwtSecret, {
    subject: String(admin.id),
    expiresIn: '8h',
  })

export const verifyAdminToken = (token: string): AuthenticatedAdmin => {
  const payload = jwt.verify(token, env.jwtSecret) as AdminTokenPayload
  const id = Number(payload.sub)

  if (!payload.username || Number.isNaN(id)) {
    throw new HttpError(401, 'Invalid admin token.')
  }

  return {
    id,
    username: payload.username,
  }
}

export const requireAdmin: RequestHandler = (request, _response, next) => {
  const header = request.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    next(new HttpError(401, 'Admin authorization is required.'))
    return
  }

  try {
    request.admin = verifyAdminToken(token)
    next()
  } catch (error) {
    next(error)
  }
}
