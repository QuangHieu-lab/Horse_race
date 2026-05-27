import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error.middleware.js';
import tournamentRoutes from './routes/tournament.routes.js';
import { authRouter } from './routes/auth.routes.js';
import raceRoutes from './routes/race.routes.js';
export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/tournaments', tournamentRoutes);
  app.use('/api/races', raceRoutes);
  app.use(errorHandler);

  return app;
}
