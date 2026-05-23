import type { Request } from 'express';
import { ApiError } from './api-error.js';

export function paramId(req: Request, name: string): string {
  const v = req.params[name];
  const id = Array.isArray(v) ? v[0] : v;
  if (!id) throw ApiError.badRequest(`Missing param: ${name}`);
  return id;
}
