import { DataSource } from 'typeorm'
import { env } from '../config/env'
import { AdminUser } from '../entities/AdminUser'
import { Nominee } from '../entities/Nominee'
import { Poll } from '../entities/Poll'
import { Vote } from '../entities/Vote'

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: env.db.host,
  port: env.db.port,
  username: env.db.username,
  password: env.db.password,
  database: env.db.database,
  charset: 'utf8mb4',
  synchronize: true,
  logging: false,
  entities: [AdminUser, Nominee, Poll, Vote],
})
