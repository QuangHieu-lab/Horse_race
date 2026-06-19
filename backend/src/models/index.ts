/**
 * Barrel export — import models từ đây để đăng ký schema với Mongoose.
 */

export { User, type IUser, type IUserMethods, type IJockeyProfile, type IRefereeProfile } from './User.model.js';
export { Horse, type IHorse } from './Horse.model.js';
export { Track, type ITrack } from './Track.model.js';
export { RaceMeeting, type IRaceMeeting } from './RaceMeeting.model.js';
export {
  Tournament,
  type ITournament,
  type IPredictionConfig,
} from './Tournament.model.js';
export { Race, type IRace, type IParticipant, type IViewingTicket } from './Race.model.js';
export { RaceViewingPass, type IRaceViewingPass } from './RaceViewingPass.model.js';
export {
  ViewingTicketReminderLog,
  type IViewingTicketReminderLog,
} from './ViewingTicketReminderLog.model.js';
export { RaceRegistration, type IRaceRegistration } from './RaceRegistration.model.js';
export {
  Result,
  type IResult,
  type IRanking,
  type IViolation,
  type IProtest,
} from './Result.model.js';
export { JockeyInvitation, type IJockeyInvitation } from './JockeyInvitation.model.js';
export { Prediction, type IPrediction, type IPredictedRank } from './Prediction.model.js';
export { PredictionPool, type IPredictionPool } from './PredictionPool.model.js';
export {
  SpectatorProfile,
  type ISpectatorProfile,
  type ISpectatorProfileMethods,
  type IPointsTransaction,
} from './SpectatorProfile.model.js';
export { Product, type IProduct } from './Product.model.js';
export { Redemption, type IRedemption } from './Redemption.model.js';
export { Notification, type INotification } from './Notification.model.js';
export { AuditLog, type IAuditLog } from './AuditLog.model.js';
export { OrganizerLedger, type IOrganizerLedger } from './OrganizerLedger.model.js';
export { ViolationRule, type IViolationRule } from './ViolationRule.model.js';