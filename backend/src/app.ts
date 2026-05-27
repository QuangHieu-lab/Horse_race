import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { authenticate } from './middleware/auth.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import { requireRole } from './middleware/require-role.middleware.js';
import { authRouter } from './routes/auth.routes.js';
import { jockeyRouter } from './routes/jockey.routes.js';
import { raceRouter } from './routes/race.routes.js';
import { spectatorRouter } from './routes/spectator.routes.js';
import { tournamentRouter } from './routes/tournament.routes.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/jockey', authenticate, requireRole('jockey'), jockeyRouter);
  app.use('/api/spectator', authenticate, requireRole('spectator'), spectatorRouter);
  app.use('/api/tournaments', authenticate, requireRole('admin'), tournamentRouter);
  app.use('/api/races', authenticate, requireRole('admin'), raceRouter);

  app.use(errorHandler);

  return app;
}
