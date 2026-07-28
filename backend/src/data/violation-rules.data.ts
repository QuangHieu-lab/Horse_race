// Bộ luật vi phạm chuẩn. Hệ thống chỉ dùng 4 hình phạt:
// low -> warning, medium -> result_void, high -> time_ban, critical -> permanent_ban.
// warning vẫn được nhận thưởng; các hình phạt từ result_void trở lên không nhận thưởng trong cuộc đua đó.

export interface ViolationRuleSeed {
  code: string;
  name: string;
  description: string;
  category: 'race_conduct' | 'medical' | 'equipment' | 'administrative';
  severity: 'low' | 'medium' | 'high' | 'critical';
  appliesTo: 'horse' | 'jockey' | 'both';
  penaltyApplied: 'warning' | 'result_void' | 'time_ban' | 'permanent_ban';
  requiresBanDuration: boolean;
  banDurationDays: number;
}

export const VIOLATION_RULES: ViolationRuleSeed[] = [
  {
    code: 'JCK-03',
    name: 'Sử dụng roi quá mức',
    description: 'Nài ngựa sử dụng roi vượt quá số lần hoặc sai cách thức cho phép. Áp dụng cảnh cáo, kết quả và thưởng vẫn được giữ nguyên.',
    category: 'equipment',
    severity: 'low',
    appliesTo: 'jockey',
    penaltyApplied: 'warning',
    requiresBanDuration: false,
    banDurationDays: 0,
  },
  {
    code: 'HRS-04',
    name: 'Trang bị ngựa không hợp lệ mức nhẹ',
    description: 'Trang bị ngựa có sai sót nhẹ nhưng không tạo lợi thế thi đấu rõ rệt. Áp dụng cảnh cáo.',
    category: 'equipment',
    severity: 'low',
    appliesTo: 'horse',
    penaltyApplied: 'warning',
    requiresBanDuration: false,
    banDurationDays: 0,
  },
  {
    code: 'JCK-05',
    name: 'Sai trọng lượng khi cân',
    description: 'Trọng lượng cân trước hoặc sau đua không đúng quy định. Kết quả của cuộc đua hiện tại bị hủy, nhưng không cấm các cuộc đua sau.',
    category: 'administrative',
    severity: 'medium',
    appliesTo: 'jockey',
    penaltyApplied: 'result_void',
    requiresBanDuration: false,
    banDurationDays: 0,
  },
  {
    code: 'HRS-02',
    name: 'Không đạt kiểm tra thú y sau đua',
    description: 'Ngựa không đạt kiểm tra thú y sau đua ở mức ảnh hưởng đến tính hợp lệ của kết quả. Hủy kết quả của riêng cuộc đua hiện tại.',
    category: 'medical',
    severity: 'medium',
    appliesTo: 'horse',
    penaltyApplied: 'result_void',
    requiresBanDuration: false,
    banDurationDays: 0,
  },
  {
    code: 'JCK-02',
    name: 'Lái ẩu gây nguy hiểm',
    description: 'Nài ngựa điều khiển nguy hiểm, gây va chạm hoặc rủi ro an toàn nghiêm trọng. Hủy kết quả cuộc đua hiện tại và cấm thi đấu có thời hạn.',
    category: 'race_conduct',
    severity: 'high',
    appliesTo: 'jockey',
    penaltyApplied: 'time_ban',
    requiresBanDuration: true,
    banDurationDays: 14,
  },
  {
    code: 'HRS-03',
    name: 'Vấn đề sức khỏe cần đình chỉ',
    description: 'Ngựa gặp vấn đề sức khỏe cần nghỉ thi đấu để kiểm tra và hồi phục. Hủy kết quả cuộc đua hiện tại và cấm thi đấu có thời hạn.',
    category: 'medical',
    severity: 'high',
    appliesTo: 'horse',
    penaltyApplied: 'time_ban',
    requiresBanDuration: true,
    banDurationDays: 14,
  },
  {
    code: 'JCK-07',
    name: 'Gian lận hoặc dàn xếp kết quả',
    description: 'Nài ngựa có hành vi gian lận, thông đồng hoặc dàn xếp kết quả. Hủy kết quả cuộc đua hiện tại và cấm thi đấu vô thời hạn.',
    category: 'race_conduct',
    severity: 'critical',
    appliesTo: 'jockey',
    penaltyApplied: 'permanent_ban',
    requiresBanDuration: false,
    banDurationDays: 0,
  },
  {
    code: 'HRS-01',
    name: 'Dương tính chất cấm',
    description: 'Mẫu xét nghiệm của ngựa phát hiện chất cấm hoặc doping. Hủy kết quả cuộc đua hiện tại và cấm thi đấu vô thời hạn.',
    category: 'medical',
    severity: 'critical',
    appliesTo: 'horse',
    penaltyApplied: 'permanent_ban',
    requiresBanDuration: false,
    banDurationDays: 0,
  },
];
