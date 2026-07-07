// Thay bộ luật vi phạm hiện có bằng bộ chuẩn (tách theo đối tượng ngựa/nài),
// KHÔNG đụng tới dữ liệu khác. Chạy: npx tsx src/scripts/reseed-violation-rules.ts
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { ViolationRule } from '../models/ViolationRule.model.js';
import { User } from '../models/User.model.js';
import { VIOLATION_RULES } from '../data/violation-rules.data.js';

async function main() {
  await connectDatabase();

  const admin = await User.findOne({ role: 'admin' }).select('_id').lean();
  const createdBy = admin?._id ?? null;

  const removed = await ViolationRule.deleteMany({});
  console.log(`Đã xóa ${removed.deletedCount} luật cũ.`);

  const created = await ViolationRule.create(
    VIOLATION_RULES.map((r) => ({ ...r, isActive: true, createdBy })),
  );
  console.log(`Đã tạo ${created.length} luật mới:`);
  for (const r of created) {
    console.log(`  ${r.code.padEnd(7)} | ${r.appliesTo.padEnd(6)} | ${r.penaltyApplied.padEnd(14)} | ${r.name}`);
  }

  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDatabase();
  process.exit(1);
});
