import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/http-error.js';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ message: err.message, statusCode: err.statusCode });
    return;
  }
  console.error(err);
  res.status(500).json({ message: 'Lỗi máy chủ', statusCode: 500 });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
