import type {
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

export interface InvitationDto {
  id: string;
  status: InvitationStatus;
  message?: string;
  respondedAt?: string | null;
  createdAt: string;
  horse: NamedEntityDto;
  race: {
    id: string;
    name: string;
    scheduledAt: string;
    status: RaceStatus;
  };
  owner: UserSummaryDto;
}

export interface JockeyRaceParticipantDto {
  horse: NamedEntityDto;
  owner: UserSummaryDto;
  laneNumber: number;
  confirmedAt?: string | null;
}

export interface RaceRankingDto {
  rank: number;
  horse: NamedEntityDto;
  jockey: UserSummaryDto;
  finishTime?: number;
  prize: number;
}

export interface RaceResultDto {
  id: string;
  rankings: RaceRankingDto[];
  publishedAt?: string | null;
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
  laneNumber: number;
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
  result?: RaceResultDto | null;
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
  pointsEarned: number;
  bonusPoints: number;
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

export interface ProductDto {
  id: string;
  name: string;
  description?: string;
  category: string;
  pointsCost: number;
  stock: number;
  isInStock: boolean;
}

export interface RedemptionDto {
  id: string;
  productName: string;
  quantity: number;
  totalPoints: number;
  status: RedemptionStatus;
  createdAt: string;
}
