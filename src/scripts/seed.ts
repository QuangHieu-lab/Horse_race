/**
 * Seed 1 scenario nhất quán: đua đã xong, result đã confirm, chưa publish.
 * Participants được thêm qua JockeyInvitation accepted (không gán tay).
 * Chạy: npm run db:seed — Mật khẩu: Demo@123
 */
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import {
  User,
  Horse,
  Track,
  RaceMeeting,
  Tournament,
  Race,
  RaceRegistration,
  Result,
  JockeyInvitation,
  Prediction,
  SpectatorProfile,
  Product,
  Notification,
} from '../models/index.js';

const DEMO_PASSWORD = 'Demo@123';

const COLLECTIONS_TO_CLEAR = [
  'auditlogs',
  'organizerledgers',
  'notifications',
  'redemptions',
  'products',
  'predictions',
  'predictionpools',
  'spectatorprofiles',
  'jockeyinvitations',
  'results',
  'raceregistrations',
  'races',
  'racemeetings',
  'tournaments',
  'tracks',
  'horses',
  'users',
];

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function clearDemoData(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;
  for (const name of COLLECTIONS_TO_CLEAR) {
    await db.collection(name).deleteMany({});
  }
}

async function acceptInvitation(
  ownerId: mongoose.Types.ObjectId,
  jockeyId: mongoose.Types.ObjectId,
  horseId: mongoose.Types.ObjectId,
  raceId: mongoose.Types.ObjectId,
  message: string,
): Promise<{ _id: mongoose.Types.ObjectId }> {
  const inv = await JockeyInvitation.create({
    horseOwnerId: ownerId,
    jockeyId,
    horseId,
    raceId,
    status: 'pending',
    message,
  });
  inv.status = 'accepted';
  inv.respondedAt = new Date();
  await inv.save();
  return inv;
}

