import type { CorsOptions } from 'cors'
import { env } from './env'

const configuredOrigins = env.corsOrigin
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

export const corsOptions: CorsOptions = {
  origin: env.corsOrigin === '*' ? true : configuredOrigins,
  credentials: true,
}
