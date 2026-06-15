/**
 * Seed 3 scenarios demo:
 * A — Jockey: pending invitation + upcoming race
 * B — Spectator: open prediction window, chưa có prediction
 * C — Scoring: race completed, result confirmed, chưa publish, 1 prediction pending
 *
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
  Product,
  Notification,
  SpectatorProfile,
  ViolationRule, 
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
  'raceviewingpasses',
  'viewingticketreminderlogs',
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
  'violationrules', // 🚀 Clear luôn bảng luật cũ nếu có
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

  console.log('Setting spectator points…');
  await SpectatorProfile.findOneAndUpdate(
    { userId: spectator._id },
    {
      $set: {
        currentBalance: 2500,
        totalPointsEarned: 2500,
        totalPointsSpent: 0,
      },
    },
    { upsert: true },
  );

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
    {
      ownerId: owner._id,
      name: 'Gió Xuân',
      registrationId: 'VN-HORSE-003',
      breed: 'Thoroughbred',
      trainerName: 'Stable Demo A',
      age: 3,
      color: 'Grey',
      weight: 460,
      healthStatus: 'fit',
    },
  ]);
  const horseA = horses[0]!;
  const horseB = horses[1]!;
  const horseC = horses[2]!;

  // 🚀 TẠO MASTER DATA LUẬT VI PHẠM (VIOLATION RULES)
  console.log('Creating Violation Rules…');
  const rules = await ViolationRule.create([
    {
      code: 'ERR-001',
      name: 'Xuất phát sớm (False Start)',
      description: 'Ngựa hoặc kỵ sĩ vượt rào trước hiệu lệnh bắt đầu.',
      category: 'race_conduct',
      severity: 'high',
      penaltyApplied: 'disqualify',
      fineAmount: 500000,
      banDurationDays: 0,
      isActive: true,
      createdBy: admin._id,
    },
    {
      code: 'ERR-002',
      name: 'Chèn ép làn đối thủ (Obstruction)',
      description: 'Kỵ sĩ điều khiển ngựa tạt đầu, chèn ép sai luật gây nguy hiểm.',
      category: 'race_conduct',
      severity: 'high',
      penaltyApplied: 'disqualification',
      fineAmount: 1000000,
      banDurationDays: 7,
      isActive: true,
      createdBy: admin._id,
    },
    {
      code: 'ERR-003',
      name: 'Sử dụng roi quá mức',
      description: 'Kỵ sĩ quất roi vượt quá số lần quy định ở đoạn nước rút.',
      category: 'equipment',
      severity: 'medium',
      penaltyApplied: 'fine',
      fineAmount: 200000,
      banDurationDays: 0,
      isActive: true,
      createdBy: admin._id,
    }
  ]);
  const ruleFalseStart = rules[0]!;

  console.log('Creating track & tournament…');
  const track = await Track.create({
    name: 'Trường đua Bình Dương',
    location: 'Thủ Dầu Một, Bình Dương',
    countryCode: 'VN',
    surfaceDefault: 'turf',
  });

  const tournament = await Tournament.create({
    name: 'Giải Đua Mùa Xuân 2026',
    description: 'Dữ liệu demo — Jockey + Spectator portals.',
    startDate: daysFromNow(-5),
    endDate: daysFromNow(30),
    location: 'Trường đua Bình Dương',
    status: 'ongoing',
    prizePool: 50_000_000,
    predictionConfig: {
      isEnabled: true,
      pointsPerCorrect: 100,
      bonusPointsTop3: 50,
      predictionOpenAt: daysFromNow(-3),
      predictionCloseAt: daysFromNow(20),
      maxPredictionsPerRace: 1,
      poolEnabled: false,
      entryFee: 0,
      feePercent: 10,
    },
    createdBy: admin._id,
  });

  const meetingUpcoming = await RaceMeeting.create({
    tournamentId: tournament._id,
    trackId: track._id,
    meetingDate: daysFromNow(7),
    name: 'Buổi đua bán kết — tuần tới',
    status: 'scheduled',
  });

  const meetingOpen = await RaceMeeting.create({
    tournamentId: tournament._id,
    trackId: track._id,
    meetingDate: daysFromNow(3),
    name: 'Buổi đua chung kết — mở dự đoán',
    status: 'scheduled',
  });

  const meetingCompleted = await RaceMeeting.create({
    tournamentId: tournament._id,
    trackId: track._id,
    meetingDate: daysFromNow(-1),
    name: 'Buổi đua vòng loại — đã xong',
    status: 'completed',
  });

  // --- Scenario A: Jockey pending invitation ---
  console.log('Scenario A — Jockey pending invitation…');
  const raceUpcoming = await Race.create({
    tournamentId: tournament._id,
    meetingId: meetingUpcoming._id,
    trackId: track._id,
    name: 'Bán kết — Vòng 2',
    round: 2,
    raceClass: 'Open',
    scheduledAt: daysFromNow(7),
    distance: 1800,
    surface: 'turf',
    going: 'good',
    weather: 'Nắng nhẹ',
    predictionOpenAt: daysFromNow(-1),
    predictionCloseAt: daysFromNow(6),
    maxParticipants: 8,
    status: 'scheduled',
    refereeId: referee._id,
    participants: [],
  });

  await RaceRegistration.create({
    raceId: raceUpcoming._id,
    horseId: horseC._id,
    ownerId: owner._id,
    status: 'approved',
    processedBy: admin._id,
    processedAt: new Date(),
    waiverAcceptedAt: new Date(),
  });

  const pendingInv = await JockeyInvitation.create({
    horseOwnerId: owner._id,
    jockeyId: jockey2._id,
    horseId: horseC._id,
    raceId: raceUpcoming._id,
    status: 'pending',
    message: 'Mời bạn điều khiển Gió Xuân tại bán kết vòng 2.',
  });

  // --- Scenario B: Spectator open prediction ---
  console.log('Scenario B — Spectator open prediction…');
  const raceOpenScheduled = daysFromNow(3);
  const raceOpen = await Race.create({
    tournamentId: tournament._id,
    meetingId: meetingOpen._id,
    trackId: track._id,
    name: 'Chung kết — Vòng 1',
    round: 1,
    raceClass: 'Open',
    scheduledAt: raceOpenScheduled,
    distance: 1600,
    surface: 'turf',
    going: 'good',
    weather: 'Mát',
    streamUrl: 'https://example.com/live/chung-ket-v1',
    predictionOpenAt: daysFromNow(-2),
    predictionCloseAt: daysFromNow(2),
    maxParticipants: 8,
    status: 'scheduled',
    refereeId: referee._id,
    participants: [],
    viewingTicket: {
      enabled: true,
      pricePoints: 200,
      announceAt: daysFromNow(-1),
      saleOpensAt: daysFromNow(-1),
      saleExpiresAt: raceOpenScheduled,
      announcementMessage:
        'Vé xem trực tiếp cuộc Chung kết — Vòng 1. Giá 200 điểm. Mua trước giờ đua để xem stream HD.',
      allowVipRedemption: true,
    },
  });

  await RaceRegistration.create([
    {
      raceId: raceOpen._id,
      horseId: horseA._id,
      ownerId: owner._id,
      status: 'approved',
      processedBy: admin._id,
      processedAt: new Date(),
      waiverAcceptedAt: new Date(),
    },
    {
      raceId: raceOpen._id,
      horseId: horseB._id,
      ownerId: owner._id,
      status: 'approved',
      processedBy: admin._id,
      processedAt: new Date(),
      waiverAcceptedAt: new Date(),
    },
  ]);

  await acceptInvitation(owner._id, jockey1._id, horseA._id, raceOpen._id, 'Mời bạn điều khiển Sóng Gió tại chung kết.');
  await acceptInvitation(owner._id, jockey2._id, horseB._id, raceOpen._id, 'Mời bạn điều khiển Bóng Mây tại chung kết.');

  // --- Scenario C: Scoring after publish ---
  console.log('Scenario C — Result awaiting publish…');
  const raceCompleted = await Race.create({
    tournamentId: tournament._id,
    meetingId: meetingCompleted._id,
    trackId: track._id,
    name: 'Vòng loại — Heat 1',
    round: 1,
    raceClass: 'Open',
    scheduledAt: daysFromNow(1),
    distance: 1600,
    surface: 'turf',
    going: 'good',
    weather: 'Nắng nhẹ',
    predictionOpenAt: daysFromNow(-5),
    predictionCloseAt: daysFromNow(-2),
    maxParticipants: 8,
    status: 'scheduled',
    refereeId: referee._id,
    participants: [],
  });

  await RaceRegistration.create([
    {
      raceId: raceCompleted._id,
      horseId: horseA._id,
      ownerId: owner._id,
      status: 'approved',
      processedBy: admin._id,
      processedAt: new Date(),
      waiverAcceptedAt: new Date(),
    },
    {
      raceId: raceCompleted._id,
      horseId: horseB._id,
      ownerId: owner._id,
      status: 'approved',
      processedBy: admin._id,
      processedAt: new Date(),
      waiverAcceptedAt: new Date(),
    },
  ]);

  await acceptInvitation(owner._id, jockey1._id, horseA._id, raceCompleted._id, 'Mời bạn điều khiển Sóng Gió tại vòng loại.');
  await acceptInvitation(owner._id, jockey2._id, horseB._id, raceCompleted._id, 'Mời bạn điều khiển Bóng Mây tại vòng loại.');

 const raceCompletedDoc = await Race.findById(raceCompleted._id);
  if (!raceCompletedDoc) throw new Error('Seed failed: race completed not found');

  const now = new Date();
  
  // 🚀 BƯỚC 1: Xác nhận y tế và điểm danh cho cả 2 ngựa
  // Mục đích: Đảm bảo có đủ 2 con ngựa hợp lệ (active = 2) để trận đua có thể BẮT ĐẦU.
  raceCompletedDoc.participants = raceCompletedDoc.participants.map((p) => ({
    ...p,
    confirmedAt: now,
    vetApprovedAt: now,
    carriedWeight: p.horseId.toString() === horseA._id.toString() ? 56 : 57,
  }));
  raceCompletedDoc.status = 'ongoing';
  await raceCompletedDoc.save(); // ✅ Lưu thành công, trận đua chính thức bắt đầu!

  // 🚀 BƯỚC 2: Trong lúc đua, Ngựa B phạm lỗi (False Start) nên bị tước quyền, sau đó chốt trận.
  raceCompletedDoc.participants = raceCompletedDoc.participants.map((p) => {
    const isHorseB = p.horseId.toString() === horseB._id.toString();
    if (isHorseB) {
      return {
        ...p,
        isDisqualified: true,
        disqualifiedReason: ruleFalseStart.name,
        disqualifiedAt: now,
        scratchedAt: now, // Chính thức văng khỏi đường chạy
      };
    }
    return p;
  });
  raceCompletedDoc.status = 'completed';
  raceCompletedDoc.scheduledAt = daysFromNow(-1);
  await raceCompletedDoc.save(); // ✅ Lưu thành công, chốt sổ trận đua!

  // 🚀 CẬP NHẬT SCENARIO C: Ghi biên bản vi phạm theo cấu trúc mới
  const result = await Result.create({
    raceId: raceCompleted._id,
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
        ruleId: ruleFalseStart._id,
        horseId: horseB._id,
        jockeyId: jockey2._id, // Có thể phạt cả Ngựa và Kỵ sĩ
        type: ruleFalseStart.category,
        description: `Bắt nhầm nhịp xuất phát - ${ruleFalseStart.description}`,
        penaltyApplied: ruleFalseStart.penaltyApplied,
        bannedUntil: null,
        recordedAt: now,
      },
    ],
    confirmedBy: referee._id,
    confirmedAt: now,
    publishedBy: null,
    publishedAt: null,
    reportUrl: null,
  });

  console.log('Spectator prediction for scenario C…');

  const predictionPending = await Prediction.create({
    spectatorId: spectator._id,
    raceId: raceCompleted._id,
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
    description: 'Đổi 500 điểm — vé xem Chung kết Vòng 1 (sự kiện hiếm).',
    category: 'voucher',
    pointsCost: 500,
    stock: 10,
    isActive: true,
    linkedRaceId: raceOpen._id,
    voucherKind: 'race_viewing_pass',
    createdBy: admin._id,
  });

  console.log('Creating notifications…');
  await Notification.insertMany([
    {
      userId: jockey2._id,
      type: 'invitation_received',
      title: 'Lời mời điều khiển ngựa',
      message: `Bạn được mời điều khiển ${horseC.name} tại ${raceUpcoming.name}.`,
      refModel: 'JockeyInvitation',
      refId: pendingInv._id,
    },
    {
      userId: referee._id,
      type: 'result_confirmed',
      title: 'Kết quả đã xác nhận',
      message: `Chờ admin công bố kết quả ${raceCompletedDoc.name}.`,
      refModel: 'Result',
      refId: result._id,
    },
  ]);

  console.log('\n=== Seed completed (3 scenarios) ===\n');
  console.log('Master Data — Đã nạp 3 luật vi phạm (Violation Rules)');
  console.log('A — Jockey:   pending invite for jockey2@demo.local on', raceUpcoming.name);
  console.log('B — Spectator: open prediction on', raceOpen.name, '(no prediction yet)');
  console.log('C — Scoring:  result confirmed, awaiting publish on', raceCompletedDoc.name);
  console.log('Prediction pending:', predictionPending._id);
  console.log('\nDemo accounts (password: Demo@123):');
  console.log('  jockey1@demo.local, jockey2@demo.local, spectator@demo.local, admin@demo.local');
  console.log('Product:', product.name, `— ${product.pointsCost} points\n`);
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