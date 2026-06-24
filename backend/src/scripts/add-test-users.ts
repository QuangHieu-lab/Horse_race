/**
 * Thêm dữ liệu test: 10 jockey + 5 horse owner.
 * KHÔNG xóa data hiện có (chỉ xóa & tạo lại các user test theo pattern email bên dưới).
 * Idempotent: chạy lại nhiều lần vẫn cho cùng kết quả.
 *
 * Chạy: npm run db:add-test-users — Mật khẩu: Test@123
 */
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { User } from '../models/index.js';

const TEST_PASSWORD = 'Test@123';
const JOCKEY_COUNT = 10;
const OWNER_COUNT = 5;

// Pattern email để nhận diện & dọn dẹp user test
const JOCKEY_EMAIL = (i: number) => `test.jockey${i}@demo.local`;
const OWNER_EMAIL = (i: number) => `test.owner${i}@demo.local`;

const JOCKEY_NAMES = [
  'Nguyễn Văn An', 'Trần Thị Bình', 'Lê Hoàng Cường', 'Phạm Minh Dũng',
  'Hoàng Thị Em', 'Vũ Đức Phong', 'Đặng Văn Giang', 'Bùi Thị Hoa',
  'Đỗ Quang Huy', 'Ngô Thị Kim',
];

const OWNER_NAMES = [
  'Chủ ngựa Lâm', 'Chủ ngựa Mai', 'Chủ ngựa Nam', 'Chủ ngựa Oanh', 'Chủ ngựa Phú',
];

async function run(): Promise<void> {
  const jockeyEmails = Array.from({ length: JOCKEY_COUNT }, (_, i) => JOCKEY_EMAIL(i + 1));
  const ownerEmails = Array.from({ length: OWNER_COUNT }, (_, i) => OWNER_EMAIL(i + 1));

  console.log('Dọn dẹp user test cũ (nếu có)…');
  await User.deleteMany({ email: { $in: [...jockeyEmails, ...ownerEmails] } });

  console.log(`Tạo ${JOCKEY_COUNT} jockey…`);
  for (let i = 0; i < JOCKEY_COUNT; i += 1) {
    const n = i + 1;
    await User.create({
      email: JOCKEY_EMAIL(n),
      passwordHash: TEST_PASSWORD,
      role: 'jockey',
      fullName: JOCKEY_NAMES[i] ?? `Jockey Test ${n}`,
      phone: `09110000${String(n).padStart(2, '0')}`,
      jockeyProfile: {
        licenseNumber: `VN-JKY-T${String(n).padStart(3, '0')}`,
        isSuspended: false,
      },
    });
    console.log(`  ✓ ${JOCKEY_EMAIL(n)}`);
  }

  console.log(`Tạo ${OWNER_COUNT} horse owner…`);
  for (let i = 0; i < OWNER_COUNT; i += 1) {
    const n = i + 1;
    await User.create({
      email: OWNER_EMAIL(n),
      passwordHash: TEST_PASSWORD,
      role: 'horse_owner',
      fullName: OWNER_NAMES[i] ?? `Horse Owner Test ${n}`,
      phone: `09220000${String(n).padStart(2, '0')}`,
    });
    console.log(`  ✓ ${OWNER_EMAIL(n)}`);
  }

  console.log('\n=== Hoàn tất ===');
  console.log(`Đã tạo ${JOCKEY_COUNT} jockey + ${OWNER_COUNT} horse owner.`);
  console.log(`Mật khẩu chung: ${TEST_PASSWORD}`);
  console.log(`Email jockey:  test.jockey1..${JOCKEY_COUNT}@demo.local`);
  console.log(`Email owner:   test.owner1..${OWNER_COUNT}@demo.local`);
}

async function main(): Promise<void> {
  await connectDatabase();
  try {
    await run();
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error('Thêm user test thất bại:', err);
  process.exit(1);
});
