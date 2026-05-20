import dotenv from 'dotenv'

dotenv.config()

const stripQuotes = (value: string) => value.replace(/^["']|["']$/g, '')

const required = (key: string) => {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return stripQuotes(value)
}

const numberValue = (key: string, fallback: number) => {
  const rawValue = process.env[key]
  if (!rawValue) {
    return fallback
  }

  const parsed = Number(rawValue)
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number`)
  }

  return parsed
}

export const env = {
  port: numberValue('PORT', 8080),
  jwtSecret: process.env.JWT_SECRET || 'replace-this-before-production',
  db: {
    host: required('DB_HOST'),
    port: numberValue('DB_PORT', 3306),
    username: required('DB_USER'),
    password: required('DB_PASSWORD'),
    database: required('DB_NAME'),
  },
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
  },
}
