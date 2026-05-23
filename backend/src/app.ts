import express from 'express';
import cors from 'cors';
import { getDatabaseState } from './config/database.js';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { apiRouter } from './routes/index.js';

const app = express();

app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'horse-racing-api',
    database: getDatabaseState(),
  });
});

app.get('/', (_req, res) => {
  res.send('Horse Racing API — docs: /api/v1');
});

app.use('/api/v1', apiRouter);

app.use(errorHandler);

export { app };
