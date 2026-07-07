// Bộ luật vi phạm chuẩn, tách theo đối tượng bị lập biên bản (ngựa / nài ngựa),
// dựa trên các lỗi phổ biến trong đua ngựa chuyên nghiệp.
//
// Hình phạt đơn giản & thống nhất: MỌI vi phạm chỉ làm ngựa TỤT BẬC trong bảng
// xếp hạng, số bậc tuỳ theo MỨC ĐỘ (severity):
//   nhẹ (low) = 1 · trung bình (medium) = 2 · nặng (high) = 3 · rất nặng (critical) = 5
// (tràn khỏi bảng thì xếp cuối). Không còn truất quyền / cấm thi đấu / cộng giờ.
//
// Dùng chung cho seed.ts và script migrate DB để tránh lệch dữ liệu.

export interface ViolationRuleSeed {
  code: string;
  name: string;
  description: string;
  category: 'race_conduct' | 'medical' | 'equipment' | 'administrative';
  severity: 'low' | 'medium' | 'high' | 'critical';
  appliesTo: 'horse' | 'jockey' | 'both';
  penaltyApplied: 'warning' | 'demote' | 'disqualify' | 'disqualification' | 'restart' | 'time_ban' | 'permanent_ban';
  banDurationDays: number;
}

export const VIOLATION_RULES: ViolationRuleSeed[] = [
  // ─── Lỗi của NÀI NGỰA (jockey) ───────────────────────────────────────────
  {
    code: 'JCK-01',
    name: 'Chèn ép / cản trở đối thủ (Interference)',
    description: 'Nài điều khiển ngựa tạt đầu, lấn làn, cản trở ngựa khác một cách bất hợp lệ.',
    category: 'race_conduct',
    severity: 'high', // tụt 3 bậc
    appliesTo: 'jockey',
    penaltyApplied: 'demote',
    banDurationDays: 0,
  },
  {
    code: 'JCK-02',
    name: 'Lái ẩu nguy hiểm (Dangerous riding)',
    description: 'Điều khiển ẩu, cố ý gây va chạm nguy hiểm cho nài và ngựa khác.',
    category: 'race_conduct',
    severity: 'critical', // tụt 5 bậc
    appliesTo: 'jockey',
    penaltyApplied: 'demote',
    banDurationDays: 0,
  },
  {
    code: 'JCK-03',
    name: 'Sử dụng roi quá mức (Excessive whip)',
    description: 'Quất roi vượt quá số lần / sai cách thức cho phép, đặc biệt ở đoạn nước rút.',
    category: 'equipment',
    severity: 'low', // tụt 1 bậc
    appliesTo: 'jockey',
    penaltyApplied: 'demote',
    banDurationDays: 0,
  },
  {
    code: 'JCK-04',
    name: 'Không nỗ lực về đích (Non-trying)',
    description: 'Không điều khiển ngựa thi đấu hết khả năng (ghì cương, dìu ngựa để dàn xếp kết quả).',
    category: 'race_conduct',
    severity: 'high', // tụt 3 bậc
    appliesTo: 'jockey',
    penaltyApplied: 'demote',
    banDurationDays: 0,
  },
  {
    code: 'JCK-05',
    name: 'Sai trọng lượng khi cân (Weight breach)',
    description: 'Trọng lượng cân trước/sau đua không đúng quy định (thiếu/thừa chì, không cân lại).',
    category: 'administrative',
    severity: 'medium', // tụt 2 bậc
    appliesTo: 'jockey',
    penaltyApplied: 'demote',
    banDurationDays: 0,
  },
  {
    code: 'JCK-06',
    name: 'Xuất phát sớm (False start)',
    description: 'Nài thúc ngựa vượt cổng trước hiệu lệnh xuất phát.',
    category: 'race_conduct',
    severity: 'low', // tụt 1 bậc
    appliesTo: 'jockey',
    penaltyApplied: 'demote',
    banDurationDays: 0,
  },
  {
    code: 'JCK-07',
    name: 'Hành vi phản thể thao nghiêm trọng (Serious misconduct)',
    description: 'Cố ý gian lận, thông đồng dàn xếp hoặc hành vi phi thể thao nghiêm trọng.',
    category: 'race_conduct',
    severity: 'critical', // tụt 5 bậc
    appliesTo: 'jockey',
    penaltyApplied: 'demote',
    banDurationDays: 0,
  },

  // ─── Lỗi của NGỰA (horse) ────────────────────────────────────────────────
  {
    code: 'HRS-01',
    name: 'Dương tính chất cấm (Doping)',
    description: 'Mẫu xét nghiệm phát hiện chất cấm / doping.',
    category: 'medical',
    severity: 'critical', // tụt 5 bậc
    appliesTo: 'horse',
    penaltyApplied: 'demote',
    banDurationDays: 0,
  },
  {
    code: 'HRS-02',
    name: 'Không đạt kiểm tra thú y (Failed vet check)',
    description: 'Ngựa không đủ điều kiện sức khỏe / khập khiễng khi kiểm tra trước đua.',
    category: 'medical',
    severity: 'high', // tụt 3 bậc
    appliesTo: 'horse',
    penaltyApplied: 'demote',
    banDurationDays: 0,
  },
  {
    code: 'HRS-03',
    name: 'Xuất huyết phổi khi đua (EIPH / Bleeding)',
    description: 'Ngựa bị chảy máu phổi khi thi đấu.',
    category: 'medical',
    severity: 'medium', // tụt 2 bậc
    appliesTo: 'horse',
    penaltyApplied: 'demote',
    banDurationDays: 0,
  },
  {
    code: 'HRS-04',
    name: 'Trang bị ngựa không hợp lệ (Illegal equipment)',
    description: 'Móng sắt / bịt mắt / yên cương không đúng khai báo hoặc không hợp lệ.',
    category: 'equipment',
    severity: 'low', // tụt 1 bậc
    appliesTo: 'horse',
    penaltyApplied: 'demote',
    banDurationDays: 0,
  },
  {
    code: 'HRS-05',
    name: 'Mất kiểm soát ở cổng xuất phát (Barrier misbehaviour)',
    description: 'Ngựa lồng lộn, húc cổng, gây mất an toàn ở khu xuất phát.',
    category: 'race_conduct',
    severity: 'medium', // tụt 2 bậc
    appliesTo: 'horse',
    penaltyApplied: 'demote',
    banDurationDays: 0,
  },
  {
    code: 'HRS-06',
    name: 'Vi phạm y tế nghiêm trọng (Serious medical breach)',
    description: 'Doping tái phạm hoặc vi phạm quy định y tế nghiêm trọng khác.',
    category: 'medical',
    severity: 'critical', // tụt 5 bậc
    appliesTo: 'horse',
    penaltyApplied: 'demote',
    banDurationDays: 0,
  },
];
