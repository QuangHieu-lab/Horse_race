/** Shared enums & types — dùng chung models, services, validators */

export type UserRole =
  | 'horse_owner'
  | 'jockey'
  | 'referee'
  | 'spectator'
  | 'admin';

export type HealthStatus = 'fit' | 'injured' | 'retired';

export type TournamentStatus = 'draft' | 'published' | 'ongoing' | 'completed';

export type RaceStatus = 'scheduled' | 'ongoing' | 'completed' | 'cancelled';

export type MeetingStatus = 'scheduled' | 'ongoing' | 'completed' | 'cancelled';

export type TrackSurface = 'turf' | 'synthetic' | 'dirt' | 'other';

export type GoingCondition =
  | 'firm'
  | 'good'
  | 'soft'
  | 'heavy'
  | 'standard'
  | 'unknown';

export type ViolationType = 'false_start' | 'obstruction' | 'doping' | 'other';

export type InvitationStatus = 'pending' | 'accepted' | 'declined';

export type RegistrationStatus = 'pending' | 'approved' | 'rejected';

export type PredictionStatus = 'pending' | 'partial' | 'correct' | 'incorrect';

export type PredictionPoolStatus = 'open' | 'locked' | 'settled';

export type PoolRolloverPolicy = 'refund' | 'rollover_next_race' | 'to_organizer';

export type PenaltyApplied = 'warning' | 'demote' | 'disqualify' | 'restart';

export type ProtestStatus = 'pending' | 'upheld' | 'dismissed';

export type AuditAction =
  | 'registration_approved'
  | 'registration_rejected'
  | 'race_status_changed'
  | 'result_confirmed'
  | 'result_published'
  | 'prediction_pool_settled'
  | 'participant_scratched';

export type PointsTxType =
  | 'earned_prediction'
  | 'earned_bonus'
  | 'spent_redemption'
  | 'refunded_redemption'
  | 'spent_pool_entry'
  | 'earned_pool_share'
  | 'refunded_pool';

export type ProductCategory =
  | 'merchandise'
  | 'voucher'
  | 'experience'
  | 'digital'
  | 'other';

export type RedemptionStatus =
  | 'pending'
  | 'approved'
  | 'fulfilled'
  | 'rejected'
  | 'refunded';

export type NotificationType =
  | 'invitation_received'
  | 'invitation_accepted'
  | 'invitation_declined'
  | 'race_confirmed'
  | 'race_started'
  | 'race_cancelled'
  | 'result_confirmed'
  | 'result_published'
  | 'prediction_reward'
  | 'registration_approved'
  | 'participant_scratched'
  | 'result_protest_filed';

export type NotificationRefModel =
  | 'Race'
  | 'Tournament'
  | 'Result'
  | 'JockeyInvitation'
  | 'Prediction'
  | 'RaceRegistration'
  | 'PredictionPool'
  | 'RaceMeeting'
  | 'Track';

export const PENALTY_APPLIED: readonly PenaltyApplied[] = [
  'warning',
  'demote',
  'disqualify',
  'restart',
] as const;

export const USER_ROLES: readonly UserRole[] = [
  'horse_owner',
  'jockey',
  'referee',
  'spectator',
  'admin',
] as const;

export const TRACK_SURFACES: readonly TrackSurface[] = [
  'turf',
  'synthetic',
  'dirt',
  'other',
] as const;

export const GOING_CONDITIONS: readonly GoingCondition[] = [
  'firm',
  'good',
  'soft',
  'heavy',
  'standard',
  'unknown',
] as const;

export const POOL_ROLLOVER_POLICIES: readonly PoolRolloverPolicy[] = [
  'refund',
  'rollover_next_race',
  'to_organizer',
] as const;
