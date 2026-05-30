import type { CorsOptions } from 'cors';
import { env } from './env.js';

/** Local dev: Vite 5173, Expo web 8081, alternate host forms. */
const DEV_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

export function buildCorsOptions(): CorsOptions {
  const allowedHeaders = ['Content-Type', 'Authorization'];
  const methods = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'];

  if (env.corsOrigins === true) {
    return { origin: true, credentials: true, methods, allowedHeaders };
  }

  const allowedList = env.corsOrigins as string[];

  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (env.nodeEnv === 'development' && DEV_ORIGIN_RE.test(origin)) {
        callback(null, origin);
        return;
      }
      if (allowedList.includes(origin)) {
        callback(null, origin);
        return;
      }
      callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
    methods,
    allowedHeaders,
    optionsSuccessStatus: 204,
  };
}