async function seed(): Promise<void> {
  console.log('Clearing old data…');
  await clearDemoData();

  console.log('Creating users…');
  const users = await User.create([
    {
      email: 'admin@demo.local',
      passwordHash: DEMO_PASSWORD,
      role: 'admin',
      fullName: 'Admin Demo',
      phone: '0900000001',
    },
    {
      email: 'owner@demo.local',
      passwordHash: DEMO_PASSWORD,
      role: 'horse_owner',
      fullName: 'Nguyễn Văn Owner',
      phone: '0900000002',
    },
    {
      email: 'jockey1@demo.local',
      passwordHash: DEMO_PASSWORD,
      role: 'jockey',
      fullName: 'Trần Văn Jockey',
      phone: '0900000003',
      jockeyProfile: { licenseNumber: 'VN-JKY-001', isSuspended: false },
    },
    {
      email: 'jockey2@demo.local',
      passwordHash: DEMO_PASSWORD,
      role: 'jockey',
      fullName: 'Lê Thị Jockey',
      phone: '0900000004',
      jockeyProfile: { licenseNumber: 'VN-JKY-002', isSuspended: false },
    },
    {
      email: 'referee@demo.local',
      passwordHash: DEMO_PASSWORD,
      role: 'referee',
      fullName: 'Phạm Văn Referee',
      phone: '0900000005',
      refereeProfile: { certificationId: 'VN-REF-001' },
    },
    {
      email: 'spectator@demo.local',
      passwordHash: DEMO_PASSWORD,
      role: 'spectator',
      fullName: 'Khách Xem Demo',
      phone: '0900000006',
    },
  ]);
  const admin = users[0]!;
  const owner = users[1]!;
  const jockey1 = users[2]!;
  const jockey2 = users[3]!;
  const referee = users[4]!;
  const spectator = users[5]!;

  console.log('Creating horses…');
  const horses = await Horse.create([
    {
      ownerId: owner._id,
      name: 'Sóng Gió',
      registrationId: 'VN-HORSE-001',
      breed: 'Arabian',
      trainerName: 'Stable Demo A',
      age: 5,
      color: 'Chestnut',
      weight: 450,
      healthStatus: 'fit',
    },
    {
      ownerId: owner._id,
      name: 'Bóng Mây',
      registrationId: 'VN-HORSE-002',
      breed: 'Thoroughbred',
      trainerName: 'Stable Demo A',
      age: 4,
      color: 'Bay',
      weight: 480,
      healthStatus: 'fit',
    },
  ]);
  const horseA = horses[0]!;
  const horseB = horses[1]!;

  console.log('Creating track, tournament, meeting & race…');
  const raceScheduledAt = daysFromNow(7);

  const track = await Track.create({
    name: 'Trường đua Bình Dương',
    location: 'Thủ Dầu Một, Bình Dương',
    countryCode: 'VN',
    surfaceDefault: 'turf',
  });

  const tournament = await Tournament.create({
    name: 'Giải Đua Mùa Xuân 2026',
    description: 'Dữ liệu demo — luồng duyệt đăng ký → mời jockey → đua → kết quả.',
    startDate: daysFromNow(-5),
    endDate: daysFromNow(14),
    location: 'Trường đua Bình Dương',
    status: 'ongoing',
    prizePool: 50_000_000,
    predictionConfig: {
      isEnabled: true,
      pointsPerCorrect: 100,
      bonusPointsTop3: 50,
      predictionOpenAt: daysFromNow(-3),
      predictionCloseAt: daysFromNow(6),
      maxPredictionsPerRace: 1,
      poolEnabled: false,
      entryFee: 0,
      feePercent: 10,
    },
    createdBy: admin._id,
  });

  const meeting = await RaceMeeting.create({
    tournamentId: tournament._id,
    trackId: track._id,
    meetingDate: raceScheduledAt,
    name: 'Buổi đua bán kết — 22/05',
    status: 'scheduled',
  });

  const race = await Race.create({
    tournamentId: tournament._id,
    meetingId: meeting._id,
    trackId: track._id,
    name: 'Bán kết — Vòng 1',
    round: 1,
    raceClass: 'Open',
    scheduledAt: raceScheduledAt,
    distance: 1600,
    surface: 'turf',
    going: 'good',
    weather: 'Nắng nhẹ',
    predictionOpenAt: daysFromNow(-3),
    predictionCloseAt: daysFromNow(6),
    maxParticipants: 8,
    status: 'scheduled',
    refereeId: referee._id,
    participants: [],
  });

  console.log('Registrations (approved)…');
  const regs = await RaceRegistration.create([
    {
      raceId: race._id,
      horseId: horseA._id,
      ownerId: owner._id,
      status: 'approved',
      processedBy: admin._id,
      processedAt: new Date(),
      waiverAcceptedAt: new Date(),
    },
    {
      raceId: race._id,
      horseId: horseB._id,
      ownerId: owner._id,
      status: 'approved',
      processedBy: admin._id,
      processedAt: new Date(),
      waiverAcceptedAt: new Date(),
    },
  ]);
  const regA = regs[0]!;
  const regB = regs[1]!;

  console.log('Invitations → auto-add participants…');
  const inv1 = await acceptInvitation(
    owner._id,
    jockey1._id,
    horseA._id,
    race._id,
    'Mời bạn điều khiển Sóng Gió tại bán kết.',
  );
  const inv2 = await acceptInvitation(
    owner._id,
    jockey2._id,
    horseB._id,
    race._id,
    'Mời bạn điều khiển Bóng Mây tại bán kết.',
  );

  const raceWithParticipants = await Race.findById(race._id);
  if (!raceWithParticipants || raceWithParticipants.participants.length < 2) {
    throw new Error('Seed failed: expected 2 participants after invitations');
  }

  const now = new Date();
  raceWithParticipants.participants = raceWithParticipants.participants.map((p) => ({
    ...p,
    confirmedAt: now,
    vetApprovedAt: now,
    carriedWeight: p.horseId.toString() === horseA._id.toString() ? 56 : 57,
  }));
  raceWithParticipants.status = 'ongoing';
  await raceWithParticipants.save();
  raceWithParticipants.status = 'completed';
  raceWithParticipants.scheduledAt = daysFromNow(-1);
  await raceWithParticipants.save();

  console.log('Creating result (Bóng Mây bị loại — false start)…');
  const result = await Result.create({
    raceId: race._id,
    tournamentId: tournament._id,
    rankings: [
      {
        rank: 1,
        horseId: horseA._id,
        jockeyId: jockey1._id,
        ownerId: owner._id,
        finishTime: 98.42,
        marginBehind: 0,
        prize: 30_000_000,
      },
    ],
    violations: [
      {
        horseId: horseB._id,
        type: 'false_start',
        description: 'Xuất phát sớm — loại khỏi bảng xếp hạng.',
        penaltyApplied: 'disqualify',
        recordedAt: now,
      },
    ],
    confirmedBy: referee._id,
    confirmedAt: now,
    publishedBy: null,
    publishedAt: null,
    reportUrl: null,
  });

  console.log('Spectator profile & prediction…');
  const profile =
    (await SpectatorProfile.findOne({ userId: spectator._id })) ??
    (await SpectatorProfile.create({
      userId: spectator._id,
      totalPointsEarned: 0,
      totalPointsSpent: 0,
      currentBalance: 0,
      transactions: [],
    }));

  const prediction = await Prediction.create({
    spectatorId: spectator._id,
    raceId: race._id,
    tournamentId: tournament._id,
    predictedRanks: [
      { rank: 1, horseId: horseA._id },
      { rank: 2, horseId: horseB._id },
    ],
    status: 'pending',
    pointsEarned: 0,
    bonusPoints: 0,
    totalPoints: 0,
  });

  const product = await Product.create({
    name: 'Voucher xem giải VIP',
    description: 'Đổi 500 điểm — demo redemption.',
    category: 'voucher',
    pointsCost: 500,
    stock: 10,
    isActive: true,
    createdBy: admin._id,
  });

  console.log('Creating notifications…');
  await Notification.insertMany([
    {
      userId: jockey1._id,
      type: 'invitation_received',
      title: 'Lời mời điều khiển ngựa',
      message: `Bạn được mời điều khiển ${horseA.name} tại ${race.name}.`,
      refModel: 'JockeyInvitation',
      refId: inv1._id,
    },
    {
      userId: owner._id,
      type: 'registration_approved',
      title: 'Đăng ký đã được duyệt',
      message: `${horseA.name} đã được duyệt tham gia ${race.name}.`,
      refModel: 'RaceRegistration',
      refId: regA._id,
    },
    {
      userId: owner._id,
      type: 'registration_approved',
      title: 'Đăng ký đã được duyệt',
      message: `${horseB.name} đã được duyệt tham gia ${race.name}.`,
      refModel: 'RaceRegistration',
      refId: regB._id,
    },
    {
      userId: referee._id,
      type: 'result_confirmed',
      title: 'Kết quả đã xác nhận',
      message: `Chờ admin công bố kết quả ${race.name}.`,
      refModel: 'Result',
      refId: result._id,
    },
  ]);

  console.log('\n=== Seed completed (consistent scenario) ===\n');
  console.log('Track:     ', track.name);
  console.log('Meeting:   ', meeting.name);
  console.log('Tournament:', tournament.name, `[${tournament.status}]`);
  console.log('Race:      ', raceWithParticipants.name, `[${raceWithParticipants.status}]`);
  console.log('Participants:', raceWithParticipants.participants.length);
  console.log('Result:     confirmed, awaiting publish');
  console.log('Prediction:', prediction._id, '(pending — chấm sau publish)');
  console.log('\nDemo accounts (password: Demo@123):');
  console.log('  admin@demo.local, owner@demo.local, jockey1@demo.local,');
  console.log('  jockey2@demo.local, referee@demo.local, spectator@demo.local');
  console.log('\nProduct:', product.name, `— ${product.pointsCost} points`);
  console.log('SpectatorProfile balance:', profile.currentBalance, '\n');
}

async function main(): Promise<void> {
  await connectDatabase();
  try {
    await seed();
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
