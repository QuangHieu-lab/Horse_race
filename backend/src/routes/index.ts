import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/require-role.js';
import * as auth from '../controllers/auth.controller.js';
import * as race from '../controllers/race.controller.js';
import * as horse from '../controllers/horse.controller.js';
import * as registration from '../controllers/registration.controller.js';
import * as invitation from '../controllers/invitation.controller.js';
import * as result from '../controllers/result.controller.js';
import * as prediction from '../controllers/prediction.controller.js';
import * as misc from '../controllers/misc.controller.js';

const router = Router();

router.post('/auth/register', asyncHandler(auth.register));
router.post('/auth/login', asyncHandler(auth.login));
router.get('/auth/me', authenticate, asyncHandler(auth.me));

router.get('/tournaments', asyncHandler(race.listTournaments));
router.get('/tournaments/:id', asyncHandler(race.getTournament));
router.post('/tournaments', authenticate, requireRole('admin'), asyncHandler(race.createTournament));
router.patch('/tournaments/:id', authenticate, requireRole('admin'), asyncHandler(race.updateTournament));

router.get('/races', optionalAuth, asyncHandler(race.listRaces));
router.get('/races/:id', asyncHandler(race.getRace));
router.post(
  '/tournaments/:tournamentId/races',
  authenticate,
  requireRole('admin'),
  asyncHandler(race.createRace),
);
router.patch('/races/:id', authenticate, requireRole('admin'), asyncHandler(race.updateRace));
router.patch(
  '/races/:id/status',
  authenticate,
  requireRole('admin', 'referee'),
  asyncHandler(race.updateRaceStatus),
);
router.patch(
  '/races/:id/participants/confirm',
  authenticate,
  requireRole('horse_owner'),
  asyncHandler(race.confirmParticipant),
);

router.get('/horses', authenticate, asyncHandler(horse.listHorses));
router.post('/horses', authenticate, requireRole('horse_owner'), asyncHandler(horse.createHorse));
router.patch('/horses/:id', authenticate, requireRole('horse_owner', 'admin'), asyncHandler(horse.updateHorse));

router.post(
  '/races/:raceId/registrations',
  authenticate,
  requireRole('horse_owner'),
  asyncHandler(registration.createRegistration),
);
router.get('/registrations', authenticate, asyncHandler(registration.listRegistrations));
router.patch(
  '/registrations/:id',
  authenticate,
  requireRole('admin'),
  asyncHandler(registration.reviewRegistration),
);

router.post('/invitations', authenticate, requireRole('horse_owner'), asyncHandler(invitation.createInvitation));
router.get('/invitations', authenticate, asyncHandler(invitation.listInvitations));
router.patch(
  '/invitations/:id/respond',
  authenticate,
  requireRole('jockey'),
  asyncHandler(invitation.respondInvitation),
);

router.get('/results', optionalAuth, asyncHandler(result.listResults));
router.get('/results/race/:raceId', optionalAuth, asyncHandler(result.getResultByRace));
router.put(
  '/results/race/:raceId',
  authenticate,
  requireRole('referee'),
  asyncHandler(result.upsertResult),
);
router.post(
  '/results/race/:raceId/confirm',
  authenticate,
  requireRole('referee'),
  asyncHandler(result.confirmResult),
);
router.post(
  '/results/race/:raceId/publish',
  authenticate,
  requireRole('admin'),
  asyncHandler(result.publishResult),
);

router.post('/predictions', authenticate, requireRole('spectator'), asyncHandler(prediction.createPrediction));
router.get('/predictions/me', authenticate, requireRole('spectator'), asyncHandler(prediction.myPredictions));

router.get('/notifications', authenticate, asyncHandler(misc.listNotifications));
router.patch('/notifications/:id/read', authenticate, asyncHandler(misc.markRead));

router.get('/users', authenticate, requireRole('admin'), asyncHandler(misc.listUsers));
router.patch('/users/:id', authenticate, requireRole('admin'), asyncHandler(misc.updateUser));

export { router as apiRouter };
