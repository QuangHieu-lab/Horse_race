import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import '../models/index.js';

const COLLECTIONS = [
  'users',
  'horses',
  'tracks',
  'racemeetings',
  'tournaments',
  'races',
  'raceregistrations',
  'results',
  'jockeyinvitations',
  'predictions',
  'predictionpools',
  'spectatorprofiles',
  'products',
  'redemptions',
  'notifications',
  'auditlogs',
  'organizerledgers',
] as const;

async function main(): Promise<void> {
  await connectDatabase();
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database handle unavailable');

  console.log('\n=== Database check ===');
  console.log(`URI: ${mongoose.connection.host} / ${mongoose.connection.name}`);
  console.log(`State: ${mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'}\n`);

  console.log('Collections:');
  const existing = await db.listCollections().toArray();
  const names = new Set(existing.map((c) => c.name));

  for (const name of COLLECTIONS) {
    if (!names.has(name)) {
      console.log(`  ${name.padEnd(22)} — (empty / not created)`);
      continue;
    }
    const count = await db.collection(name).countDocuments();
    console.log(`  ${name.padEnd(22)} ${count} document(s)`);
  }

  const users = await db.collection('users').find({}, { projection: { email: 1, role: 1 } }).toArray();
  if (users.length > 0) {
    console.log('\nUsers:');
    for (const u of users) {
      console.log(`  - ${u.email} (${u.role})`);
    }
  }

  console.log('\nOK — database reachable.\n');
  await disconnectDatabase();
}

main().catch((err) => {
  console.error('Database check failed:', err.message);
  process.exit(1);
});
