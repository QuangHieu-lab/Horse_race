// Bộ luật vi phạm chuẩn, tách theo đối tượng bị lập biên bản (ngựa / nài ngựa),
// dựa trên các lỗi phổ biến trong đua ngựa chuyên nghiệp.
//
// Hình thức xử phạt (penaltyApplied) khớp với logic BE hiện tại:
//   - warning        : cảnh cáo, chỉ ghi biên bản, không đổi kết quả
//   - demote         : hạ bậc ngựa vi phạm xuống ngay sau "ngựa bị ảnh hưởng" (cần affectedHorseId)
//   - disqualify     : tước quyền — loại ngựa khỏi bảng xếp hạng (prize = 0)
//   - time_ban       : cấm thi đấu có thời hạn (banDurationDays > 0)
//   - permanent_ban  : cấm thi đấu vô thời hạn
// Riêng luật có chữ "doping" trong tên/mô tả sẽ được BE xử lý như DQ + cấm chủ/ngựa/nài.
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
    description: 'Nài điều khiển ngựa tạt đầu, lấn làn, cản trở ngựa khác một cách bất hợp lệ — hạ bậc xuống sau ngựa bị ảnh hưởng.',
    category: 'race_conduct',
    severity: 'high',
    appliesTo: 'jockey',
    penaltyApplied: 'demote',
    banDurationDays: 0,
  },
  {
    code: 'JCK-02',
    name: 'Lái ẩu nguy hiểm (Dangerous riding)',
    description: 'Điều khiển ẩu, cố ý gây va chạm nguy hiểm cho nài và ngựa khác — tước quyền thi đấu.',
    category: 'race_conduct',
    severity: 'critical',
    appliesTo: 'jockey',
    penaltyApplied: 'disqualify',
    banDurationDays: 0,
  },
  {
    code: 'JCK-03',
    name: 'Sử dụng roi quá mức (Excessive whip)',
    description: 'Quất roi vượt quá số lần / sai cách thức cho phép — cảnh cáo.',
    category: 'equipment',
    severity: 'low',
    appliesTo: 'jockey',
    penaltyApplied: 'warning',
    banDurationDays: 0,
  },
  {
    code: 'JCK-04',
    name: 'Không nỗ lực về đích (Non-trying)',
    description: 'Không điều khiển ngựa thi đấu hết khả năng (ghì cương, dìu ngựa để dàn xếp kết quả) — tước quyền.',
    category: 'race_conduct',
    severity: 'high',
    appliesTo: 'jockey',
    penaltyApplied: 'disqualify',
    banDurationDays: 0,
  },
  {
    code: 'JCK-05',
    name: 'Sai trọng lượng khi cân (Weight breach)',
    description: 'Trọng lượng cân trước/sau đua không đúng quy định (thiếu/thừa chì, không cân lại) — tước quyền.',
    category: 'administrative',
    severity: 'high',
    appliesTo: 'jockey',
    penaltyApplied: 'disqualify',
    banDurationDays: 0,
  },
  {
    code: 'JCK-07',
    name: 'Hành vi phản thể thao nghiêm trọng (Serious misconduct)',
    description: 'Cố ý gian lận, thông đồng dàn xếp hoặc hành vi phi thể thao nghiêm trọng — cấm thi đấu 14 ngày.',
    category: 'race_conduct',
    severity: 'critical',
    appliesTo: 'jockey',
    penaltyApplied: 'time_ban',
    banDurationDays: 14,
  },

  // ─── Lỗi của NGỰA (horse) ────────────────────────────────────────────────
  {
    code: 'HRS-01',
    name: 'Dương tính chất cấm (Doping)',
    description: 'Mẫu xét nghiệm phát hiện chất cấm / doping — tước quyền và cấm thi đấu (áp dụng cả chủ, ngựa, nài).',
    category: 'medical',
    severity: 'critical',
    appliesTo: 'horse',
    penaltyApplied: 'disqualify',
    banDurationDays: 0,
  },
  {
    code: 'HRS-02',
    name: 'Không đạt kiểm tra thú y (Failed vet check)',
    description: 'Ngựa không đủ điều kiện sức khỏe / khập khiễng khi kiểm tra trước đua — tước quyền.',
    category: 'medical',
    severity: 'high',
    appliesTo: 'horse',
    penaltyApplied: 'disqualify',
    banDurationDays: 0,
  },
  {
    code: 'HRS-03',
    name: 'Xuất huyết phổi khi đua (EIPH / Bleeding)',
    description: 'Ngựa bị chảy máu phổi khi thi đấu — buộc nghỉ thi đấu 14 ngày để hồi phục.',
    category: 'medical',
    severity: 'medium',
    appliesTo: 'horse',
    penaltyApplied: 'time_ban',
    banDurationDays: 14,
  },
  {
    code: 'HRS-04',
    name: 'Trang bị ngựa không hợp lệ (Illegal equipment)',
    description: 'Móng sắt / bịt mắt / yên cương không đúng khai báo hoặc không hợp lệ — cảnh cáo.',
    category: 'equipment',
    severity: 'low',
    appliesTo: 'horse',
    penaltyApplied: 'warning',
    banDurationDays: 0,
  },
  {
    code: 'HRS-05',
    name: 'Mất kiểm soát ở cổng xuất phát (Barrier misbehaviour)',
    description: 'Ngựa lồng lộn, húc cổng, gây mất an toàn ở khu xuất phát — cảnh cáo.',
    category: 'race_conduct',
    severity: 'medium',
    appliesTo: 'horse',
    penaltyApplied: 'warning',
    banDurationDays: 0,
  },
  {
    code: 'HRS-06',
    name: 'Vi phạm y tế nghiêm trọng (Serious medical breach)',
    description: 'Doping tái phạm hoặc vi phạm quy định y tế nghiêm trọng khác — cấm thi đấu vô thời hạn.',
    category: 'medical',
    severity: 'critical',
    appliesTo: 'horse',
    penaltyApplied: 'permanent_ban',
    banDurationDays: 0,
  },
];
