import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { Horse, Prediction, Race, RaceRegistration, Result, Tournament, ViolationRule } from '../models/index.js';

const VALID_PENALTIES = ['warning', 'result_void', 'time_ban', 'permanent_ban'];

function addIssue(issues: string[], message: string): void {
  issues.push(`- ${message}`);
}

async function main() {
  await connectDatabase();
  const issues: string[] = [];

  const invalidRules = await ViolationRule.find({
    penaltyApplied: { $nin: VALID_PENALTIES },
  }).select('code penaltyApplied').lean();
  for (const rule of invalidRules) {
    addIssue(issues, `Luật ${rule.code} dùng hình phạt không hợp lệ: ${rule.penaltyApplied}`);
  }

  const badRuleMappings = await ViolationRule.find({
    $or: [
      { severity: 'low', penaltyApplied: { $ne: 'warning' } },
      { severity: 'medium', penaltyApplied: { $ne: 'result_void' } },
      { severity: 'high', penaltyApplied: { $ne: 'time_ban' } },
      { severity: 'critical', penaltyApplied: { $ne: 'permanent_ban' } },
      { penaltyApplied: 'time_ban', requiresBanDuration: { $ne: true } },
      { penaltyApplied: 'time_ban', banDurationDays: { $lte: 0 } },
      { penaltyApplied: { $ne: 'time_ban' }, requiresBanDuration: true },
      { penaltyApplied: { $ne: 'time_ban' }, banDurationDays: { $ne: 0 } },
    ],
  }).select('code severity penaltyApplied requiresBanDuration banDurationDays').lean();
  for (const rule of badRuleMappings) {
    addIssue(
      issues,
      `Luật ${rule.code} lệch mapping mức độ/hình phạt: ${rule.severity}/${rule.penaltyApplied}, requiresBanDuration=${rule.requiresBanDuration}, banDurationDays=${rule.banDurationDays}`,
    );
  }

  const ongoingTournaments = await Tournament.find({ status: 'ongoing' })
    .select('name status')
    .lean();
  for (const tournament of ongoingTournaments) {
    addIssue(issues, `Giải đấu ${tournament.name} vẫn đang ở trạng thái ongoing`);
  }

  const registrationCount = await RaceRegistration.countDocuments({});
  if (registrationCount > 0) {
    addIssue(issues, `Seed còn ${registrationCount} bản ghi đăng ký ngựa; yêu cầu hiện tại là để trống cho người dùng tự đăng ký`);
  }

  const localPdfHorses = await Horse.find({
    profilePdfUrl: /localhost/i,
  }).select('name profilePdfUrl').lean();
  for (const horse of localPdfHorses) {
    addIssue(issues, `Ngựa ${horse.name} còn profilePdfUrl localhost: ${horse.profilePdfUrl}`);
  }

  const races = await Race.find({}).select('name status scheduledAt participants maxParticipants').lean();
  const now = new Date();
  for (const race of races) {
    if (['scheduled', 'ready', 'ongoing'].includes(race.status) && race.scheduledAt <= now) {
      addIssue(issues, `Cuộc đua ${race.name} đang ${race.status} nhưng scheduledAt không ở tương lai`);
    }
    if (race.status === 'completed' && race.scheduledAt > now) {
      addIssue(issues, `Cuộc đua ${race.name} đã completed nhưng scheduledAt ở tương lai`);
    }

    const horseIds = new Set<string>();
    const jockeyIds = new Set<string>();
    for (const participant of race.participants) {
      const horseId = participant.horseId.toString();
      const jockeyId = participant.jockeyId.toString();
      if (horseIds.has(horseId)) addIssue(issues, `Cuộc đua ${race.name} trùng ngựa ${horseId}`);
      if (jockeyIds.has(jockeyId)) addIssue(issues, `Cuộc đua ${race.name} trùng nài ${jockeyId}`);
      horseIds.add(horseId);
      jockeyIds.add(jockeyId);
    }
    if (['scheduled', 'ready', 'ongoing'].includes(race.status) && race.participants.length > 0) {
      addIssue(issues, `Cuộc đua ${race.name} chưa hoàn tất nhưng đã có ${race.participants.length} ngựa trong danh sách tham gia`);
    }
  }

  const predictions = await Prediction.find({}).select('raceId predictedRanks').lean();
  for (const prediction of predictions) {
    const race = races.find((item) => item._id.toString() === prediction.raceId.toString());
    if (!race) {
      addIssue(issues, `Dự đoán ${prediction._id.toString()} tham chiếu cuộc đua không tồn tại`);
      continue;
    }
    const participantHorseIds = new Set(race.participants.map((participant) => participant.horseId.toString()));
    for (const predictedRank of prediction.predictedRanks) {
      if (!participantHorseIds.has(predictedRank.horseId.toString())) {
        addIssue(
          issues,
          `Dự đoán ${prediction._id.toString()} chọn ngựa không thuộc danh sách thi đấu của ${race.name}`,
        );
      }
    }
  }

  const results = await Result.find({}).select('raceId rankings violations').lean();
  for (const result of results) {
    const race = races.find((item) => item._id.toString() === result.raceId.toString());
    const raceName = race?.name ?? result.raceId.toString();
    const rankedHorseIds = new Set<string>();
    for (const ranking of result.rankings) {
      const horseId = ranking.horseId.toString();
      if (rankedHorseIds.has(horseId)) addIssue(issues, `Kết quả ${raceName} trùng ranking ngựa ${horseId}`);
      rankedHorseIds.add(horseId);
    }
    for (const violation of result.violations) {
      if (violation.penaltyApplied && !VALID_PENALTIES.includes(violation.penaltyApplied)) {
        addIssue(issues, `Biên bản ${raceName} dùng penalty cũ: ${violation.penaltyApplied}`);
      }
      if (violation.penaltyApplied === 'time_ban' && !violation.bannedUntil) {
        addIssue(issues, `Biên bản ${raceName} là cấm có thời hạn nhưng thiếu bannedUntil`);
      }
      if (violation.penaltyApplied !== 'time_ban' && violation.penaltyApplied !== 'permanent_ban' && violation.bannedUntil) {
        addIssue(issues, `Biên bản ${raceName} không phải án cấm nhưng lại có bannedUntil`);
      }
      if (/DQ|tước quyền|truất quyền/i.test(violation.description)) {
        addIssue(issues, `Biên bản ${raceName} còn wording cũ trong mô tả: ${violation.description}`);
      }
    }
  }

  if (issues.length > 0) {
    console.error(`Seed data có ${issues.length} vấn đề:\n${issues.join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log('Seed data OK: không phát hiện dữ liệu lệch logic.');
  }

  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDatabase();
  process.exit(1);
});
