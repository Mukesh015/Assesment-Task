import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { AppDataSource } from '../database/data-source'
import { AdminUser } from '../entities/AdminUser'
import { requireAdmin, signAdminToken } from '../middleware/admin-auth'
import { asyncHandler } from '../middleware/async-handler'
import { HttpError } from '../middleware/http-error'

type LoginBody = {
  username?: string
  password?: string
}

export const createAuthRouter = () => {
  const router = Router()

  router.post(
    '/admin/login',
    asyncHandler(async (request, response) => {
      const { username, password } = request.body as LoginBody

      if (!username || !password) {
        throw new HttpError(400, 'Username and password are required.')
      }

      const admin = await AppDataSource.getRepository(AdminUser).findOne({
        where: { username },
      })

      if (!admin) {
        throw new HttpError(401, 'Invalid admin credentials.')
      }

      const passwordMatches = await bcrypt.compare(password, admin.passwordHash)
      if (!passwordMatches) {
        throw new HttpError(401, 'Invalid admin credentials.')
      }

      response.json({
        token: signAdminToken(admin),
        admin: {
          id: admin.id,
          username: admin.username,
        },
      })
    }),
  )

  router.get(
    '/admin/me',
    requireAdmin,
    asyncHandler(async (request, response) => {
      response.json({ admin: request.admin })
    }),
  )

  return router
}
