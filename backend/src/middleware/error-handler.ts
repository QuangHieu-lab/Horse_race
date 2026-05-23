import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/api-error.js';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
    });
    return;
  }

  if (err instanceof Error && err.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      message: err.message,
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  if (
    err instanceof Error &&
    'type' in err &&
    (err as { type?: string }).type === 'entity.parse.failed'
  ) {
    res.status(400).json({
      success: false,
      message: 'Invalid JSON body',
      code: 'INVALID_JSON',
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
}
