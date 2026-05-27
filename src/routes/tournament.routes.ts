import { Router } from 'express';
import { TournamentController } from '../controllers/tournament.controller.js';

const router = Router();
const controller = new TournamentController();

router.post('/', controller.create);
router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.patch('/:id/status', controller.updateStatus);
export default router;