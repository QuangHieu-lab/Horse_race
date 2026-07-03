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
  ]);
  const admin = users[0]!;
  const owner = users[1]!;
  const jockey1 = users[2]!;
  const jockey2 = users[3]!;
  const jockey3 = users[4]!; 
  const referee = users[5]!;
  const spectator = users[6]!;
  const spectator2 = users[7]!;

  console.log('Setting spectator points…');
  const spectatorProfile =
    (await SpectatorProfile.findOne({ userId: spectator._id })) ??
    (await SpectatorProfile.create({ userId: spectator._id }));
  spectatorProfile.currentBalance = 0;
  spectatorProfile.totalPointsEarned = 0;
  spectatorProfile.totalPointsSpent = 0;
  spectatorProfile.transactions = [];
  await spectatorProfile.save();
  await spectatorProfile.addPoints(
    250_000,
    'topup',
    undefined,
    undefined,
    'Seed demo top-up: 250,000 points',
  );
  const spectator2Profile =
    (await SpectatorProfile.findOne({ userId: spectator2._id })) ??
    (await SpectatorProfile.create({ userId: spectator2._id }));
  spectator2Profile.currentBalance = 0;
  spectator2Profile.totalPointsEarned = 0;
  spectator2Profile.totalPointsSpent = 0;
  spectator2Profile.transactions = [];
  await spectator2Profile.save();
  await spectator2Profile.addPoints(
    150_000,
    'topup',
    undefined,
    undefined,
    'Seed demo top-up: 150,000 points',
  );
  await spectator2Profile.spendPoints(
    30_000,
    'spent_viewing_ticket',
    undefined,
    undefined,
    'Seed demo spend: viewing ticket',
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
      amountVnd: 150_000_000,
      points: 150_000,
      exchangeRateVndPerPoint: 1000,
      status: 'paid',
      providerTransactionId: 'seed_mock_topup_spectator2',
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
      penaltyApplied: 'time_penalty',
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
      quickRiskMultipliers: [1, 2, 3, 6],
      feePercent: 10,
      organizerFeeRate: 10,
      racingRewardRate: 15,
      spectatorRewardRate: 75,
      ownerShareRate: 80,
      jockeyShareRate: 20,
      rankRewardRates: [50, 25, 15, 7, 3],
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
      quickRiskMultipliers: [1, 2, 3],
      feePercent: 10,
      organizerFeeRate: 10,
      racingRewardRate: 15,
      spectatorRewardRate: 75,
      ownerShareRate: 80,
      jockeyShareRate: 20,
      rankRewardRates: [50, 30, 20],
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

  await PredictionPool.create({
    raceId: raceCompleted._id,
    tournamentId: tournamentSpring._id,
    status: 'open',
    ticketPrice: 50_000,
    minRiskMultiplier: 1,
    maxRiskMultiplier: 10,
    quickRiskMultipliers: [1, 2, 3, 6],
    totalTickets: 2,
    totalBountyPool: 100_000,
    winPool: 0,
    contributorCount: 2,
  });

  const predictionPending2 = await Prediction.create({
    spectatorId: spectator2._id,
    raceId: raceCompleted._id,
    tournamentId: tournamentSpring._id,
    predictedRanks: [
      { rank: 1, horseId: horseB._id },
    ],
    status: 'pending',
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
  ]);

  console.log('\n=== Seed completed ===\n');
  console.log('A — Jockey:   pending invite on', raceUpcoming.name);
  console.log('B — Spectator: open prediction on', raceOpen.name);
  console.log('C — Scoring:  result confirmed, awaiting publish on', raceCompleted.name);
  console.log('D — Referee:  result DRAFT created on', raceDraft.name);
  console.log('E — Independent: Horse registered, NO Jockey on', raceIndependent.name);
  console.log('   -> Free Jockey available: jockey3@demo.local');
  console.log('   -> Extra spectator account: spectator2@demo.local');

  // 🚀 IN RA CÁC MẪU JSON ĐỂ TEST TRỰC TIẾP TRÊN POSTMAN
  console.log('\n======================================================');
  console.log(' 🚀 DỮ LIỆU ĐỂ TEST API TRỌNG TÀI (REFEREE) TRÊN POSTMAN');
  console.log('======================================================');
  
  console.log(`\n🔴 1. TEST PHẠT CỘNG THỜI GIAN (Ngựa B đang hạng 1 -> Phạt 5.5s để rớt hạng 2)`);
  console.log(`POST /api/referee/races/${raceDraft._id}/penalties/time`);
  console.log(JSON.stringify({
    horseId: horseB._id.toString(),
    jockeyId: jockey2._id.toString(),
    addedTimeSeconds: 5.5,
    ruleId: ruleObstruction._id.toString(),
    type: ruleObstruction.category,
    description: "Chèn ép ở khúc cua cuối, phạt 5.5 giây theo lỗi ERR-002"
  }, null, 2));

  console.log(`\n🔴 2. TEST TƯỚC QUYỀN THI ĐẤU (ghi nhận lỗi disqualify bằng endpoint penalize)`);
  console.log(`POST /api/referee/races/${raceDraft._id}/penalize`);
  console.log(JSON.stringify({
    horseId: horseC._id.toString(),
    jockeyId: jockey1._id.toString(),
    ruleId: ruleFalseStart._id.toString(),
    target: "horse",
    notes: "Ngựa C xuất phát sớm theo lỗi ERR-001, tước quyền thi đấu."
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
