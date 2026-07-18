/**
 * Seed 5 scenarios demo:
 * A — Jockey: pending invitation + upcoming race
 * B — Spectator: open prediction window, chưa có prediction
 * C — Scoring: race completed, result confirmed, chưa publish, 1 prediction pending
 * D — Referee: race completed, result DRAFT, ready for testing Time Penalty & Disqualify
 * E — Independent: New tournament, new race, horse registered but NO jockey invited yet. Free jockey available.
 *
 * Chạy: npm run db:seed — Mật khẩu: Demo@123
 */
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { VIOLATION_RULES } from '../data/violation-rules.data.js';
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
  PredictionPool,
  Product,
  Notification,
  PaymentTransaction,
  RaceViewingPass,
  SpectatorProfile,
  ViolationRule,
} from '../models/index.js';

const DEMO_PASSWORD = 'Demo@123';

const COLLECTIONS_TO_CLEAR = [
  'auditlogs',
  'organizerledgers',
  'notifications',
  'redemptions',
  'paymenttransactions',
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
  'violationrules',
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
      email: 'jockey3@demo.local',
      passwordHash: DEMO_PASSWORD,
      role: 'jockey',
      fullName: 'Trương Văn Rảnh Rỗi',
      phone: '0900000007',
      jockeyProfile: { licenseNumber: 'VN-JKY-003', isSuspended: false },
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
    {
      email: 'spectator2@demo.local',
      passwordHash: DEMO_PASSWORD,
      role: 'spectator',
      fullName: 'Khách Dự Đoán Phụ',
      phone: '0900000008',
    },
    {
      email: 'spectator3@demo.local',
      passwordHash: DEMO_PASSWORD,
      role: 'spectator',
      fullName: 'Khách Risk 2x',
      phone: '0900000009',
    },
    {
      email: 'owner.admincreated@demo.local',
      passwordHash: DEMO_PASSWORD,
      role: 'horse_owner',
      fullName: 'Owner Do Admin Tạo',
      phone: '0900000010',
    },
    {
      email: 'jockey.admincreated@demo.local',
      passwordHash: DEMO_PASSWORD,
      role: 'jockey',
      fullName: 'Jockey Do Admin Tạo',
      phone: '0900000011',
      jockeyProfile: { licenseNumber: 'VN-JKY-ADM-001', isSuspended: false },
    },
    {
      email: 'referee.inactive@demo.local',
      passwordHash: DEMO_PASSWORD,
      role: 'referee',
      fullName: 'Referee Tạm Khóa',
      phone: '0900000012',
      isActive: false,
      refereeProfile: { certificationId: 'VN-REF-INACTIVE-001' },
    },
  ]);
  const admin = users[0]!;
  const owner = users[1]!;
  const jockey1 = users[2]!;
  const jockey2 = users[3]!;
  const jockey3 = users[4]!;
  const referee = users[5]!;
  const spectator = users[6]!;
  const spectator2 = users[7]!;
  const spectator3 = users[8]!;

  console.log('Setting point wallets…');
  async function resetPointWallet(userId: mongoose.Types.ObjectId) {
    const profile =
      (await SpectatorProfile.findOne({ userId })) ??
      (await SpectatorProfile.create({ userId }));
    profile.currentBalance = 0;
    profile.totalPointsEarned = 0;
    profile.totalPointsSpent = 0;
    profile.transactions = [];
    await profile.save();
    return profile;
  }

  await resetPointWallet(owner._id);
  await resetPointWallet(jockey1._id);
  await resetPointWallet(jockey2._id);
  await resetPointWallet(jockey3._id);
  await resetPointWallet(referee._id);

  const spectatorProfile = await resetPointWallet(spectator._id);
  await spectatorProfile.addPoints(
    250_000,
    'topup',
    undefined,
    undefined,
    'Seed demo top-up: 250,000 points',
  );
  const spectator2Profile = await resetPointWallet(spectator2._id);
  await spectator2Profile.addPoints(
    250_000,
    'topup',
    undefined,
    undefined,
    'Seed demo top-up: 250,000 points',
  );
  await spectator2Profile.spendPoints(
    30_000,
    'spent_viewing_ticket',
    undefined,
    undefined,
    'Seed demo spend: viewing ticket',
  );
  const spectator3Profile = await resetPointWallet(spectator3._id);
  await spectator3Profile.addPoints(
    300_000,
    'topup',
    undefined,
    undefined,
    'Seed demo top-up: 300,000 points',
  );

  await PaymentTransaction.create([
    {
      userId: spectator._id,
      provider: 'mock',
      amountVnd: 250_000_000,
      points: 250_000,
      exchangeRateVndPerPoint: 1000,
      status: 'paid',
      providerTransactionId: 'seed_mock_topup_spectator',
      providerPayload: { mode: 'seed' },
      paidAt: daysFromNow(-2),
    },
    {
      userId: spectator2._id,
      provider: 'mock',
      amountVnd: 250_000_000,
      points: 250_000,
      exchangeRateVndPerPoint: 1000,
      status: 'paid',
      providerTransactionId: 'seed_mock_topup_spectator2',
      providerPayload: { mode: 'seed' },
      paidAt: daysFromNow(-1),
    },
    {
      userId: spectator3._id,
      provider: 'mock',
      amountVnd: 300_000_000,
      points: 300_000,
      exchangeRateVndPerPoint: 1000,
      status: 'paid',
      providerTransactionId: 'seed_mock_topup_spectator3',
      providerPayload: { mode: 'seed' },
      paidAt: daysFromNow(-1),
    },
  ]);

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
      profilePdfUrl: 'http://localhost:3000/demo-files/horses/horse-reg-form.pdf',
      profilePdfName: 'NJ 4-H Horse Registration Form',
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
      profilePdfUrl: 'http://localhost:3000/demo-files/horses/horse-reg-form.pdf',
      profilePdfName: 'NJ 4-H Horse Registration Form',
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
    {
      ownerId: owner._id,
      name: 'Sấm Sét',
      registrationId: 'VN-HORSE-004',
      breed: 'Quarter Horse',
      trainerName: 'Stable Demo B',
      age: 4,
      color: 'Black',
      weight: 490,
      healthStatus: 'fit',
    },
  ]);
  const horseA = horses[0]!;
  const horseB = horses[1]!;
  const horseC = horses[2]!;
  const horseD = horses[3]!;

  console.log('Creating Violation Rules…');
  const rules = await ViolationRule.create([
    {
      code: 'ERR-001',
      name: 'Xuất phát sớm (False Start)',
      description: 'Ngựa hoặc kỵ sĩ vượt rào trước hiệu lệnh bắt đầu.',
      category: 'race_conduct',
      severity: 'high',
      penaltyApplied: 'disqualify',
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
      penaltyApplied: 'demote',
      banDurationDays: 0,
      isActive: true,
      createdBy: admin._id,
    },
    {
      code: 'ERR-003',
      name: 'Sử dụng roi quá mức',
      description: 'Kỵ sĩ quất roi vượt quá số lần quy định ở đoạn nước rút.',
      category: 'equipment',
      severity: 'medium',
      penaltyApplied: 'warning',
      banDurationDays: 0,
      isActive: true,
      createdBy: admin._id,
    },
    {
      code: 'ERR-004',
      name: 'Su dung doping',
      description: 'Ngua co ket qua kiem tra doping duong tinh, huy ket qua va cam thi dau cac ben lien quan.',
      category: 'medical',
      severity: 'critical',
      penaltyApplied: 'disqualification',
      banDurationDays: 365,
      isActive: true,
      createdBy: admin._id,
    }
  ]);
  const ruleFalseStart = rules[0]!;
  const ruleObstruction = rules[1]!;

  console.log('Creating tracks & tournaments…');
  const track = await Track.create({
    name: 'Trường đua Bình Dương',
    location: 'Thủ Dầu Một, Bình Dương',
    countryCode: 'VN',
    surfaceDefault: 'turf',
  });

  const tournamentSpring = await Tournament.create({
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
      poolEnabled: true,
      entryFee: 50_000,
      minRiskMultiplier: 1,
      maxRiskMultiplier: 10,
      quickRiskMultipliers: [1],
      feePercent: 10,
      organizerFeeRate: 10,
      racingRewardRate: 15,
      spectatorRewardRate: 75,
      ownerShareRate: 80,
      jockeyShareRate: 20,
      rankRewardRates: [50, 25, 15, 7, 3],
      fixedPrizeTopCount: 5,
      fixedPrizeRankRates: [50, 25, 12, 8, 5],
    },
    createdBy: admin._id,
  });

  const tournamentSummer = await Tournament.create({
    name: 'Giải Đua Mùa Hè Độc Lập 2026',
    description: 'Giải đấu riêng biệt để test quy trình mời kỵ sĩ.',
    startDate: daysFromNow(10),
    endDate: daysFromNow(40),
    location: 'Trường đua Bình Dương',
    status: 'published',
    prizePool: 100_000_000,
    predictionConfig: {
      isEnabled: true,
      pointsPerCorrect: 100,
      bonusPointsTop3: 50,
      predictionOpenAt: daysFromNow(5),
      predictionCloseAt: daysFromNow(15),
      maxPredictionsPerRace: 1,
      poolEnabled: true,
      entryFee: 50_000,
      minRiskMultiplier: 1,
      maxRiskMultiplier: 10,
      quickRiskMultipliers: [1],
      feePercent: 10,
      organizerFeeRate: 10,
      racingRewardRate: 15,
      spectatorRewardRate: 75,
      ownerShareRate: 80,
      jockeyShareRate: 20,
      rankRewardRates: [50, 30, 20],
      fixedPrizeTopCount: 4,
      fixedPrizeRankRates: [55, 25, 12, 8],
    },
    createdBy: admin._id,
  });

  const meetingUpcoming = await RaceMeeting.create({
    tournamentId: tournamentSpring._id,
    trackId: track._id,
    meetingDate: daysFromNow(7),
    name: 'Buổi đua bán kết — tuần tới',
    status: 'scheduled',
  });

  const meetingOpen = await RaceMeeting.create({
    tournamentId: tournamentSpring._id,
    trackId: track._id,
    meetingDate: daysFromNow(3),
    name: 'Buổi đua chung kết — mở dự đoán',
    status: 'scheduled',
  });

  const meetingCompleted = await RaceMeeting.create({
    tournamentId: tournamentSpring._id,
    trackId: track._id,
    meetingDate: daysFromNow(-1),
    name: 'Buổi đua vòng loại — đã xong',
    status: 'completed',
  });

  const meetingSummer = await RaceMeeting.create({
    tournamentId: tournamentSummer._id,
    trackId: track._id,
    meetingDate: daysFromNow(15),
    name: 'Khai mạc mùa hè',
    status: 'scheduled',
  });

  // --- Scenario A: Jockey pending invitation ---
  console.log('Scenario A — Jockey pending invitation…');
  const raceUpcoming = await Race.create({
    tournamentId: tournamentSpring._id,
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
    tournamentId: tournamentSpring._id,
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

  const openPrediction1 = await Prediction.create({
    spectatorId: spectator2._id,
    raceId: raceOpen._id,
    tournamentId: tournamentSpring._id,
    predictedRanks: [{ rank: 1, horseId: horseA._id }],
    status: 'pending',
    ticketCount: 2,
    riskMultiplier: 2,
    contribution: 100_000,
    pointsEarned: 0,
    bonusPoints: 0,
    totalPoints: 0,
  });
  await spectator2Profile.spendPoints(
    100_000,
    'spent_pool_entry',
    'Prediction',
    openPrediction1._id,
    `Seed demo open prediction: 2 tickets — ${raceOpen.name}`,
  );

  const openPrediction2 = await Prediction.create({
    spectatorId: spectator3._id,
    raceId: raceOpen._id,
    tournamentId: tournamentSpring._id,
    predictedRanks: [{ rank: 1, horseId: horseB._id }],
    status: 'pending',
    ticketCount: 1,
    riskMultiplier: 1,
    contribution: 50_000,
    pointsEarned: 0,
    bonusPoints: 0,
    totalPoints: 0,
  });
  await spectator3Profile.spendPoints(
    50_000,
    'spent_pool_entry',
    'Prediction',
    openPrediction2._id,
    `Seed demo open prediction: 1 ticket — ${raceOpen.name}`,
  );

  await PredictionPool.create({
    raceId: raceOpen._id,
    tournamentId: tournamentSpring._id,
    status: 'open',
    ticketPrice: 50_000,
    minRiskMultiplier: 1,
    maxRiskMultiplier: 10,
    quickRiskMultipliers: [1],
    totalTickets: 3,
    totalBountyPool: 150_000,
    winPool: 0,
    contributorCount: 2,
  });

  // --- Scenario C: Scoring after publish ---
  console.log('Scenario C — Result confirmed, awaiting publish…');
  const raceCompleted = await Race.create({
    tournamentId: tournamentSpring._id,
    meetingId: meetingCompleted._id,
    trackId: track._id,
    name: 'Vòng loại — Heat 1',
    round: 1,
    raceClass: 'Open',
    scheduledAt: daysFromNow(1), // Giữ nguyên tương lai để tránh lỗi Validation
    distance: 1600,
    surface: 'turf',
    going: 'good',
    weather: 'Nắng nhẹ',
    predictionOpenAt: daysFromNow(-5),
    predictionCloseAt: daysFromNow(-2),
    maxParticipants: 8,
    status: 'completed',
    refereeId: referee._id,
    participants: [
      {
        horseId: horseA._id,
        jockeyId: jockey1._id,
        ownerId: owner._id,
        laneNumber: 1,
        clothNumber: 1,
        confirmedAt: new Date(),
        vetApprovedAt: new Date()
      },
      {
        horseId: horseB._id,
        jockeyId: jockey2._id,
        ownerId: owner._id,
        laneNumber: 2,
        clothNumber: 2,
        confirmedAt: new Date(),
        vetApprovedAt: new Date()
      },
      {
        horseId: horseC._id,
        jockeyId: jockey3._id,
        ownerId: owner._id,
        laneNumber: 3,
        clothNumber: 3,
        confirmedAt: new Date(),
        vetApprovedAt: new Date()
      }
    ],
  });

  const resultConfirmed = await Result.create({
    raceId: raceCompleted._id,
    tournamentId: tournamentSpring._id,
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
      {
        rank: 2,
        horseId: horseB._id,
        jockeyId: jockey2._id,
        ownerId: owner._id,
        finishTime: 99.21,
        marginBehind: 0.79,
        prize: 15_000_000,
      },
      {
        rank: 3,
        horseId: horseC._id,
        jockeyId: jockey3._id,
        ownerId: owner._id,
        finishTime: 100.04,
        marginBehind: 1.62,
        prize: 5_000_000,
      },
    ],
    violations: [],
    confirmedBy: referee._id,
    confirmedAt: new Date(),
    publishedBy: null,
    publishedAt: null,
  });

  const predictionPending = await Prediction.create({
    spectatorId: spectator._id,
    raceId: raceCompleted._id,
    tournamentId: tournamentSpring._id,
    predictedRanks: [
      { rank: 1, horseId: horseA._id },
    ],
    status: 'pending',
    ticketCount: 1,
    riskMultiplier: 1,
    contribution: 50_000,
    pointsEarned: 0,
    bonusPoints: 0,
    totalPoints: 0,
  });
  await spectatorProfile.spendPoints(
    50_000,
    'spent_pool_entry',
    'Prediction',
    predictionPending._id,
    `Seed demo pool entry: ${raceCompleted.name}`,
  );

  const predictionPending2 = await Prediction.create({
    spectatorId: spectator2._id,
    raceId: raceCompleted._id,
    tournamentId: tournamentSpring._id,
    predictedRanks: [
      { rank: 1, horseId: horseB._id },
    ],
    status: 'pending',
    ticketCount: 1,
    riskMultiplier: 1,
    contribution: 50_000,
    pointsEarned: 0,
    bonusPoints: 0,
    totalPoints: 0,
  });
  await spectator2Profile.spendPoints(
    50_000,
    'spent_pool_entry',
    'Prediction',
    predictionPending2._id,
    `Seed demo pool entry: ${raceCompleted.name}`,
  );

  const predictionPending3 = await Prediction.create({
    spectatorId: spectator3._id,
    raceId: raceCompleted._id,
    tournamentId: tournamentSpring._id,
    predictedRanks: [
      { rank: 1, horseId: horseA._id },
    ],
    status: 'pending',
    ticketCount: 2,
    riskMultiplier: 2,
    contribution: 100_000,
    pointsEarned: 0,
    bonusPoints: 0,
    totalPoints: 0,
  });
  await spectator3Profile.spendPoints(
    100_000,
    'spent_pool_entry',
    'Prediction',
    predictionPending3._id,
    `Seed demo pool entry: 2 tickets — ${raceCompleted.name}`,
  );

  await PredictionPool.create({
    raceId: raceCompleted._id,
    tournamentId: tournamentSpring._id,
    status: 'open',
    ticketPrice: 50_000,
    minRiskMultiplier: 1,
    maxRiskMultiplier: 10,
    quickRiskMultipliers: [1],
    totalTickets: 4,
    totalBountyPool: 200_000,
    winPool: 0,
    contributorCount: 3,
  });

  /*
   * Scenario C has:
   * - spectator@demo.local: correct winner, 1 ticket, contribution 50,000.
   * - spectator2@demo.local: incorrect winner, 1 ticket, contribution 50,000.
   * - spectator3@demo.local: correct winner, 2 tickets, contribution 100,000.
   *
   * Publishing the result lets you test ticket-based pool sharing:
   * predictionScore = ticketCount; contribution = entryFee * ticketCount.
   */

  // --- Scenario C2: Published results for spectator horse leaderboard ---
  console.log('Scenario C2 — Published horse leaderboard demo…');
  const leaderboardRace1 = await Race.create({
    tournamentId: tournamentSpring._id,
    meetingId: meetingCompleted._id,
    trackId: track._id,
    name: 'Leaderboard Demo — Sprint 1',
    round: 4,
    raceClass: 'Open',
    scheduledAt: daysFromNow(3),
    distance: 1200,
    surface: 'turf',
    going: 'good',
    maxParticipants: 8,
    status: 'completed',
    refereeId: referee._id,
    participants: [
      { horseId: horseA._id, jockeyId: jockey1._id, ownerId: owner._id, laneNumber: 1, clothNumber: 1, confirmedAt: new Date(), vetApprovedAt: new Date() },
      { horseId: horseB._id, jockeyId: jockey2._id, ownerId: owner._id, laneNumber: 2, clothNumber: 2, confirmedAt: new Date(), vetApprovedAt: new Date() },
      { horseId: horseC._id, jockeyId: jockey3._id, ownerId: owner._id, laneNumber: 3, clothNumber: 3, confirmedAt: new Date(), vetApprovedAt: new Date() },
    ],
  });
  await Result.create({
    raceId: leaderboardRace1._id,
    tournamentId: tournamentSpring._id,
    rankings: [
      { rank: 1, horseId: horseA._id, jockeyId: jockey1._id, ownerId: owner._id, finishTime: 75.11, marginBehind: 0, prize: 0 },
      { rank: 2, horseId: horseB._id, jockeyId: jockey2._id, ownerId: owner._id, finishTime: 76.04, marginBehind: 0.93, prize: 0 },
      { rank: 3, horseId: horseC._id, jockeyId: jockey3._id, ownerId: owner._id, finishTime: 77.58, marginBehind: 2.47, prize: 0 },
    ],
    violations: [],
    isPhotoFinish: false,
    confirmedBy: referee._id,
    confirmedAt: new Date(),
    publishedBy: admin._id,
    publishedAt: daysFromNow(-2),
  });

  const leaderboardRace2 = await Race.create({
    tournamentId: tournamentSpring._id,
    meetingId: meetingCompleted._id,
    trackId: track._id,
    name: 'Leaderboard Demo — Sprint 2',
    round: 5,
    raceClass: 'Open',
    scheduledAt: daysFromNow(4),
    distance: 1200,
    surface: 'turf',
    going: 'good',
    maxParticipants: 8,
    status: 'completed',
    refereeId: referee._id,
    participants: [
      { horseId: horseA._id, jockeyId: jockey1._id, ownerId: owner._id, laneNumber: 1, clothNumber: 1, confirmedAt: new Date(), vetApprovedAt: new Date() },
      { horseId: horseB._id, jockeyId: jockey2._id, ownerId: owner._id, laneNumber: 2, clothNumber: 2, confirmedAt: new Date(), vetApprovedAt: new Date() },
      { horseId: horseC._id, jockeyId: jockey3._id, ownerId: owner._id, laneNumber: 3, clothNumber: 3, confirmedAt: new Date(), vetApprovedAt: new Date() },
    ],
  });
  await Result.create({
    raceId: leaderboardRace2._id,
    tournamentId: tournamentSpring._id,
    rankings: [
      { rank: 1, horseId: horseA._id, jockeyId: jockey1._id, ownerId: owner._id, finishTime: 74.88, marginBehind: 0, prize: 0 },
      { rank: 2, horseId: horseC._id, jockeyId: jockey3._id, ownerId: owner._id, finishTime: 75.36, marginBehind: 0.48, prize: 0 },
      { rank: 3, horseId: horseB._id, jockeyId: jockey2._id, ownerId: owner._id, finishTime: 76.02, marginBehind: 1.14, prize: 0 },
    ],
    violations: [],
    isPhotoFinish: false,
    confirmedBy: referee._id,
    confirmedAt: new Date(),
    publishedBy: admin._id,
    publishedAt: daysFromNow(-1),
  });

  const leaderboardRace3 = await Race.create({
    tournamentId: tournamentSpring._id,
    meetingId: meetingCompleted._id,
    trackId: track._id,
    name: 'Leaderboard Demo — DQ Check',
    round: 6,
    raceClass: 'Open',
    scheduledAt: daysFromNow(5),
    distance: 1200,
    surface: 'turf',
    going: 'good',
    maxParticipants: 8,
    status: 'completed',
    refereeId: referee._id,
    participants: [
      { horseId: horseB._id, jockeyId: jockey2._id, ownerId: owner._id, laneNumber: 1, clothNumber: 1, confirmedAt: new Date(), vetApprovedAt: new Date() },
      { horseId: horseC._id, jockeyId: jockey3._id, ownerId: owner._id, laneNumber: 2, clothNumber: 2, confirmedAt: new Date(), vetApprovedAt: new Date() },
      {
        horseId: horseA._id,
        jockeyId: jockey1._id,
        ownerId: owner._id,
        laneNumber: 3,
        clothNumber: 3,
        confirmedAt: new Date(),
        vetApprovedAt: new Date(),
        isDisqualified: true,
        disqualifiedReason: 'Seed DQ demo',
        disqualifiedAt: new Date(),
        scratchedAt: new Date(),
      },
    ],
  });
  await Result.create({
    raceId: leaderboardRace3._id,
    tournamentId: tournamentSpring._id,
    rankings: [
      { rank: 1, horseId: horseB._id, jockeyId: jockey2._id, ownerId: owner._id, finishTime: 75.33, marginBehind: 0, prize: 0 },
      { rank: 2, horseId: horseC._id, jockeyId: jockey3._id, ownerId: owner._id, finishTime: 76.10, marginBehind: 0.77, prize: 0 },
      { rank: 3, horseId: horseA._id, jockeyId: jockey1._id, ownerId: owner._id, finishTime: 74.90, marginBehind: 0, prize: 0 },
    ],
    violations: [
      {
        target: 'horse',
        horseId: horseA._id,
        jockeyId: jockey1._id,
        ownerId: owner._id,
        type: 'doping',
        description: 'Seed DQ demo — horse is excluded from leaderboard wins',
        penaltyApplied: 'disqualification',
        recordedAt: new Date(),
      },
    ],
    isPhotoFinish: false,
    confirmedBy: referee._id,
    confirmedAt: new Date(),
    publishedBy: admin._id,
    publishedAt: new Date(),
  });

  // --- 🚀 SCENARIO D: BẢN NHÁP CHO REFEREE TEST PHẠT ---
  console.log('Scenario D — Referee Draft Result for Testing Penalties…');
  const raceDraft = await Race.create({
    tournamentId: tournamentSpring._id,
    meetingId: meetingCompleted._id,
    trackId: track._id,
    name: 'Chặng thử nghiệm phạt (Draft)',
    round: 3,
    raceClass: 'Open',
    scheduledAt: daysFromNow(2), // 🚀 SỬA TẠI ĐÂY: Đổi sang tương lai (+2 ngày) để vượt qua validation
    distance: 1200,
    surface: 'turf',
    going: 'good',
    weather: 'Mát mẻ',
    maxParticipants: 8,
    status: 'completed',
    refereeId: referee._id,
    participants: [
      {
        horseId: horseB._id,
        jockeyId: jockey2._id,
        ownerId: owner._id,
        laneNumber: 1,
        clothNumber: 1,
        confirmedAt: new Date(),
        vetApprovedAt: new Date(),
      },
      {
        horseId: horseC._id,
        jockeyId: jockey1._id,
        ownerId: owner._id,
        laneNumber: 2,
        clothNumber: 2,
        confirmedAt: new Date(),
        vetApprovedAt: new Date(),
      }
    ],
  });

  await Result.create({
    raceId: raceDraft._id,
    tournamentId: tournamentSpring._id,
    rankings: [
      {
        rank: 1,
        horseId: horseB._id,
        jockeyId: jockey2._id,
        ownerId: owner._id,
        finishTime: 80.500,
        marginBehind: 0,
        prize: 0,
      },
      {
        rank: 2,
        horseId: horseC._id,
        jockeyId: jockey1._id,
        ownerId: owner._id,
        finishTime: 82.100,
        marginBehind: 1.600,
        prize: 0,
      }
    ],
    violations: [],
    isPhotoFinish: false,
    confirmedBy: null,
    confirmedAt: null,
  });

  // --- Scenario E: Độc lập - Test quy trình mời Kỵ sĩ ---
  console.log('Scenario E — Independent Test (Horse registered, NO Jockey yet)…');
  const raceIndependent = await Race.create({
    tournamentId: tournamentSummer._id,
    meetingId: meetingSummer._id,
    trackId: track._id,
    name: 'Vòng loại Mùa Hè - Heat 1',
    round: 1,
    raceClass: 'Open',
    scheduledAt: daysFromNow(15),
    distance: 1000,
    surface: 'turf',
    going: 'good',
    weather: 'Nắng',
    predictionOpenAt: daysFromNow(10),
    predictionCloseAt: daysFromNow(14),
    maxParticipants: 8,
    status: 'scheduled',
    participants: [],
  });

  await RaceRegistration.create({
    raceId: raceIndependent._id,
    horseId: horseD._id,
    ownerId: owner._id,
    status: 'approved',
    processedBy: admin._id,
    processedAt: new Date(),
    waiverAcceptedAt: new Date(),
  });

  await Product.create([
    {
      name: 'Voucher xem giải VIP',
      description: 'Đổi 500 điểm — vé xem Chung kết Vòng 1 (sự kiện hiếm).',
      category: 'voucher',
      pointsCost: 500,
      stock: 10,
      isActive: true,
      linkedRaceId: raceOpen._id,
      voucherKind: 'race_viewing_pass',
      createdBy: admin._id,
    },
    {
      name: 'Hộp quà lưu niệm trường đua',
      description: 'Quà demo để test đổi điểm không gắn với vé xem.',
      category: 'merchandise',
      pointsCost: 1_000,
      stock: 25,
      isActive: true,
      createdBy: admin._id,
    },
  ]);

  const viewingPass = await RaceViewingPass.create({
    spectatorId: spectator._id,
    raceId: raceOpen._id,
    source: 'purchase',
    pointsPaid: 200,
    purchasedAt: daysFromNow(-1),
    status: 'active',
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
      message: `Chờ admin công bố kết quả ${raceCompleted.name}.`,
      refModel: 'Result',
      refId: resultConfirmed._id,
    },
    {
      userId: spectator._id,
      type: 'viewing_ticket_purchased',
      title: 'Vé xem đã sẵn sàng',
      message: `Bạn đã có vé xem ${raceOpen.name}.`,
      refModel: 'RaceViewingPass',
      refId: viewingPass._id,
    },
    {
      userId: spectator3._id,
      type: 'prediction_reward',
      title: 'Dự đoán 2 phiếu đã ghi nhận',
      message: `Bạn đã tham gia dự đoán ${raceCompleted.name} với 2 phiếu để test chia thưởng theo ticket count.`,
      refModel: 'Prediction',
      refId: predictionPending3._id,
    },
  ]);

  console.log('\n=== Seed completed ===\n');
  console.log('A — Jockey:   pending invite on', raceUpcoming.name);
  console.log('B — Spectator: open prediction on', raceOpen.name);
  console.log('C — Scoring:  result confirmed, awaiting publish on', raceCompleted.name);
  console.log('   -> spectator@demo.local correct 1 ticket, spectator2 incorrect 1 ticket, spectator3 correct 2 tickets');
  console.log('   -> fixed race prizes: rank 1/2/3 = 30M/15M/5M points, split 80% owner / 20% jockey on publish');
  console.log('D — Referee:  result DRAFT created on', raceDraft.name);
  console.log('E — Independent: Horse registered, NO Jockey on', raceIndependent.name);
  console.log('   -> Free Jockey available: jockey3@demo.local');
  console.log('   -> Extra spectator accounts: spectator2@demo.local, spectator3@demo.local');
  console.log('   -> Admin user management samples: owner.admincreated@demo.local, jockey.admincreated@demo.local, referee.inactive@demo.local');

  // 🚀 IN RA CÁC MẪU JSON ĐỂ TEST TRỰC TIẾP TRÊN POSTMAN
  console.log('\n======================================================');
  console.log(' 🚀 DỮ LIỆU ĐỂ TEST API TRỌNG TÀI (REFEREE) TRÊN POSTMAN');
  console.log('======================================================');

  console.log(`\n🔴 1. TEST TỤT HẠNG TRỰC TIẾP (Ngựa B đang hạng 1 -> hạ xuống sau ngựa A bị ảnh hưởng)`);
  console.log(`POST /api/referee/races/${raceDraft._id}/penalize`);
  console.log(JSON.stringify({
    horseId: horseB._id.toString(),
    jockeyId: jockey2._id.toString(),
    ruleId: ruleObstruction._id.toString(),
    target: "jockey",
    affectedHorseId: horseA._id.toString(),
    notes: "Nài ngựa B chèn ép ở khúc cua cuối, hạ ngựa B xuống sau ngựa A theo lỗi JCK-01"
  }, null, 2));

  console.log(`\n🔴 2. TEST TƯỚC QUYỀN THI ĐẤU (ghi nhận lỗi disqualify bằng endpoint penalize)`);
  console.log(`POST /api/referee/races/${raceDraft._id}/penalize`);
  console.log(JSON.stringify({
    horseId: horseC._id.toString(),
    jockeyId: jockey1._id.toString(),
    ruleId: ruleFalseStart._id.toString(),
    target: "jockey",
    notes: "Nài ngựa C xuất phát sớm theo lỗi JCK-06."
  }, null, 2));

  console.log('\n======================================================');
  console.log(' 🏇 DỮ LIỆU ĐỂ TEST LUỒNG MỜI KỴ SĨ (SCENARIO E)');
  console.log('======================================================');
  console.log(`- Giải đấu độc lập: ${tournamentSummer._id}`);
  console.log(`- Trận đua (Race ID): ${raceIndependent._id}`);
  console.log(`- Ngựa trống kỵ sĩ (Horse ID - Sấm Sét): ${horseD._id}`);
  console.log(`- Kỵ sĩ đang rảnh (Jockey ID - jockey3): ${jockey3._id}`);
  console.log('======================================================\n');
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
