import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { app } from './app.js';
import './models/index.js';

async function bootstrap(): Promise<void> {
  await connectDatabase();

  app.listen(env.port, () => {
    console.log(`API running at http://localhost:${env.port}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
