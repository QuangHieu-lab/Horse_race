import cors from 'cors';
import express from 'express';
import { buildCorsOptions } from './config/cors.js';
import { setupSwagger } from './config/swagger.js';
import { authenticate } from './middleware/auth.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import { requireRole } from './middleware/require-role.middleware.js';
import { authRouter } from './routes/auth.routes.js';
import { jockeyRouter } from './routes/jockey.routes.js';
import { raceRouter } from './routes/race.routes.js';
import { spectatorRouter } from './routes/spectator.routes.js';
import { tournamentRouter } from './routes/tournament.routes.js';
import { horseOwnerRouter } from './routes/horse-owner.routes.js';
import { adminJobsRouter } from './routes/admin-jobs.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { refereeRouter } from './routes/referee.routes.js';
import { adminRaceMeetingRouter } from './routes/admin-racemeeting.routes.js';
import { adminTrackRouter } from './routes/admin-track.routes.js';
export function createApp() {
  const app = express();
  const corsOptions = buildCorsOptions();

  app.use(cors(corsOptions));
  app.options(/.*/, cors(corsOptions));
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  setupSwagger(app);

  app.use('/api/auth', authRouter);
  app.use('/api/jockey', authenticate, requireRole('jockey'), jockeyRouter);
  app.use('/api/spectator', authenticate, requireRole('spectator'), spectatorRouter);
  app.use('/api/tournaments', authenticate, requireRole('admin'), tournamentRouter);
  app.use('/api/races', authenticate, requireRole('admin'), raceRouter);
  app.use('/api/admin/jobs', authenticate, requireRole('admin'), adminJobsRouter);
  app.use('/api/admin', authenticate, requireRole('admin'), adminRouter);
  app.use('/api/admin/race-meetings', authenticate, requireRole('admin'),adminRaceMeetingRouter);
  app.use('/api/admin/tracks', authenticate, requireRole('admin'), adminTrackRouter);
  app.use('/api/referee', authenticate, requireRole('referee'), refereeRouter);
  app.use('/api/horse-owner', authenticate, requireRole('horse_owner'), horseOwnerRouter);
  app.use('/api/admin/tracks', adminTrackRouter);
  app.use(errorHandler);

  return app;
}
