import { Router } from 'express';
import { AdminViolationRuleController } from '../controllers/admin-violation-rule.controller.js';

export const adminViolationRuleRouter = Router();
const controller = new AdminViolationRuleController();


adminViolationRuleRouter.post('/', controller.create);
adminViolationRuleRouter.get('/', controller.getAll);

adminViolationRuleRouter.patch('/:id', controller.update);
adminViolationRuleRouter.patch('/:id/toggle-status', controller.toggleStatus);