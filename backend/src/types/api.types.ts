import type {
  HealthStatus,          
  RegistrationStatus,
  InvitationStatus,
  PredictionStatus,
  RaceStatus,
  RedemptionStatus,
  TournamentStatus,
} from './shared.types.js';

export interface NamedEntityDto {
  id: string;
  name: string;
}

export interface UserSummaryDto {
  id: string;
  fullName: string;
}

export interface PenaltyStatusDto {
  isBanned: boolean;
  bannedUntil: string | null;
  reason: string | null;
}

export interface HorseWithPenaltyDto extends NamedEntityDto {
  penaltyStatus: PenaltyStatusDto;
}

export interface InvitationDto {
  id: string;
  status: InvitationStatus;
  message?: string;
  respondedAt?: string | null;
  createdAt: string;
  horse: HorseWithPenaltyDto;
  race: {
    id: string;
    name: string;
    scheduledAt?: string;
    status: RaceStatus;
  };
  owner: UserSummaryDto;
  jockey?: UserSummaryDto | null; // Bổ sung thông tin người nhận lời mời
}

export interface JockeyRaceParticipantDto {
  horse: HorseWithPenaltyDto;
  owner: UserSummaryDto;
  laneNumber: number | null;
  confirmedAt?: string | null;
}

export interface RaceRankingDto {
  rank: number;
  horse: NamedEntityDto;
  jockey: UserSummaryDto;
  finishTime?: number;
  prize: number;
}

export interface RaceViolationSummaryDto {
  horseId: string | null;
  horseName: string | null;
  type: string;
  description: string;
  penaltyApplied: string | null;
}

export interface RaceResultDto {
  id: string;
  rankings: RaceRankingDto[];
  publishedAt?: string | null;
  violations: RaceViolationSummaryDto[];
}

export interface JockeyRaceDto {
  id: string;
  name: string;
  round: number;
  scheduledAt: string;
  status: RaceStatus;
  distance?: number;
  tournament: NamedEntityDto;
  participant: JockeyRaceParticipantDto;
  result?: RaceResultDto | null;
}

export interface JockeyDashboardDto {
  pendingInvitations: number;
  upcomingRaces: number;
  completedRaces: number;
}

export interface SpectatorHorseDto {
  id: string;
  name: string;
  laneNumber: number | null;
}

export interface ViewingTicketInfoDto {
  requiresTicket: boolean;
  hasPass: boolean;
  canPurchase: boolean;
  pricePoints: number;
  announceAt: string | null;
  saleOpensAt: string | null;
  saleExpiresAt: string | null;
  announcementMessage?: string;
  allowVipRedemption: boolean;
}

export interface RaceViewingPassDto {
  id: string;
  raceId: string;
  raceName?: string;
  scheduledAt?: string;
  source: 'purchase' | 'vip_redemption';
  pointsPaid: number;
  purchasedAt: string;
  status: 'active' | 'expired' | 'revoked';
}

export interface SpectatorRaceDto {
  id: string;
  name: string;
  round: number;
  scheduledAt: string;
  status: RaceStatus;
  distance?: number;
  tournament: NamedEntityDto;
  participants: SpectatorHorseDto[];
  canPredict: boolean;
  hasPrediction: boolean;
  predictionOpenAt?: string | null;
  predictionCloseAt?: string | null;
  predictionConfig: {
    isEnabled: boolean;
    poolEnabled: boolean;
    entryFee: number;
    quickRiskMultipliers: number[];
  };
  result?: RaceResultDto | null;
  viewingTicket: ViewingTicketInfoDto;
  streamUrl?: string;
}

export interface TournamentDto {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  location: string;
  status: TournamentStatus;
}

export interface PredictedRankDto {
  rank: number;
  horseId: string;
  horseName?: string;
}

export interface PredictionDto {
  id: string;
  raceId: string;
  raceName: string;
  tournamentName: string;
  predictedRanks: PredictedRankDto[];
  status: PredictionStatus;
  riskMultiplier: number;
  contribution: number;
  predictionScore: number;
  pointsEarned: number;
  bonusPoints: number;
  poolShare: number;
  totalPoints: number;
  evaluatedAt?: string | null;
  createdAt: string;
}

export interface PointsTransactionDto {
  id: string;
  type: string;
  points: number;
  balanceAfter: number;
  note?: string;
  createdAt: string;
}

export interface SpectatorPointsDto {
  currentBalance: number;
  totalPointsEarned: number;
  totalPointsSpent: number;
  transactions: PointsTransactionDto[];
}

export interface PaymentTransactionDto {
  id: string;
  provider: string;
  amountVnd: number;
  points: number;
  exchangeRateVndPerPoint: number;
  status: string;
  providerTransactionId?: string | null;
  paidAt?: string | null;
  expiredAt?: string | null;
  createdAt: string;
}

export interface ProductDto {
  id: string;
  name: string;
  description?: string;
  category: string;
  pointsCost: number;
  stock: number;
  isInStock: boolean;
  linkedRaceId?: string | null;
  voucherKind?: 'race_viewing_pass' | null;
}

export interface RedemptionDto {
  id: string;
  productName: string;
  quantity: number;
  totalPoints: number;
  status: RedemptionStatus;
  createdAt: string;
}
export interface HorseDto {
  id: string;
  registrationId?: string
  name: string;
  breed: string;
  age: number;
  weight?: number;
  color?: string;
  trainerName?: string;
  profilePdfUrl?: string;
  profilePdfName?: string;
  healthStatus: HealthStatus;
  currentJockey?: UserSummaryDto | null;
  createdAt?: string;
}

export interface RegistrationDto {
  id: string;
  status: RegistrationStatus;
  horse: {
    id: string;
    name: string;
    healthStatus: HealthStatus;
    breed?: string;
    age?: number;
    profilePdfUrl?: string;
    profilePdfName?: string;
  };
  race: {
    id: string;
    name: string;
    round: number;
    status: RaceStatus;
    scheduledAt?: string;
  };
  owner?: UserSummaryDto | null;        // Chủ ngựa đã nộp đơn
  jockey?: UserSummaryDto | null;
  processedBy?: UserSummaryDto | null; // Thông tin Admin đã duyệt
  processedAt?: string | null;         // Thời gian duyệt
  waiverAcceptedAt?: string | null;    // Thời gian ký miễn trừ
  adminNote?: string | null;           // Ghi chú của Admin khi xử lý
  createdAt?: string;
}
