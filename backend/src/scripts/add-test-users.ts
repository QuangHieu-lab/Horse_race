/**
 * Thêm dữ liệu test cho mọi role: jockey, horse owner, spectator (có điểm), referee.
 * KHÔNG xóa data thật — chỉ xóa & tạo lại các user test theo pattern email bên dưới.
 * Idempotent: chạy lại nhiều lần vẫn cho cùng kết quả.
 *
 * Chạy: npm run db:add-test-users — Mật khẩu chung: Test@123
 */
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { SpectatorProfile, User } from '../models/index.js';

const TEST_PASSWORD = 'Test@123';

const JOCKEY_COUNT = 20;
const OWNER_COUNT = 10;
const SPECTATOR_COUNT = 10;
const REFEREE_COUNT = 5;

const SPECTATOR_BALANCE = 200000; // điểm khởi tạo để test dự đoán

// Pattern email để nhận diện & dọn dẹp user test
const JOCKEY_EMAIL = (i: number) => `test.jockey${i}@demo.local`;
const OWNER_EMAIL = (i: number) => `test.owner${i}@demo.local`;
const SPECTATOR_EMAIL = (i: number) => `test.spectator${i}@demo.local`;
const REFEREE_EMAIL = (i: number) => `test.referee${i}@demo.local`;

const FIRST = ['An', 'Bình', 'Cường', 'Dũng', 'Em', 'Phong', 'Giang', 'Hoa', 'Huy', 'Kim',
  'Lâm', 'Mai', 'Nam', 'Oanh', 'Phú', 'Quân', 'Sơn', 'Trang', 'Uyên', 'Vy'];
const SURNAME = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Ngô'];

function nameFor(i: number): string {
  return `${SURNAME[i % SURNAME.length]} Văn ${FIRST[i % FIRST.length]}`;
}

function phoneFor(prefix: string, n: number): string {
  return `${prefix}${String(n).padStart(4, '0')}`;
}

async function run(): Promise<void> {
  const jockeyEmails = Array.from({ length: JOCKEY_COUNT }, (_, i) => JOCKEY_EMAIL(i + 1));
  const ownerEmails = Array.from({ length: OWNER_COUNT }, (_, i) => OWNER_EMAIL(i + 1));
  const spectatorEmails = Array.from({ length: SPECTATOR_COUNT }, (_, i) => SPECTATOR_EMAIL(i + 1));
  const refereeEmails = Array.from({ length: REFEREE_COUNT }, (_, i) => REFEREE_EMAIL(i + 1));
  const allEmails = [...jockeyEmails, ...ownerEmails, ...spectatorEmails, ...refereeEmails];

  console.log('Dọn dẹp user test cũ (nếu có)…');
  const old = await User.find({ email: { $in: allEmails } }).select('_id').lean();
  if (old.length) {
    await SpectatorProfile.deleteMany({ userId: { $in: old.map((u) => u._id) } });
    await User.deleteMany({ _id: { $in: old.map((u) => u._id) } });
  }

  console.log(`Tạo ${JOCKEY_COUNT} jockey…`);
  for (let i = 0; i < JOCKEY_COUNT; i += 1) {
    const n = i + 1;
    await User.create({
      email: JOCKEY_EMAIL(n),
      passwordHash: TEST_PASSWORD,
      role: 'jockey',
      fullName: `Nài ${nameFor(i)}`,
      phone: phoneFor('09110', n),
      jockeyProfile: { licenseNumber: `VN-JKY-T${String(n).padStart(3, '0')}`, isSuspended: false },
    });
  }

  console.log(`Tạo ${OWNER_COUNT} horse owner…`);
  for (let i = 0; i < OWNER_COUNT; i += 1) {
    const n = i + 1;
    await User.create({
      email: OWNER_EMAIL(n),
      passwordHash: TEST_PASSWORD,
      role: 'horse_owner',
      fullName: `Chủ ngựa ${nameFor(i)}`,
      phone: phoneFor('09220', n),
    });
  }

  console.log(`Tạo ${REFEREE_COUNT} referee…`);
  for (let i = 0; i < REFEREE_COUNT; i += 1) {
    const n = i + 1;
    await User.create({
      email: REFEREE_EMAIL(n),
      passwordHash: TEST_PASSWORD,
      role: 'referee',
      fullName: `Trọng tài ${nameFor(i)}`,
      phone: phoneFor('09440', n),
      refereeProfile: { certificationId: `VN-REF-T${String(n).padStart(3, '0')}` },
    });
  }

  console.log(`Tạo ${SPECTATOR_COUNT} spectator (mỗi tài khoản ${SPECTATOR_BALANCE} điểm)…`);
  for (let i = 0; i < SPECTATOR_COUNT; i += 1) {
    const n = i + 1;
    const user = await User.create({
      email: SPECTATOR_EMAIL(n),
      passwordHash: TEST_PASSWORD,
      role: 'spectator',
      fullName: `Khán giả ${nameFor(i)}`,
      phone: phoneFor('09330', n),
    });
    // User model tự tạo SpectatorProfile (balance 0) qua post-save hook → nạp điểm vào đó
    await SpectatorProfile.findOneAndUpdate(
      { userId: user._id },
      { $set: { currentBalance: SPECTATOR_BALANCE, totalPointsEarned: SPECTATOR_BALANCE, totalPointsSpent: 0 } },
      { upsert: true },
    );
  }

  console.log('\n=== Hoàn tất ===');
  console.log(`Mật khẩu chung: ${TEST_PASSWORD}`);
  console.log(`Jockey:    test.jockey1..${JOCKEY_COUNT}@demo.local`);
  console.log(`Owner:     test.owner1..${OWNER_COUNT}@demo.local`);
  console.log(`Referee:   test.referee1..${REFEREE_COUNT}@demo.local`);
  console.log(`Spectator: test.spectator1..${SPECTATOR_COUNT}@demo.local (mỗi tài khoản ${SPECTATOR_BALANCE} điểm)`);
  console.log(`Tổng cộng: ${JOCKEY_COUNT + OWNER_COUNT + REFEREE_COUNT + SPECTATOR_COUNT} tài khoản test.`);
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
