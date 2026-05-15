import type { ErrorRequestHandler, RequestHandler } from 'express'

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message)
  }
}

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(new HttpError(404, `Route not found: ${request.method} ${request.path}`))
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const isHttpError = error instanceof HttpError
  const statusCode = isHttpError ? error.statusCode : 500
  const message = isHttpError ? error.message : 'Unexpected server error.'

  if (!isHttpError) {
    console.error(error)
  }

  response.status(statusCode).json({ message })
}
