import { Router } from 'express';
import { RaceController } from '../controllers/race.controller.js';

const router = Router();
const controller = new RaceController();

router.post('/', controller.create);
router.get('/tournament/:tournamentId', controller.getByTournament);
router.get('/:id', controller.getById);
router.post('/:id/participants', controller.addParticipant);
router.patch('/:id/status', controller.updateStatus);
export default router;