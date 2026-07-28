import { createApp } from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { backfillMissingJockeyLicenses } from './services/jockey-license.service.js';

async function main(): Promise<void> {
  await connectDatabase();
  try {
    const backfilledLicenses = await backfillMissingJockeyLicenses();
    if (backfilledLicenses > 0) {
      console.log(`Assigned automatic licenses to ${backfilledLicenses} existing Jockey account(s)`);
    }
  } catch (error) {
    console.error('Could not backfill missing Jockey licenses:', error);
  }
  const app = createApp();
  app.listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port}`);
  });
}

main().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
